/**
 * PA-28-161 Warrior II — 0° flap takeoff, total distance over a 50 ft
 * barrier. Reverse-engineered from POH Figure 5-9 (Report VB-1180,
 * Aug 1982). Constants from tools/digitize/out/fits/fig_5_09.json
 * (panel rms 0.7–1.1%). Study/planning tool only — not a substitute for
 * the POH/AFM.
 *
 * Associated conditions: paved level dry runway, full power before
 * brake release, flaps 0°.
 */

import { densityAltitudeFt, densityRatio, tasFromCas } from "./atmosphere";

export interface TakeoffOver50Flaps0Inputs {
  /** Pressure altitude, ft (chart: 0–7000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Takeoff weight, lb (chart: 1700–2440) */
  weightLb: number;
  /** Wind component, kt. Positive = headwind (0–15), negative = tailwind (0–5). */
  windKt: number;
}

export interface TakeoffOver50Flaps0Result {
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

// Fitted constants — tools/digitize/out/fits/fig_5_09.json
// Panel 1: S0 = (e0 + e1·PA + e2·PA²) + (f0 + f1·PA)·OAT
const E0 = 1674.4;
const E1 = 0.26052;
const E2 = 1.1349e-5;
const F0 = 22.918;
const F1 = 0.0018154;
// Panel 2: fW = exp((kwA + kwC·ln(S0/2500))·u + kwB·u² + kwD·u³), u = ln(W/2440)
// (local weight exponent drifts ~1.9 → 2.6 toward light weight — NOT a power law)
const KW_A = 2.042;
const KW_B = -3.183;
const KW_C = -0.417;
const KW_D = -4.568;
// Panel 3: certification wind policy (50% headwind / 150% tailwind credit) vs
// 57 KIAS, with distance-dependent exponents.
const V_REF_KT = 57.0;
// oxlint-disable-next-line approx-constant -- fitted exponent, coincidentally ≈ log2(e)
const M_HW0 = 1.442;
const M_HW1 = -0.227;
const M_TW0 = 1.618;
const M_TW1 = -0.559;
const D_REF_FT = 2500;
// Speed strips: LINEAR in weight (not √W) on this chart
const LOF_INTERCEPT = 17.91;
const LOF_SLOPE = 0.01388; // kt per lb
const BAR_INTERCEPT = 19.26;
const BAR_SLOPE = 0.0154; // kt per lb

/** Panel 1: distance over 50 ft at 2440 lb, zero wind (rms 0.95%). */
export function baseDistanceOver50Flaps0Ft(pressureAltitudeFt: number, oatC: number): number {
  const pa = pressureAltitudeFt;
  return E0 + E1 * pa + E2 * pa * pa + (F0 + F1 * pa) * oatC;
}

/** Panel 2 weight factor for a panel-1 distance s0Ft (rms 0.87%). */
export function weightFactorFlaps0(weightLb: number, s0Ft: number): number {
  const u = Math.log(weightLb / MTOW_LB);
  return Math.exp((KW_A + KW_C * Math.log(s0Ft / D_REF_FT)) * u + KW_B * u * u + KW_D * u * u * u);
}

/** Lift-off speed, KIAS — linear strip fit (matches printed labels ±0.5 kt). */
export function liftoffOver50Flaps0Kias(weightLb: number): number {
  return LOF_INTERCEPT + LOF_SLOPE * weightLb;
}

/** 50 ft barrier speed, KIAS — linear strip fit. */
export function barrierFlaps0Kias(weightLb: number): number {
  return BAR_INTERCEPT + BAR_SLOPE * weightLb;
}

export function takeoffOver50Flaps0(inp: TakeoffOver50Flaps0Inputs): TakeoffOver50Flaps0Result {
  const { pressureAltitudeFt: pa, oatC, weightLb: w, windKt } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);

  const s0 = baseDistanceOver50Flaps0Ft(pa, oatC);
  const s1 = s0 * weightFactorFlaps0(w, s0);

  const vLof = liftoffOver50Flaps0Kias(w);
  const v50 = barrierFlaps0Kias(w);

  let windFactor = 1;
  if (windKt > 0) {
    const m = M_HW0 + M_HW1 * Math.log(s1 / D_REF_FT);
    windFactor = Math.pow(1 - (0.5 * windKt) / V_REF_KT, m);
  } else if (windKt < 0) {
    const m = M_TW0 + M_TW1 * Math.log(s1 / D_REF_FT);
    windFactor = Math.pow(1 + (1.5 * -windKt) / V_REF_KT, m);
  }

  const warnings: string[] = [];
  if (pa < 0 || pa > 7000) warnings.push("pressure altitude outside chart (0–7000 ft)");
  if (oatC < -40 || oatC > 40) warnings.push("OAT outside chart (−40…+40 °C)");
  if (w < 1700 || w > MTOW_LB) warnings.push("weight outside chart (1700–2440 lb)");
  if (windKt > 15) warnings.push("headwind outside chart (max 15 kt)");
  if (windKt < -5) warnings.push("tailwind outside chart (max 5 kt)");
  const final = s1 * windFactor;
  if (final > 4700) warnings.push("distance beyond the drawn chart (max ≈4700 ft)");

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
 * 1500 ft, 27 °C, 2316 lb, 15 kt headwind → POH prints 2100 ft, 50 KIAS
 * lift-off, 55 KIAS barrier. Model gives ≈2029 ft (−3.4%): the printed
 * dashed trace itself sits 1–2.5% above the chart's own guide curves, so
 * the smooth fit lands low. Speeds: 50.1 / 54.9 KIAS.
 */
export const CHART_EXAMPLE_5_09: TakeoffOver50Flaps0Inputs = {
  pressureAltitudeFt: 1500,
  oatC: 27,
  weightLb: 2316,
  windKt: 15,
};
