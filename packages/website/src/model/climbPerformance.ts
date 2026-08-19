/**
 * PA-28-161 Warrior II — climb performance (rate of climb).
 * Reverse-engineered from POH Figure 5-17 (Report VB-1180, Aug 1982).
 * Reproduces the chart's printed worked example to −1.6%. Study/planning
 * tool only — not a substitute for the POH/AFM.
 *
 * Associated conditions: gross weight 2440 lb, full throttle, mixture
 * leaned per Lycoming instructions, 79 KIAS.
 */

import { densityAltitudeFt, densityRatio, isaTempC } from "./atmosphere";
import { warnRange } from "./shared";

export interface ClimbPerformanceInputs {
  /** Pressure altitude, ft (chart: 0–16000; high altitudes drawn only at cold OAT) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** POH note: reduce ROC by 40 fpm with the wheel fairings removed */
  wheelFairingsRemoved: boolean;
}

export interface ClimbPerformanceResult {
  /** Final rate of climb, fpm (after any wheel-fairing adjustment) */
  rocFpm: number;
  /** Chart fit before the fairing adjustment (primary (PA, OAT) fit) */
  rocChartFpm: number;
  /** Equivalent density-altitude collapse: 645.8 − 0.048888·DA (shared-ISA DA) */
  rocDaModelFpm: number;
  /** Density altitude, ft (shared ISA implementation) */
  densityAltitudeFt: number;
  /** Density ratio σ */
  sigma: number;
  /** ISA deviation, °C */
  isaDevC: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

// Constants from tools/digitize/out/fits/fig_5_17.json.
// Primary fit ROC = A0 + A1·PA + A2·OAT + A3·OAT² (rms 3.9 fpm, 1.22%);
// the pure-DA form below costs rms 5.6 fpm — both are exposed.
const A0 = 730.7;
const A1 = -0.060689;
const A2 = -5.9218;
const A3 = 0.00866;
export const DA_C0 = 645.8;
export const DA_C1 = -0.048888;
const WHEEL_FAIRINGS_REMOVED_FPM = -40;

/** Absolute ceiling implied by the DA collapse: ROC = 0 at DA ≈ 13,209 ft. */
export const ABSOLUTE_CEILING_DA_FT = -DA_C0 / DA_C1;

/** Primary chart fit: ROC (fpm) at 2440 lb from PA and OAT directly. */
export function rocChartFitFpm(pressureAltitudeFt: number, oatC: number): number {
  return A0 + A1 * pressureAltitudeFt + A2 * oatC + A3 * oatC * oatC;
}

export function climbPerformance(inp: ClimbPerformanceInputs): ClimbPerformanceResult {
  const { pressureAltitudeFt: pa, oatC } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);
  const isaDevC = oatC - isaTempC(pa);

  const rocChart = rocChartFitFpm(pa, oatC);
  const rocDa = DA_C0 + DA_C1 * da;
  const fairing = inp.wheelFairingsRemoved ? WHEEL_FAIRINGS_REMOVED_FPM : 0;
  const roc = rocChart + fairing;

  const warnings: string[] = [];
  warnRange(warnings, pa, 0, 16000, "pressure altitude", "ft");
  warnRange(warnings, oatC, -40, 40, "OAT", "°C");
  if (roc < 25) warnings.push("below the drawn ROC line (< 25 fpm) — effectively at the ceiling");
  else if (roc < 100) warnings.push("rate of climb below 100 fpm — marginal climb performance");

  return {
    rocFpm: roc,
    rocChartFpm: rocChart,
    rocDaModelFpm: rocDa + fairing,
    densityAltitudeFt: da,
    sigma,
    isaDevC,
    warnings,
  };
}

/**
 * The chart's own worked example:
 * 5000 ft, 16 °C → POH prints 340 fpm. Model gives ≈335 fpm (−1.6%).
 */
export const CHART_EXAMPLE: ClimbPerformanceInputs = {
  pressureAltitudeFt: 5000,
  oatC: 16,
  wheelFairingsRemoved: false,
};
