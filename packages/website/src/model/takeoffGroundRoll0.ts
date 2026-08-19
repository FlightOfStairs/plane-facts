/**
 * PA-28-161 Warrior II — 0° flap takeoff ground roll.
 * Reverse-engineered from POH Figure 5-7 (Report VB-1180, Aug 1982).
 * Constants from tools/digitize/out/fits/fig_5_07.json (panel-1 rms 1.6%,
 * panel-2 rms 1.0%). Study/planning tool only — not a substitute for the
 * POH/AFM.
 *
 * Associated conditions: paved level dry runway, full power before
 * brake release, flaps 0°.
 */

import { densityAltitudeFt, densityRatio, tasFromCas } from "./atmosphere";
import { warnRange } from "./shared";

export interface TakeoffRoll0Inputs {
  /** Pressure altitude, ft (chart: 0–6000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Takeoff weight, lb (chart: 1700–2440) */
  weightLb: number;
  /** Wind component, kt. Positive = headwind (0–15), negative = tailwind (0–5). */
  windKt: number;
}

export interface TakeoffRoll0Result {
  /** Final ground roll, ft */
  groundRollFt: number;
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
  /** Density ratio σ */
  sigma: number;
  /** Density altitude, ft */
  densityAltitudeFt: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

export const MTOW_LB = 2440;

// Fitted constants — tools/digitize/out/fits/fig_5_07.json
const S0_A = 865.0; // ft
const S0_B = 0.2113; // ft per ft PA
const S0_C = 17.76; // ft per °C (c/b = 84 ft PA per °C — same sub-DA anisotropy as Fig 5-11)
const WEIGHT_EXPONENT = 2.344; // vs 1.85 on the 25° flap chart — real POH content
// Smooth (Veff, m) wind form; robust factors f(5/10/15 kt HW) = 0.923/0.848/0.775, f(5 kt TW) = 1.259.
// Not expressible through the shared windCreditFactor: under the 50%/150% credit the two sides imply
// different reference speeds (93/2 = 46.5 kt headwind vs 28·1.5 = 42 kt tailwind), unique to this chart.
const HEADWIND_VEFF_KT = 93.0;
const HEADWIND_EXPONENT = 1.45;
const TAILWIND_VEFF_KT = 28.0;
const TAILWIND_EXPONENT = 1.4;

/** Panel 1: distance at 2440 lb, zero wind. Empirical plane (rms 1.6%). */
export function baseDistance0Ft(pressureAltitudeFt: number, oatC: number): number {
  return S0_A + S0_B * pressureAltitudeFt + S0_C * oatC;
}

/**
 * Lift-off speed, KIAS. V ∝ √W anchored at 52 KIAS @ 2440 lb (identical to
 * the 25° flap chart — aerodynamically suspect, but that is what is printed).
 * The printed strip labels run 1–1.5 kt below this at light weight.
 */
export function liftoff0Kias(weightLb: number): number {
  return 52 * Math.sqrt(weightLb / MTOW_LB);
}

export function takeoffGroundRoll0(inp: TakeoffRoll0Inputs): TakeoffRoll0Result {
  const { pressureAltitudeFt: pa, oatC, weightLb: w, windKt } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);

  const s0 = baseDistance0Ft(pa, oatC);
  const s1 = s0 * Math.pow(w / MTOW_LB, WEIGHT_EXPONENT);

  const vKias = liftoff0Kias(w);
  const vTas = tasFromCas(vKias, sigma);

  let windFactor = 1;
  if (windKt > 0) {
    windFactor = Math.pow(1 - windKt / HEADWIND_VEFF_KT, HEADWIND_EXPONENT);
  } else if (windKt < 0) {
    windFactor = Math.pow(1 + -windKt / TAILWIND_VEFF_KT, TAILWIND_EXPONENT);
  }

  const warnings: string[] = [];
  warnRange(warnings, pa, 0, 6000, "pressure altitude", "ft");
  warnRange(warnings, oatC, -40, 40, "OAT", "°C");
  warnRange(warnings, w, 1700, MTOW_LB, "weight", "lb");
  if (windKt > 15) warnings.push("headwind outside chart (max 15 kt)");
  if (windKt < -5) warnings.push("tailwind outside chart (max 5 kt)");

  return {
    groundRollFt: s1 * windFactor,
    s0Ft: s0,
    s1Ft: s1,
    windFactor,
    vLofKias: vKias,
    vLofKtas: vTas,
    sigma,
    densityAltitudeFt: da,
    warnings,
  };
}

/**
 * The chart's own worked example:
 * 1500 ft, 27 °C, 2316 lb, 15 kt headwind → POH prints 1150 ft, 50 KIAS.
 * Model gives ≈1139 ft (−0.9%), V_LOF 50.7 KIAS; intermediates match the
 * chart's dashed trace (S0 ≈ 1665, after-weight ≈ 1477).
 */
export const CHART_EXAMPLE_5_07: TakeoffRoll0Inputs = {
  pressureAltitudeFt: 1500,
  oatC: 27,
  weightLb: 2316,
  windKt: 15,
};
