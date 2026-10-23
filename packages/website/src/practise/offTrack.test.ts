import { describe, expect, test } from "vitest";
import type { Question, Rng, Scenario, Technique } from "./offTrack";
import { alongTrackNm, chartPrep, crossTrackNm, describeScenario, destinationPoint, distanceNm, formatHeading, generateScenario, gradeAnswer, gradeMinutes, initialBearing, LEG_NM, MAX_WCA_DEG, MIN_OFF_TRACK_NM, norm180, onLand, randomTechnique, TRACK_ERROR_DEG } from "./offTrack";

/** mulberry32: small seeded PRNG so generated scenarios are reproducible. */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EDINBURGH = { lat: 55.95, lon: -3.3725 };
const ABERDEEN = { lat: 57.2019, lon: -2.1978 };

describe("spherical geometry", () => {
  test("Edinburgh to Aberdeen airports", () => {
    // 75.1 nm north and 38.8 nm east: a 27.3° mid-latitude track, so the
    // initial great-circle bearing starts a little north of that.
    expect(distanceNm(EDINBURGH, ABERDEEN)).toBeCloseTo(84.4, 0);
    expect(initialBearing(EDINBURGH, ABERDEEN)).toBeCloseTo(26.8, 1);
  });

  test("destinationPoint inverts distance and bearing", () => {
    const p = destinationPoint(EDINBURGH, 300, 40);
    expect(distanceNm(EDINBURGH, p)).toBeCloseTo(40, 6);
    expect(initialBearing(EDINBURGH, p)).toBeCloseTo(300, 6);
  });

  test("cross-track is positive right of track, along-track is the foot of the perpendicular", () => {
    const foot = destinationPoint(EDINBURGH, initialBearing(EDINBURGH, ABERDEEN), 30);
    const right = destinationPoint(foot, initialBearing(EDINBURGH, ABERDEEN) + 90, 4);
    expect(crossTrackNm(EDINBURGH, ABERDEEN, right)).toBeCloseTo(4, 1);
    expect(alongTrackNm(EDINBURGH, ABERDEEN, right)).toBeCloseTo(30, 1);
  });

  test("angles wrap", () => {
    expect(norm180(350)).toBe(-10);
    expect(formatHeading(0)).toBe("360°");
    expect(formatHeading(359.6)).toBe("360°");
    expect(formatHeading(7.2)).toBe("007°");
  });
});

describe("land mask", () => {
  test("knows land from sea", () => {
    expect(onLand({ lat: 56.4, lon: -3.4 })).toBe(true); // Perth
    expect(onLand({ lat: 56.5, lon: -1.5 })).toBe(false); // North Sea
    expect(onLand({ lat: 54.5, lon: -2 })).toBe(false); // England
  });
});

const ruleError = (q: Question) => (q.unit === "heading" ? Math.abs(norm180(q.rule - q.exact)) : Math.abs(q.rule - q.exact));

describe("generated scenarios", () => {
  const rng = seeded(42);
  const generate = (t: Technique) => Array.from({ length: 150 }, () => generateScenario(rng, t));
  const byTechnique: Record<Technique, Scenario[]> = { fraction: generate("fraction"), double: generate("double"), oneInSixty: generate("oneInSixty") };
  const all = Object.values(byTechnique).flat();

  test("meet the drill's constraints", () => {
    for (const s of all) {
      expect(onLand(s.departure)).toBe(true);
      expect(onLand(s.destination)).toBe(true);
      expect(s.legNm).toBeGreaterThanOrEqual(LEG_NM.min - 1e-6);
      expect(s.legNm).toBeLessThanOrEqual(LEG_NM.max + 1e-6);
      expect(Math.abs(s.offTrackNm)).toBeGreaterThanOrEqual(MIN_OFF_TRACK_NM - 0.01);
      const errorDeg = Math.abs(norm180(s.actualTrackDeg - s.trackDeg));
      expect(errorDeg).toBeGreaterThanOrEqual(TRACK_ERROR_DEG.min - 0.01);
      expect(errorDeg).toBeLessThanOrEqual(TRACK_ERROR_DEG.max + 0.01);
      expect(Math.abs(norm180(s.flownHeading - s.trackDeg))).toBeLessThanOrEqual(MAX_WCA_DEG + 0.5);
      expect(Number.isInteger(s.flownHeading)).toBe(true);
      expect(s.flownHeading).toBeGreaterThanOrEqual(1);
      expect(s.flownHeading).toBeLessThanOrEqual(360);
      expect(Number.isInteger(s.minutesFlown)).toBe(true);
      expect((s.minutesFlown * s.groundspeedKt) / 60).toBeCloseTo(distanceNm(s.departure, s.aircraft), 6);
    }
  });

  test("applying the technique's rule always lands well inside tolerance", () => {
    for (const s of all) {
      for (const q of s.questions) expect(ruleError(q)).toBeLessThanOrEqual(q.unit === "heading" ? 1.5 : 0.5);
    }
  });

  test("fraction-of-leg places the aircraft abeam a quarter mark", () => {
    for (const s of byTechnique.fraction) {
      expect(Math.abs(s.alongNm / s.legNm - s.quartile)).toBeLessThan(0.025);
      expect(s.target).toBe(s.destination);
    }
  });

  test("1-in-60 keeps clear of the quarter marks", () => {
    for (const s of byTechnique.oneInSixty) {
      expect(Math.abs(s.alongNm / s.legNm - s.quartile)).toBeGreaterThan(0.05);
      expect(s.target).toBe(s.destination);
    }
  });

  test("double track error rejoins the track at twice the distance flown, on the leg", () => {
    for (const s of byTechnique.double) {
      expect(s.questions.map((q) => q.id)).toEqual(["regainHeading", "regainMinutes", "onTrackHeading"]);
      expect(crossTrackNm(s.departure, s.destination, s.target)).toBeCloseTo(0, 6);
      expect(alongTrackNm(s.departure, s.destination, s.target)).toBeCloseTo(2 * s.alongNm, 6);
      expect(2 * s.alongNm).toBeLessThan(s.legNm);
    }
  });

  test("random technique picks every technique", () => {
    const picked = new Set(Array.from({ length: 60 }, () => randomTechnique(rng)));
    expect([...picked].sort()).toEqual(["double", "fraction", "oneInSixty"]);
  });
});

