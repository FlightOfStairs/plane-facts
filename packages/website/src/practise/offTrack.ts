/**
 * Off-track correction drill: spherical geometry, scenario generation and
 * marking. All bearings are true; no magnetic variation is modelled.
 */
import scotlandLand from "./scotlandLand.json";

export interface LatLon {
  lat: number;
  lon: number;
}

/** Mean Earth radius in nautical miles. */
const EARTH_RADIUS_NM = 3440.065;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Bearing normalised to [0, 360). */
export function norm360(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** Signed angle normalised to (-180, 180]. */
export function norm180(d: number): number {
  const n = norm360(d);
  return n > 180 ? n - 360 : n;
}

/** Whole-degree heading as a pilot reads it: 001–360, three digits. */
export function formatHeading(d: number): string {
  const whole = Math.round(norm360(d)) || 360;
  return `${String(whole).padStart(3, "0")}°`;
}

export function distanceNm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(h));
}

export function initialBearing(a: LatLon, b: LatLon): number {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return norm360(deg(Math.atan2(y, x)));
}

export function destinationPoint(p: LatLon, bearingDeg: number, distNm: number): LatLon {
  const d = distNm / EARTH_RADIUS_NM;
  const brg = rad(bearingDeg);
  const lat1 = rad(p.lat);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lon2 = rad(p.lon) + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lon: deg(lon2) };
}

/** Cross-track distance of `p` from the great circle start→end; positive right of track. */
export function crossTrackNm(start: LatLon, end: LatLon, p: LatLon): number {
  const d13 = distanceNm(start, p) / EARTH_RADIUS_NM;
  const dTheta = rad(initialBearing(start, p) - initialBearing(start, end));
  return Math.asin(Math.sin(d13) * Math.sin(dTheta)) * EARTH_RADIUS_NM;
}

/** Distance along start→end to the foot of the perpendicular from `p`. */
export function alongTrackNm(start: LatLon, end: LatLon, p: LatLon): number {
  const d13 = distanceNm(start, p) / EARTH_RADIUS_NM;
  const dxt = crossTrackNm(start, end, p) / EARTH_RADIUS_NM;
  return Math.acos(Math.min(1, Math.cos(d13) / Math.cos(dxt))) * EARTH_RADIUS_NM;
}

/**
 * Mainland Scotland and its islands as [lon, lat] rings, from Natural Earth
 * 1:50m admin-0 map units (public domain), rounded to 0.001°.
 */
// oxlint-disable-next-line no-unsafe-type-assertion -- JSON imports widen tuples to number[]; the asset is generated as [lon, lat] pairs
const LAND_RINGS: [number, number][][] = scotlandLand as [number, number][][];

function inRing(ring: [number, number][], { lat, lon }: LatLon): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function onLand(p: LatLon): boolean {
  return LAND_RINGS.some((ring) => inRing(ring, p));
}

const LAND_BOUNDS = (() => {
  const pts = LAND_RINGS.flat();
  return {
    minLon: Math.min(...pts.map((p) => p[0])),
    maxLon: Math.max(...pts.map((p) => p[0])),
    minLat: Math.min(...pts.map((p) => p[1])),
    maxLat: Math.max(...pts.map((p) => p[1])),
  };
})();

export const LEG_NM = { min: 25, max: 50 };
export const TRACK_ERROR_DEG = { min: 3, max: 12 };
export const MIN_OFF_TRACK_NM = 1;
export const MAX_WCA_DEG = 10;
const GROUNDSPEED_KT = { min: 80, max: 110 };
const MIN_MINUTES_FLOWN = 4;
/** Answers within this many degrees of the exact heading are marked correct. */
export const TOLERANCE_DEG = 3;
/** Answers within this many minutes of the exact time are marked correct. */
export const TIME_TOLERANCE_MIN = 1;
/**
 * A scenario is only used if its technique's rule lands this close to the
 * exact answer, so applying the rule properly always scores.
 */
const RULE_MAX_ERROR = { heading: 1.5, minutes: 0.5 };

export const TECHNIQUE_IDS = ["fraction", "double", "oneInSixty"] as const;
export type Technique = (typeof TECHNIQUE_IDS)[number];
export const TECHNIQUES: Record<Technique, string> = {
  fraction: "Fraction of leg",
  double: "Double track error",
  oneInSixty: "1-in-60",
};

export const QUARTILES = [0.25, 0.5, 0.75];
/** Fraction-of-leg placement: within this fraction of the leg of a quarter mark. */
const QUARTILE_JITTER = 0.02;
/** 1-in-60 placement: kept at least this far from a quarter mark, clear of the shortcut. */
const QUARTILE_CLEARANCE = 0.06;
const ALONG_FRACTION: Record<Exclude<Technique, "fraction">, { min: number; max: number }> = {
  // The track is regained at twice the distance flown, which must stay on the leg.
  double: { min: 0.15, max: 0.45 },
  oneInSixty: { min: 0.15, max: 0.75 },
};

