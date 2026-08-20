/**
 * PA-28-161 Warrior II — landing ground roll distance.
 * Reverse-engineered from POH Figure 5-37 (Report VB-1180, Aug 1982).
 * Fit rms 0.25% vs the digitized curves; reproduces the chart's printed
 * worked example within 0.9%. Study/planning tool only — not a substitute
 * for the POH/AFM.
 *
 * Associated conditions: power off, flaps 40°, paved level dry runway,
 * maximum braking.
 */

import { densityAltitudeFt, densityRatio } from "./atmosphere";
import { touchdownKias } from "./landingSpeeds";
import { warnRange, windCreditFactor } from "./shared";

export interface LandingGroundRollInputs {
  /** Pressure altitude, ft (chart: 0–7000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Landing weight, lb (chart: 1600–2440; ticks are labelled only to 1700) */
  weightLb: number;
  /** Wind component, kt. Positive = headwind (0–15), negative = tailwind (0–5). */
  windKt: number;
}

export interface LandingGroundRollResult {
  /** Final ground roll, ft */
  groundRollFt: number;
  /** Density-corrected distance at 2440 lb, zero wind (panel 1 output) */
  s0Ft: number;
  /** After weight correction (panel 2 output) */
  s1Ft: number;
  /** Wind correction factor (panel 3) */
  windFactor: number;
  /** Touchdown speed from the printed strip, KIAS */
  touchdownKias: number;
  /** Density ratio σ */
  sigma: number;
  /** Density altitude, ft */
  densityAltitudeFt: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

/**
 * Lowest weight the guide curves are drawn to. The scale's last *labelled*
 * tick is 1700, but the curves run one division further, to where the panel
 * ends on the wind reference line.
 */
export const CHART_MIN_WEIGHT_LB = 1600;

export const MLW_LB = 2440;

// Constants from tools/digitize/out/fits/fig_5_37.json (model.params).
const A = 594.4;
const B = 0.0198;
const C = 2.02;
const D = 9e-5;
const E = 5.73e-7;
const F = 0.0015;
const WEIGHT_EXPONENT = 0.96; // landing k≈1: KE ∝ W·Vs² ∝ W², braking ∝ W
const WIND_EXPONENT_HW = 1.9;
const WIND_EXPONENT_TW = 2.08;
const V_REF_KT = 45; // touchdown KIAS at 2440 lb; chart treats IAS ≈ TAS at SL

/**
 * Panel 1: ground roll at 2440 lb, zero wind. Quadratic surface in (PA, OAT)
 * fitted to the five altitude curves (rms 0.25%). Nearly a σ^−0.95 power
 * law — power-off landing scales ~1/σ (touchdown TAS²), no engine-lapse
 * anisotropy.
 */
export function baseGroundRollFt(pressureAltitudeFt: number, oatC: number): number {
  const pa = pressureAltitudeFt;
  return A + B * pa + C * oatC + D * pa * oatC + E * pa * pa + F * oatC * oatC;
}

export function landingGroundRoll(inp: LandingGroundRollInputs): LandingGroundRollResult {
  const { pressureAltitudeFt: pa, oatC, weightLb: w, windKt } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);

  const s0 = baseGroundRollFt(pa, oatC);
  const s1 = s0 * Math.pow(w / MLW_LB, WEIGHT_EXPONENT);

  const windFactor = windCreditFactor(windKt, V_REF_KT, WIND_EXPONENT_HW, WIND_EXPONENT_TW);

  const warnings: string[] = [];
  warnRange(warnings, pa, 0, 7000, "pressure altitude", "ft");
  warnRange(warnings, oatC, -40, 40, "OAT", "°C");
  warnRange(warnings, w, CHART_MIN_WEIGHT_LB, MLW_LB, "weight", "lb");
  if (windKt > 15) warnings.push("headwind outside chart (max 15 kt)");
  if (windKt < -5) warnings.push("tailwind outside chart (max 5 kt)");

  return {
    groundRollFt: s1 * windFactor,
    s0Ft: s0,
    s1Ft: s1,
    windFactor,
    touchdownKias: touchdownKias(w),
    sigma,
    densityAltitudeFt: da,
    warnings,
  };
}

/**
 * The chart's own worked example:
 * 2500 ft, 24 °C, 2179 lb, 0 kt → POH prints 625 ft ground roll.
 * Model gives ≈630 ft (+0.9%); chart's dashed trace carries S0 ≈ 698,
 * after-weight ≈ 625.
 */
export const CHART_EXAMPLE_5_37: LandingGroundRollInputs = {
  pressureAltitudeFt: 2500,
  oatC: 24,
  weightLb: 2179,
  windKt: 0,
};
