/**
 * PA-28-161 Warrior II — weight and balance (POH Section 6).
 *
 * Arithmetic, not a digitized chart: station arms and limits are quoted
 * figures, so this reproduces the POH exactly rather than to a fitted
 * tolerance. Study/planning tool only — not a substitute for the POH/AFM, and
 * the basic empty weight must come from the aircraft's own Weight and Balance
 * Record, not from the sample figures below.
 *
 * Limits: POH 2.13 Center of Gravity Limits (p2-4) and 2.11 Weight Limits
 * (p2-3a). Stations and the sample problem: Section 6, pages 6-11/6-12.
 */

/** Station arms, inches aft of datum (POH Fig 6-11 loading form). */
export const STATIONS = {
  frontSeats: 80.5,
  rearSeats: 118.1,
  fuel: 95.0,
  baggage: 142.8,
} as const;

/** Start, taxi and run-up allowance applied between ramp and take-off. */
export const FUEL_ALLOWANCE_LB = -7;
export const FUEL_ALLOWANCE_ARM_IN = 95.0;

export const MAX_USABLE_FUEL_USGAL = 48;

export type Category = "normal" | "utility";

export const LIMITS = {
  normal: {
    maxTakeoffLb: 2440,
    maxRampLb: 2447,
    maxBaggageLb: 200,
    /** Forward limit is 83.0 up to the break, then straight-line to the top. */
    fwdBreakLb: 1950,
    fwdAtBreakIn: 83.0,
    fwdAtMaxIn: 88.3,
    aftIn: 93.0,
  },
  utility: {
    maxTakeoffLb: 2020,
    maxRampLb: 2027,
    maxBaggageLb: 0,
    fwdBreakLb: 1950,
    fwdAtBreakIn: 83.0,
    fwdAtMaxIn: 83.8,
    aftIn: 93.0,
  },
} as const;

/**
 * What qualifying for the utility category actually buys. POH 2.15 Maneuver
 * Limits and 2.17 Flight Load Factors (both p2-4/2-5), and the "UTILITY
 * CATEGORY OPERATION ONLY" placard in 2.25.
 *
 * Spins are listed because this airframe prohibits them in *both* categories —
 * the placard says so explicitly, and assuming utility unlocks them is the
 * obvious wrong inference to draw from a permitted verdict.
 */
export const UTILITY_PRIVILEGES = ["Manoeuvres with bank angles over 60°: steep turns, lazy eights and chandelles — 111 KIAS entry speed for each.", "Positive limit load factor 4.4 G, against 3.8 G in the normal category.", "Spins stay prohibited in both categories, and no inverted manoeuvres are approved in either."] as const;

/**
 * Forward C.G. limit at a weight — the "cutout". Straight-line variation
 * between the tabulated points, per POH 2.13's own note.
 *
 * The printed envelope on Fig 6-15 bows slightly and reaches only C.G. 87.93
 * at max gross where the table says 88.3, so the drawing is marginally the
 * more permissive; the table governs here.
 */
export function forwardLimitIn(weightLb: number, category: Category): number {
  const L = LIMITS[category];
  if (weightLb <= L.fwdBreakLb) return L.fwdAtBreakIn;
  const t = (weightLb - L.fwdBreakLb) / (L.maxTakeoffLb - L.fwdBreakLb);
  return L.fwdAtBreakIn + t * (L.fwdAtMaxIn - L.fwdAtBreakIn);
}

/**
 * The forward limit as Fig 6-15 *draws* it. Its apex measures 87.93 in and is
 * labelled 88, where 2.13 tabulates 88.3 — the POH disagrees with itself by
 * 0.3 in at max gross. 2.13 governs (and is the more restrictive), but a load
 * landing in the gap looks legal on the chart, so it is called out explicitly.
 */
export const CHART_FWD_AT_MAX_IN = 88.0;

export function chartForwardLimitIn(weightLb: number, category: Category): number {
  const L = LIMITS[category];
  if (weightLb <= L.fwdBreakLb) return L.fwdAtBreakIn;
  const atMax = category === "normal" ? CHART_FWD_AT_MAX_IN : L.fwdAtMaxIn;
  const t = (weightLb - L.fwdBreakLb) / (L.maxTakeoffLb - L.fwdBreakLb);
  return L.fwdAtBreakIn + t * (atMax - L.fwdAtBreakIn);
}

export function aftLimitIn(category: Category): number {
  return LIMITS[category].aftIn;
}

export interface LoadItem {
  key: string;
  label: string;
  weightLb: number;
  armIn: number;
  momentInLb: number;
}

export interface StationPoint {
  weightLb: number;
  momentInLb: number;
  cgIn: number;
  /** Forward/aft limits at this weight, for the selected category. */
  fwdLimitIn: number;
  aftLimitIn: number;
  /** C.G. between the limits — independent of whether the weight is legal. */
  withinEnvelope: boolean;
  overWeight: boolean;
  /** Both conditions: the point is legal. */
  ok: boolean;
}

export interface WeightBalanceInputs {
  basicEmptyWeightLb: number;
  basicEmptyArmIn: number;
  frontSeatsLb: number;
  rearSeatsLb: number;
  fuelLb: number;
  baggageLb: number;
  category: Category;
  /**
   * Apply the start/taxi/run-up allowance between ramp and take-off. Defaults
   * to true, as the POH's own loading form does; omitting it simply makes
   * take-off equal ramp, which is the conservative reading.
   */
  includeTaxiAllowance?: boolean;
}