export interface Question {
  id: string;
  label: string;
  unit: "heading" | "minutes";
  /** What the technique's rule of thumb gives. */
  rule: number;
  /** The geometrically exact answer, holding the drift so far. */
  exact: number;
}

export interface Scenario {
  technique: Technique;
  departure: LatLon;
  destination: LatLon;
  /** Planned track, departure→destination. */
  trackDeg: number;
  legNm: number;
  aircraft: LatLon;
  /** Whole-degree heading flown since departure (planned track + WCA). */
  flownHeading: number;
  minutesFlown: number;
  /** Groundspeed implied by the distance and the whole-minute time flown. */
  groundspeedKt: number;
  /** Track actually made good, departure→aircraft. */
  actualTrackDeg: number;
  alongNm: number;
  remainingNm: number;
  /** Positive right of track. */
  offTrackNm: number;
  /** 1-in-60 terms, each positive. */
  trackErrorDeg: number;
  closingAngleDeg: number;
  /** Quarter mark nearest the aircraft, and the fraction-of-leg multiplier there. */
  quartile: number;
  multiplier: number;
  /** Where the answer heads: the destination, or the rejoin point for `double`. */
  target: LatLon;
  questions: Question[];
}

export type Rng = () => number;

const uniform = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();

function randomLandPoint(rng: Rng): LatLon {
  for (;;) {
    const p = { lat: uniform(rng, LAND_BOUNDS.minLat, LAND_BOUNDS.maxLat), lon: uniform(rng, LAND_BOUNDS.minLon, LAND_BOUNDS.maxLon) };
    if (onLand(p)) return p;
  }
}

export function randomTechnique(rng: Rng = Math.random): Technique {
  return TECHNIQUE_IDS[Math.floor(rng() * TECHNIQUE_IDS.length)]!;
}

function randomAlongFraction(rng: Rng, technique: Technique): number | undefined {
  if (technique === "fraction") {
    return QUARTILES[Math.floor(rng() * QUARTILES.length)]! + uniform(rng, -QUARTILE_JITTER, QUARTILE_JITTER);
  }
  const f = uniform(rng, ALONG_FRACTION[technique].min, ALONG_FRACTION[technique].max);
  if (technique === "oneInSixty" && QUARTILES.some((q) => Math.abs(f - q) < QUARTILE_CLEARANCE)) return undefined;
  return f;
}

function ruleIsSound(s: Scenario): boolean {
  return s.questions.every((q) => (q.unit === "heading" ? Math.abs(norm180(q.rule - q.exact)) : Math.abs(q.rule - q.exact)) <= RULE_MAX_ERROR[q.unit]);
}

export function generateScenario(rng: Rng = Math.random, technique: Technique = randomTechnique(rng)): Scenario {
  for (;;) {
    const departure = randomLandPoint(rng);
    const legNm = uniform(rng, LEG_NM.min, LEG_NM.max);
    const destination = destinationPoint(departure, uniform(rng, 0, 360), legNm);
    if (!onLand(destination)) continue;
    const trackDeg = initialBearing(departure, destination);

    const fraction = randomAlongFraction(rng, technique);
    if (fraction === undefined) continue;
    const along = legNm * fraction;
    const errorDeg = uniform(rng, TRACK_ERROR_DEG.min, TRACK_ERROR_DEG.max) * (rng() < 0.5 ? -1 : 1);
    if (along * Math.tan(rad(Math.abs(errorDeg))) < MIN_OFF_TRACK_NM) continue;
    const flownNm = along / Math.cos(rad(errorDeg));
    const aircraft = destinationPoint(departure, trackDeg + errorDeg, flownNm);

    const flownHeading = Math.round(norm360(trackDeg + uniform(rng, -MAX_WCA_DEG, MAX_WCA_DEG))) || 360;
    const minutesFlown = Math.round((flownNm / uniform(rng, GROUNDSPEED_KT.min, GROUNDSPEED_KT.max)) * 60);
    if (minutesFlown < MIN_MINUTES_FLOWN) continue;

    const scenario = describeScenario(departure, destination, aircraft, flownHeading, minutesFlown, technique);
    if (ruleIsSound(scenario)) return scenario;
  }
}