describe("describeScenario", () => {
  const track = initialBearing(EDINBURGH, ABERDEEN);
  /** `nm` right of track, `along` nm down it, having flown planned track + 10° WCA for `minutes`. */
  const at = (along: number, nm: number, technique: Technique, minutes = 12) => describeScenario(EDINBURGH, ABERDEEN, destinationPoint(destinationPoint(EDINBURGH, track, along), track + 90, nm), Math.round(track) + 10, minutes, technique);

  test("1-in-60: right of track turns left by track error plus closing angle", () => {
    const s = at(20, 2, "oneInSixty");
    expect(s.trackErrorDeg).toBeCloseTo(6, 1);
    expect(s.closingAngleDeg).toBeCloseTo(120 / s.remainingNm, 1);
    const [q] = s.questions;
    expect(norm180(q!.rule - s.flownHeading)).toBeCloseTo(-(s.trackErrorDeg + s.closingAngleDeg), 6);
    expect(ruleError(q!)).toBeLessThan(1);
  });

  test("fraction of leg: at half way, double the track error", () => {
    const s = at(distanceNm(EDINBURGH, ABERDEEN) / 2, 3, "fraction");
    expect(s.quartile).toBe(0.5);
    expect(s.multiplier).toBe(2);
    expect(norm180(s.questions[0]!.rule - s.flownHeading)).toBeCloseTo(-2 * s.trackErrorDeg, 6);
  });

  test("double track error: 2×TE for the time flown, then turn back TE", () => {
    const s = at(20, -2, "double", 14);
    const [regain, minutes, onTrack] = s.questions;
    expect(norm180(regain!.rule - s.flownHeading)).toBeCloseTo(2 * s.trackErrorDeg, 6);
    expect(minutes!.rule).toBe(14);
    expect(minutes!.exact).toBeCloseTo(14, 0);
    expect(norm180(onTrack!.rule - s.flownHeading)).toBeCloseTo(s.trackErrorDeg, 6);
    for (const q of s.questions) expect(ruleError(q)).toBeLessThan(1);
  });
});

describe("grading", () => {
  test("headings wrap across north", () => {
    expect(gradeAnswer(358, 1)).toEqual({ error: -3, ok: true });
    expect(gradeAnswer(5, 1)).toEqual({ error: 4, ok: false });
    expect(gradeAnswer(360, 0.4).ok).toBe(true);
  });

  test("minutes allow one either way", () => {
    expect(gradeMinutes(13, 14).ok).toBe(true);
    expect(gradeMinutes(15, 14).ok).toBe(true);
    expect(gradeMinutes(16, 14.9).ok).toBe(false);
  });
});

describe("chartPrep", () => {
  const prep = chartPrep(EDINBURGH, ABERDEEN);
  const legNm = distanceNm(EDINBURGH, ABERDEEN);
  const fractionAlong = (p: Parameters<typeof alongTrackNm>[2]) => alongTrackNm(EDINBURGH, ABERDEEN, p) / legNm;

  test("10° fans from each end run just past where they cross, mid-leg", () => {
    expect(prep.fanLines).toHaveLength(4);
    for (const fan of prep.fanLines) {
      const startsAtDeparture = distanceNm(fan.from, EDINBURGH) < 1e-6;
      // Fraction of the leg each fan covers, measured from its own end.
      const covered = startsAtDeparture ? fractionAlong(fan.to) : 1 - fractionAlong(fan.to);
      expect(covered).toBeGreaterThan(0.5);
      expect(covered).toBeLessThan(0.56);
    }
  });

  test("plain 2/5/2 nm bars across the track at ¼, ½, ¾, labelled on one side", () => {
    expect(prep.bars.map((b) => distanceNm(b.from, b.to))).toEqual([expect.closeTo(4, 3), expect.closeTo(10, 3), expect.closeTo(4, 3)]);
    const centreOf = (b: (typeof prep.bars)[number]) => destinationPoint(b.from, initialBearing(b.from, b.to), distanceNm(b.from, b.to) / 2);
    expect(prep.bars.map((b) => fractionAlong(centreOf(b)))).toEqual([expect.closeTo(0.25, 3), expect.closeTo(0.5, 3), expect.closeTo(0.75, 3)]);
    expect(Math.abs(norm180(initialBearing(prep.bars[1]!.from, prep.bars[1]!.to) - initialBearing(EDINBURGH, ABERDEEN)))).toBeCloseTo(90, 0);
    expect(prep.labels.map((l) => l.text).sort()).toEqual(["10", "10", "10", "10", "2", "2", "5"]);
  });
});
