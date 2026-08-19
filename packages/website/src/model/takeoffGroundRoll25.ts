/**
 * PA-28-161 Warrior II — 25° flap takeoff ground roll.
 * Reverse-engineered from POH Figure 5-11 (Report VB-1180, Aug 1982).
 * Reproduces the chart to ~±3%. Study/planning tool only — not a
 * substitute for the POH/AFM.
 *
 * Associated conditions: paved level dry runway, full power before
 * brake release, flaps 25°.
 */

import { densityAltitudeFt, densityRatio, tasFromCas } from "./atmosphere";

export interface TakeoffInputs {
  /** Pressure altitude, ft (chart: 0–7000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Takeoff weight, lb (chart: 1700–2440) */
  weightLb: number;
  /** Wind component, kt. Positive = headwind (0–15), negative = tailwind (0–5). */
  windKt: number;
}

export interface TakeoffResult {
  /** Final ground roll, ft */
  groundRollFt: number;
  /** Density-corrected distance at 2440 lb, zero wind (panel 1 output) */
  s0Ft: number;
  /** After weight correction (panel 2 output) */
  s1Ft: number;
  /** Lift-off speed, KCAS ≈ KIAS */
  vLofKcas: number;
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

/**
 * Panel 1: distance at 2440 lb, zero wind. Empirical plane fitted to the
 * eight altitude curves (rms 1.1%). Deliberately NOT a σ-power law — see
 * CLAUDE.md for why (chart under-weights temperature vs DA equivalence,
 * consistent with carburetted power lapse P ∝ δ/√θ).
 */
export function baseDistanceFt(pressureAltitudeFt: number, oatC: number): number {
  return 812 + 0.188 * pressureAltitudeFt + 15.1 * oatC;
}

/** Lift-off speed, KCAS. V ∝ √W, anchored at 52 KIAS @ 2440 lb. */
export function liftoffKcas(weightLb: number): number {
  return 52 * Math.sqrt(weightLb / MTOW_LB);
}

const WEIGHT_EXPONENT = 1.85;
const WIND_EXPONENT = 1.55;
const HEADWIND_CREDIT = 0.5; // certification policy: credit 50% of headwind
const TAILWIND_FACTOR = 1.5; // …and 150% of tailwind

export function takeoffGroundRoll25(inp: TakeoffInputs): TakeoffResult {
  const { pressureAltitudeFt: pa, oatC, weightLb: w, windKt } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);

  const s0 = baseDistanceFt(pa, oatC);
  const s1 = s0 * Math.pow(w / MTOW_LB, WEIGHT_EXPONENT);

  const vCas = liftoffKcas(w);
  const vTas = tasFromCas(vCas, sigma);

  let windFactor = 1;
  if (windKt > 0) {
    windFactor = Math.pow(1 - (HEADWIND_CREDIT * windKt) / vTas, WIND_EXPONENT);
  } else if (windKt < 0) {
    windFactor = Math.pow(1 + (TAILWIND_FACTOR * -windKt) / vTas, WIND_EXPONENT);
  }

  const warnings: string[] = [];
  if (pa < 0 || pa > 7000) warnings.push("pressure altitude outside chart (0–7000 ft)");
  if (oatC < -40 || oatC > 40) warnings.push("OAT outside chart (−40…+40 °C)");
  if (w < 1700 || w > MTOW_LB) warnings.push("weight outside chart (1700–2440 lb)");
  if (windKt > 15) warnings.push("headwind outside chart (max 15 kt)");
  if (windKt < -5) warnings.push("tailwind outside chart (max 5 kt)");
  if (da > 7500) warnings.push(`density altitude ${Math.round(da)} ft — beyond drawn curves`);

  return {
    groundRollFt: s1 * windFactor,
    s0Ft: s0,
    s1Ft: s1,
    vLofKcas: vCas,
    vLofKtas: vTas,
    sigma,
    densityAltitudeFt: da,
    warnings,
  };
}

/**
 * The chart's own worked example:
 * 1500 ft, 27 °C, 2175 lb, 15 kt headwind → POH prints 975 ft, 48 KIAS.
 * Model gives ≈950 ft (−2.6%), V_LOF 49.1 KCAS; intermediate values match
 * the chart's dashed trace (S0 ≈ 1495, after-weight ≈ 1220).
 */
export const CHART_EXAMPLE: TakeoffInputs = {
  pressureAltitudeFt: 1500,
  oatC: 27,
  weightLb: 2175,
  windKt: 15,
};