/** Derives every scenario quantity from what a pilot would see, plus the technique under test. */
export function describeScenario(departure: LatLon, destination: LatLon, aircraft: LatLon, flownHeading: number, minutesFlown: number, technique: Technique): Scenario {
  const legNm = distanceNm(departure, destination);
  const trackDeg = initialBearing(departure, destination);
  const actualTrackDeg = initialBearing(departure, aircraft);
  const offTrackNm = crossTrackNm(departure, destination, aircraft);
  const alongNm = alongTrackNm(departure, destination, aircraft);
  const remainingNm = distanceNm(aircraft, destination);
  const groundspeedKt = (distanceNm(departure, aircraft) / minutesFlown) * 60;

  const trackErrorDeg = (60 * Math.abs(offTrackNm)) / alongNm;
  const closingAngleDeg = (60 * Math.abs(offTrackNm)) / remainingNm;
  const quartile = QUARTILES.reduce((best, q) => (Math.abs(q - alongNm / legNm) < Math.abs(best - alongNm / legNm) ? q : best));
  const multiplier = 1 / (1 - quartile);

  // Right of track means turning left, back towards it.
  const towards = -Math.sign(offTrackNm);
  const drift = norm180(actualTrackDeg - flownHeading);
  const headingTo = (from: LatLon, to: LatLon) => norm360(initialBearing(from, to) - drift);
  const turned = (angle: number) => norm360(flownHeading + towards * angle);

  const base = { technique, departure, destination, trackDeg, legNm, aircraft, flownHeading, minutesFlown, groundspeedKt, actualTrackDeg, alongNm, remainingNm, offTrackNm, trackErrorDeg, closingAngleDeg, quartile, multiplier };

  if (technique === "double") {
    const rejoin = destinationPoint(departure, trackDeg, 2 * alongNm);
    return {
      ...base,
      target: rejoin,
      questions: [
        { id: "regainHeading", label: "Regain heading", unit: "heading", rule: turned(2 * trackErrorDeg), exact: headingTo(aircraft, rejoin) },
        { id: "regainMinutes", label: "Minutes to regain", unit: "minutes", rule: minutesFlown, exact: (distanceNm(aircraft, rejoin) / groundspeedKt) * 60 },
        { id: "onTrackHeading", label: "Heading once on track", unit: "heading", rule: turned(trackErrorDeg), exact: headingTo(rejoin, destination) },
      ],
    };
  }

  const correction = technique === "fraction" ? trackErrorDeg * multiplier : trackErrorDeg + closingAngleDeg;
  return { ...base, target: destination, questions: [{ id: "heading", label: "New heading", unit: "heading", rule: turned(correction), exact: headingTo(aircraft, destination) }] };
}

export interface Grade {
  /** Signed answer − exact: degrees right of the exact heading, or minutes over. */
  error: number;
  ok: boolean;
}

export function gradeAnswer(answer: number, correctHeading: number): Grade {
  const error = norm180(answer - correctHeading);
  return { error, ok: Math.abs(error) <= TOLERANCE_DEG };
}

export function gradeMinutes(answer: number, exactMinutes: number): Grade {
  const error = answer - exactMinutes;
  return { error, ok: Math.abs(error) <= TIME_TOLERANCE_MIN };
}

export function gradeQuestion(question: Question, answer: number): Grade {
  return question.unit === "heading" ? gradeAnswer(answer, question.exact) : gradeMinutes(answer, question.exact);
}

export interface Segment {
  from: LatLon;
  to: LatLon;
}

export interface Label {
  at: LatLon;
  text: string;
}

export interface ChartPrep {
  fanLines: Segment[];
  bars: Segment[];
  labels: Label[];
}

export const FAN_ANGLE_DEG = 10;
/**
 * Fan line length as a fraction of the leg. Opposing fans meet mid-leg, at
 * 0.5 / cos 10° ≈ 0.508 along each line, so this lets them just cross.
 */
const FAN_REACH = 0.55;
/** Distance bars across the track: half-width in nm at each fraction of the leg. */
export const BARS = [
  { fraction: 0.25, nm: 2 },
  { fraction: 0.5, nm: 5 },
  { fraction: 0.75, nm: 2 },
];
/** Bar labels sit just beyond the bar's end. */
const LABEL_GAP_NM = 1;

/**
 * Chart-prep markings for a leg: 10° track-error fans out of the departure,
 * 10° closing-angle fans into the destination, and distance bars across the
 * track (see BARS).
 */
export function chartPrep(departure: LatLon, destination: LatLon): ChartPrep {
  const legNm = distanceNm(departure, destination);
  const track = initialBearing(departure, destination);
  const back = initialBearing(destination, departure);
  const reach = legNm * FAN_REACH;
  const fanLines: Segment[] = [];
  const bars: Segment[] = [];
  const labels: Label[] = [];

  for (const side of [-1, 1]) {
    const out = destinationPoint(departure, track + side * FAN_ANGLE_DEG, reach);
    const into = destinationPoint(destination, back + side * FAN_ANGLE_DEG, reach);
    fanLines.push({ from: departure, to: out }, { from: destination, to: into });
    labels.push({ at: out, text: String(FAN_ANGLE_DEG) }, { at: into, text: String(FAN_ANGLE_DEG) });
  }

  for (const { fraction, nm } of BARS) {
    const centre = destinationPoint(departure, track, legNm * fraction);
    bars.push({ from: destinationPoint(centre, track - 90, nm), to: destinationPoint(centre, track + 90, nm) });
    // One side only; the other is its mirror.
    labels.push({ at: destinationPoint(centre, track + 90, nm + LABEL_GAP_NM), text: String(nm) });
  }

  return { fanLines, bars, labels };
}