export interface WeightBalanceResult {
  rows: LoadItem[];
  /** Loaded, before the taxi allowance. */
  ramp: StationPoint;
  /** After the −7 lb start/taxi/run-up allowance — the certification point. */
  takeoff: StationPoint;
  /** Same load with the fuel burned off — the other end of the C.G. travel. */
  zeroFuel: StationPoint;
  /** Any point outside its envelope, or any weight over limit. */
  withinLimits: boolean;
  warnings: string[];
}

/** POH sample loading problem, Fig 6-9 (page 6-11) — used as the default. */
export const SAMPLE_PROBLEM: WeightBalanceInputs = {
  basicEmptyWeightLb: 1500,
  basicEmptyArmIn: 85.9,
  frontSeatsLb: 340,
  rearSeatsLb: 340,
  fuelLb: 267,
  baggageLb: 0,
  category: "normal",
};

/** The BEW figures printed in the POH sample — a placeholder, not an aircraft. */
export const PLACEHOLDER_BEW_LB = 1500;
export const PLACEHOLDER_BEW_ARM_IN = 85.9;

function point(
  weightLb: number,
  momentInLb: number,
  category: Category,
  /** Ramp is allowed 7 lb more than take-off — check each against its own cap. */
  maxWeightLb: number = LIMITS[category].maxTakeoffLb,
): StationPoint {
  const cgIn = weightLb === 0 ? 0 : momentInLb / weightLb;
  const fwd = forwardLimitIn(weightLb, category);
  const aft = aftLimitIn(category);
  const overWeight = weightLb > maxWeightLb;
  return {
    weightLb,
    momentInLb,
    cgIn,
    fwdLimitIn: fwd,
    aftLimitIn: aft,
    withinEnvelope: cgIn >= fwd && cgIn <= aft,
    overWeight,
    ok: cgIn >= fwd && cgIn <= aft && !overWeight,
  };
}

export function weightAndBalance(inp: WeightBalanceInputs): WeightBalanceResult {
  const { category } = inp;
  const L = LIMITS[category];

  const rows: LoadItem[] = [
    { key: "bew", label: "Basic empty weight", weightLb: inp.basicEmptyWeightLb, armIn: inp.basicEmptyArmIn },
    { key: "front", label: "Pilot & front passenger", weightLb: inp.frontSeatsLb, armIn: STATIONS.frontSeats },
    { key: "rear", label: "Rear passengers", weightLb: inp.rearSeatsLb, armIn: STATIONS.rearSeats },
    { key: "fuel", label: "Fuel", weightLb: inp.fuelLb, armIn: STATIONS.fuel },
    { key: "baggage", label: "Baggage", weightLb: inp.baggageLb, armIn: STATIONS.baggage },
  ].map((r) => ({ ...r, momentInLb: r.weightLb * r.armIn }));

  const rampWeight = rows.reduce((s, r) => s + r.weightLb, 0);
  const rampMoment = rows.reduce((s, r) => s + r.momentInLb, 0);
  const allowanceLb = inp.includeTaxiAllowance === false ? 0 : FUEL_ALLOWANCE_LB;
  const ramp = point(rampWeight, rampMoment, category, L.maxRampLb);
  const takeoff = point(rampWeight + allowanceLb, rampMoment + allowanceLb * FUEL_ALLOWANCE_ARM_IN, category);
  const zeroFuel = point(rampWeight - inp.fuelLb, rampMoment - inp.fuelLb * STATIONS.fuel, category);

  const warnings: string[] = [];
  const cat = category === "normal" ? "normal" : "utility";
  if (rampWeight > L.maxRampLb) {
    warnings.push(`ramp weight ${rampWeight.toFixed(1)} lb exceeds the ${cat} limit of ${L.maxRampLb} lb`);
  }
  if (takeoff.weightLb > L.maxTakeoffLb) {
    warnings.push(`take-off weight ${takeoff.weightLb.toFixed(1)} lb exceeds the ${cat} limit of ${L.maxTakeoffLb} lb`);
  }
  for (const [label, p] of [
    ["take-off", takeoff],
    ["ramp", ramp],
    ["zero fuel", zeroFuel],
  ] as const) {
    if (p.overWeight) continue; // already reported as a weight exceedance
    if (p.cgIn < p.fwdLimitIn) {
      // Inside the band where Fig 6-15 and 2.13 disagree, say so — otherwise
      // the chart appears to contradict the verdict.
      const drawn = chartForwardLimitIn(p.weightLb, category);
      const chartWouldAllow = p.cgIn >= drawn;
      warnings.push(`${label} C.G. ${p.cgIn.toFixed(1)} in is forward of the ${p.fwdLimitIn.toFixed(1)} in limit at ${Math.round(p.weightLb)} lb` + (chartWouldAllow ? ` — Fig 6-15 draws that limit at ${drawn.toFixed(1)} in, so the chart alone would show this inside the envelope; Section 2.13 governs` : ""));
    } else if (p.cgIn > p.aftLimitIn) {
      warnings.push(`${label} C.G. ${p.cgIn.toFixed(1)} in is aft of the ${p.aftLimitIn.toFixed(1)} in limit`);
    }
  }
  if (inp.baggageLb > L.maxBaggageLb) {
    warnings.push(category === "utility" ? "utility category permits no baggage" : `baggage ${Math.round(inp.baggageLb)} lb exceeds the ${L.maxBaggageLb} lb limit`);
  }
  if (category === "utility" && inp.rearSeatsLb > 0) {
    warnings.push("utility category permits no rear-seat passengers");
  }

  return {
    rows,
    ramp,
    takeoff,
    zeroFuel,
    withinLimits: takeoff.ok && ramp.ok && zeroFuel.ok,
    warnings,
  };
}
