/**
 * PA-28-161 Warrior II — 25° flap takeoff, total distance over a 50 ft
 * barrier. Reverse-engineered from POH Figure 5-13 (Report VB-1180,
 * Aug 1982). Constants from tools/digitize/out/fits/fig_5_13.json
 * (rms 1.06%). Study/planning tool only — not a substitute for the
 * POH/AFM.
 *
 * Associated conditions: paved level dry runway, full power before
 * brake release, flaps 25°.
 */

import { densityAltitudeFt, densityRatio, tasFromCas } from "./atmosphere";
import { warnRange, windCreditFactor } from "./shared";

export interface TakeoffOver50Flaps25Inputs {
  /** Pressure altitude, ft (chart: 0–7000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Takeoff weight, lb (chart: 1700–2440) */
  weightLb: number;
  /** Wind component, kt. Positive = headwind (0–15), negative = tailwind (0–5). */
  windKt: number;
}

export interface TakeoffOver50Flaps25Result {
  /** Final distance over the 50 ft barrier, ft */
  distanceOver50Ft: number;
  /** Density-corrected distance at 2440 lb, zero wind (panel 1 output) */
  s0Ft: number;
  /** After weight correction (panel 2 output) */
  s1Ft: number;
  /** Wind factor applied in panel 3 */
  windFactor: number;
  /** Lift-off speed, KIAS (≈ KCAS) */
  vLofKias: number;
  /** Lift-off speed, KTAS */
  vLofKtas: number;
  /** 50 ft barrier speed, KIAS (≈ KCAS) */
  v50Kias: number;
  /** 50 ft barrier speed, KTAS */
  v50Ktas: number;
  /** Density ratio σ */
  sigma: number;
  /** Density altitude, ft */
  densityAltitudeFt: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

export const MTOW_LB = 2440;

// Fitted constants — tools/digitize/out/fits/fig_5_13.json
// Panel 1 is NOT a plane in (PA, OAT) (unlike Fig 5-11): full quadratic
// needed for ~1% rms (a plane alone gives 3.8%).
const S0_A = 1312.8;
const S0_B = 0.2059;
const S0_C = 21.46;
const S0_D = 0.001865; // PA·OAT cross term
const S0_E = 1.2935e-5; // PA²
const S0_F = 0.0445; // OAT²
const WEIGHT_EXPONENT = 2.02;
// Wind panel reference speed (see windCreditFactor for the shared policy)
const V_REF_KIAS = 52.0;
const M_HW = 1.49;
const M_TW = 1.42; // weakly constrained (2 usable tailwind guides)

/**
 * Printed speed-strip anchors: LINEAR in weight (not √W as on Fig 5-11);
 * piecewise-linear interpolation reproduces every printed label exactly and
 * the worked example's 48/53 KIAS. Barrier ≈ 1.10 × lift-off throughout.
 */
const SPEED_WEIGHTS_LB = [2440, 2200, 2000, 1800, 1600] as const;
const LIFTOFF_KIAS = [52, 48, 46, 43, 40] as const;
const BARRIER_KIAS = [57, 53, 50, 47, 44] as const;

function interpSpeed(values: readonly number[], weightLb: number): number {
  const ws = SPEED_WEIGHTS_LB;
  if (weightLb >= ws[0]) return values[0]!;
  for (let i = 0; i < ws.length - 1; i++) {
    const w0 = ws[i]!;
    const w1 = ws[i + 1]!;
    if (weightLb <= w0 && weightLb >= w1) {
      const t = (weightLb - w0) / (w1 - w0);
      return values[i]! + t * (values[i + 1]! - values[i]!);
    }
  }
  return values[values.length - 1]!;
}

/** Panel 1: distance over 50 ft at 2440 lb, zero wind (rms 1.06%). */
export function baseDistanceOver50Flaps25Ft(pressureAltitudeFt: number, oatC: number): number {
  const pa = pressureAltitudeFt;
  return S0_A + S0_B * pa + S0_C * oatC + S0_D * pa * oatC + S0_E * pa * pa + S0_F * oatC * oatC;
}

/** Lift-off speed, KIAS — printed strip anchors, piecewise linear in W. */
export function liftoffOver50Flaps25Kias(weightLb: number): number {
  return interpSpeed(LIFTOFF_KIAS, weightLb);
}

/** 50 ft barrier speed, KIAS — printed strip anchors, piecewise linear in W. */
export function barrierFlaps25Kias(weightLb: number): number {
  return interpSpeed(BARRIER_KIAS, weightLb);
}

export function takeoffOver50Flaps25(inp: TakeoffOver50Flaps25Inputs): TakeoffOver50Flaps25Result {
  const { pressureAltitudeFt: pa, oatC, weightLb: w, windKt } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);

  const s0 = baseDistanceOver50Flaps25Ft(pa, oatC);
  const s1 = s0 * Math.pow(w / MTOW_LB, WEIGHT_EXPONENT);

  const vLof = liftoffOver50Flaps25Kias(w);
  const v50 = barrierFlaps25Kias(w);

  const windFactor = windCreditFactor(windKt, V_REF_KIAS, M_HW, M_TW);

  const warnings: string[] = [];
  warnRange(warnings, pa, 0, 7000, "pressure altitude", "ft");
  warnRange(warnings, oatC, -40, 40, "OAT", "°C");
  warnRange(warnings, w, 1700, MTOW_LB, "weight", "lb");
  if (windKt > 15) warnings.push("headwind outside chart (max 15 kt)");
  if (windKt < -5) warnings.push("tailwind outside chart (max 5 kt)");
  const final = s1 * windFactor;
  if (final > 4000) warnings.push("distance beyond the drawn chart (max 4000 ft)");

  return {
    distanceOver50Ft: final,
    s0Ft: s0,
    s1Ft: s1,
    windFactor,
    vLofKias: vLof,
    vLofKtas: tasFromCas(vLof, sigma),
    v50Kias: v50,
    v50Ktas: tasFromCas(v50, sigma),
    sigma,
    densityAltitudeFt: da,
    warnings,
  };
}

/**
 * The chart's own worked example:
 * 1500 ft, 27 °C, 2175 lb, 15 kt headwind → POH prints 1500 ft, 48 KIAS
 * lift-off, 53 KIAS barrier. Model gives ≈1470 ft (−1.9%), speeds
 * 47.8 / 52.6 KIAS; intermediates match the chart's dashed trace
 * (S0 ≈ 2345, after-weight ≈ 1873) to <1%.
 */
export const CHART_EXAMPLE_5_13: TakeoffOver50Flaps25Inputs = {
  pressureAltitudeFt: 1500,
  oatC: 27,
  weightLb: 2175,
  windKt: 15,
};
