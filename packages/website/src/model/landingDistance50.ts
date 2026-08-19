/**
 * PA-28-161 Warrior II — landing distance over a 50-ft barrier.
 * Reverse-engineered from POH Figure 5-35 (Report VB-1180, Aug 1982).
 * Fit rms 0.23% vs the digitized curves; reproduces the chart's printed
 * worked example within 0.4%. Study/planning tool only — not a substitute
 * for the POH/AFM.
 *
 * Associated conditions: power off, flaps 40°, paved level dry runway,
 * maximum braking.
 */

import { densityAltitudeFt, densityRatio } from "./atmosphere";
import { approachKias, touchdownKias } from "./landingSpeeds";

export interface LandingDistance50Inputs {
  /** Pressure altitude, ft (chart: 0–7000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Landing weight, lb (chart: 1700–2440) */
  weightLb: number;
  /** Wind component, kt. Positive = headwind (0–15), negative = tailwind (0–5). */
  windKt: number;
}

export interface LandingDistance50Result {
  /** Final landing distance over the 50-ft barrier, ft */
  distanceOver50FtFt: number;
  /** Density-corrected distance at 2440 lb, zero wind (panel 1 output) */
  s0Ft: number;
  /** After weight correction (panel 2 output) */
  s1Ft: number;
  /** Wind correction factor (panel 3) */
  windFactor: number;
  /** Approach speed from the printed strip, KIAS */
  approachKias: number;
  /** Touchdown speed from the printed strip, KIAS */
  touchdownKias: number;
  /** Density ratio σ */
  sigma: number;
  /** Density altitude, ft */
  densityAltitudeFt: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

export const MLW_LB = 2440;

// Constants from tools/digitize/out/fits/fig_5_35.json (model.params).
const A = 1115.5;
const B = 0.0261;
const C = 2.73;
const D = 0.000134;
const E = 1.107e-6;
const F = -0.0008;
const WEIGHT_EXPONENT = 0.96; // landing k≈1: KE ∝ W·Vs² ∝ W², braking ∝ W
const WIND_EXPONENT_HW = 1.47;
const WIND_EXPONENT_TW = 1.7;
const V_REF_KT = 45; // touchdown KIAS at 2440 lb; chart treats IAS ≈ TAS at SL
const HEADWIND_CREDIT = 0.5; // certification policy: credit 50% of headwind
const TAILWIND_FACTOR = 1.5; // …and 150% of tailwind

/**
 * Panel 1: distance at 2440 lb, zero wind. Quadratic surface in (PA, OAT)
 * fitted to the five altitude curves (rms 0.23%). Nearly a σ^−0.73 power
 * law — power-off landing has none of the takeoff charts' engine-lapse
 * anisotropy.
 */
export function baseDistance50Ft(pressureAltitudeFt: number, oatC: number): number {
  const pa = pressureAltitudeFt;
  return A + B * pa + C * oatC + D * pa * oatC + E * pa * pa + F * oatC * oatC;
}

export function landingDistance50(inp: LandingDistance50Inputs): LandingDistance50Result {
  const { pressureAltitudeFt: pa, oatC, weightLb: w, windKt } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);

  const s0 = baseDistance50Ft(pa, oatC);
  const s1 = s0 * Math.pow(w / MLW_LB, WEIGHT_EXPONENT);

  let windFactor = 1;
  if (windKt > 0) {
    windFactor = Math.pow(1 - (HEADWIND_CREDIT * windKt) / V_REF_KT, WIND_EXPONENT_HW);
  } else if (windKt < 0) {
    windFactor = Math.pow(1 + (TAILWIND_FACTOR * -windKt) / V_REF_KT, WIND_EXPONENT_TW);
  }

  const warnings: string[] = [];
  if (pa < 0 || pa > 7000) warnings.push("pressure altitude outside chart (0–7000 ft)");
  if (oatC < -40 || oatC > 40) warnings.push("OAT outside chart (−40…+40 °C)");
  if (w < 1700 || w > MLW_LB) warnings.push("weight outside chart (1700–2440 lb)");
  if (windKt > 15) warnings.push("headwind outside chart (max 15 kt)");
  if (windKt < -5) warnings.push("tailwind outside chart (max 5 kt)");

  return {
    distanceOver50FtFt: s1 * windFactor,
    s0Ft: s0,
    s1Ft: s1,
    windFactor,
    approachKias: approachKias(w),
    touchdownKias: touchdownKias(w),
    sigma,
    densityAltitudeFt: da,
    warnings,
  };
}

/**
 * The chart's own worked example:
 * 2500 ft, 24 °C, 2179 lb, 0 kt → POH prints 1135 ft over the barrier.
 * Model gives ≈1131 ft (−0.4%); chart's dashed trace carries S0 ≈ 1270,
 * after-weight ≈ 1133.
 */
export const CHART_EXAMPLE_5_35: LandingDistance50Inputs = {
  pressureAltitudeFt: 2500,
  oatC: 24,
  weightLb: 2179,
  windKt: 0,
};
