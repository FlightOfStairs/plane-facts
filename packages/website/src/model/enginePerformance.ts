/**
 * PA-28-161 Warrior II — engine performance: cruise RPM and fuel flow.
 * Reverse-engineered from POH Figure 5-15 (Report VB-1180, Aug 1982).
 * Constants from tools/digitize/out/fits/fig_5_15.json (right-panel rms
 * 1.4 RPM, worked example −0.01%). Study/planning tool only — not a
 * substitute for the POH/AFM.
 *
 * Associated conditions: best power mixture per Section 4 instructions,
 * wheel fairings installed.
 *
 * Chart structure: the left panel is exactly a density-altitude converter
 * (one chart major square u = ~2000 ft of DA); the right panel's %-rated-
 * power lines are straight and parallel in (RPM, DA) — Piper's
 * linearization of the fixed-pitch prop absorption law N ∝ (P/σ)^(1/3).
 */

import { densityAltitudeFt, densityRatio } from "./atmosphere";

export interface EnginePerformanceInputs {
  /** Pressure altitude, ft (chart: −2000…16000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Percent rated power (chart lines at 55/65/75; continuous in between) */
  pctPower: number;
}

export interface EnginePerformanceResult {
  /** Engine speed for the requested %power at this density altitude */
  rpm: number;
  /** Fuel flow, GPH, best-power mixture (POH table, at snapped %power) */
  fuelFlowBestPowerGph: number;
  /** Fuel flow, GPH, best-economy mixture (POH table, at snapped %power) */
  fuelFlowBestEconomyGph: number;
  /** Nearest POH table column (fuel-flow table lists only 55/65/75) */
  snappedPctPower: 55 | 65 | 75;
  /** Density altitude, ft */
  densityAltitudeFt: number;
  /** Density ratio σ */
  sigma: number;
  /** Chart y-coordinate, major squares above the bottom border (≈ DA/2000) */
  u: number;
  /** Sea-level RPM intercept a(p) for the requested %power */
  aP: number;
  /** Full-throttle availability ceiling for this %power, ft DA */
  fullThrottleCeilingDaFt: number;
  /** True if the requested %power is not reachable at this DA (full throttle) */
  fullThrottleLimited: boolean;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

// ---- constants from tools/digitize/out/fits/fig_5_15.json ------------------

/** Sea-level (DA 0) RPM intercepts of the three printed %power lines. */
export const A_P: Record<55 | 65 | 75, number> = { 55: 2196.6, 65: 2336.8, 75: 2480.3 };

/** Common slope of the %power lines, RPM per ft of density altitude. */
export const RPM_PER_FT = 0.02306;

/** Left panel: u (major squares) = LEFT_INTERCEPT_U + DA / LEFT_FT_PER_UNIT. */
export const LEFT_INTERCEPT_U = 0.0135;
export const LEFT_FT_PER_UNIT = 2006.9;

/** POH fuel-flow table, GPH (printed on the chart; defined only at 55/65/75). */
export const FUEL_FLOW_GPH: Record<"bestPower" | "bestEconomy", Record<55 | 65 | 75, number>> = {
  bestPower: { 55: 7.8, 65: 8.8, 75: 10.0 },
  bestEconomy: { 55: 6.6, 65: 7.5, 75: 8.5 },
};

/**
 * Upper endpoints of the drawn %power lines (envelope.curveEndpoints):
 * where full-throttle can no longer produce that power. 75% ends at
 * DA 8008 ft / 2665 RPM — a 0.5% match to a Gagg–Ferrar-like lapse
 * (N/2700)·δ/√θ = 0.754. The 55% line runs to the chart top (no interior
 * endpoint), so its value is the chart limit, not a physical ceiling.
 */
export const FULL_THROTTLE_CEILING_DA_FT: Record<55 | 65 | 75, number> = { 55: 15977, 65: 13535, 75: 8008 };

export const RPM_REDLINE = 2700;
const PCT_ANCHORS: readonly (55 | 65 | 75)[] = [55, 65, 75];

/** Piecewise-linear interpolation through the three %power anchors. */
function interpPct(table: Record<55 | 65 | 75, number>, pct: number): number {
  if (pct <= 65) return table[55] + ((table[65] - table[55]) * (pct - 55)) / 10;
  return table[65] + ((table[75] - table[65]) * (pct - 65)) / 10;
}

/** Sea-level RPM intercept a(p), linear between the printed 55/65/75 lines. */
export function aOfP(pctPower: number): number {
  return interpPct(A_P, pctPower);
}

export function enginePerformance(inp: EnginePerformanceInputs): EnginePerformanceResult {
  const { pressureAltitudeFt: pa, oatC, pctPower } = inp;

  const sigma = densityRatio(pa, oatC);
  const da = densityAltitudeFt(sigma);
  const u = LEFT_INTERCEPT_U + da / LEFT_FT_PER_UNIT;

  const aP = aOfP(pctPower);
  const rpm = aP + RPM_PER_FT * da;

  const snapped = PCT_ANCHORS.reduce((best, p) => (Math.abs(p - pctPower) < Math.abs(best - pctPower) ? p : best), PCT_ANCHORS[0]!);

  const ceiling = interpPct(FULL_THROTTLE_CEILING_DA_FT, pctPower);
  const limited = da > ceiling;

  const warnings: string[] = [];
  if (pa < -2000 || pa > 16000) warnings.push("pressure altitude outside chart (−2000…16000 ft)");
  if (oatC < -40 || oatC > 40) warnings.push("OAT outside chart (−40…+40 °C)");
  if (pctPower < 55 || pctPower > 75) warnings.push("percent power outside chart lines (55–75%)");
  if (da < 0) warnings.push(`density altitude ${Math.round(da)} ft — below the chart's sea-level bottom border`);
  if (da > 16000) warnings.push(`density altitude ${Math.round(da)} ft — above the chart top (16,000 ft)`);
  if (limited) warnings.push(`${Math.round(pctPower)}% power is not available at full throttle above ` + `~${Math.round(ceiling / 10) * 10} ft density altitude (the printed curve ends there)`);
  if (rpm > RPM_REDLINE) warnings.push(`computed ${Math.round(rpm)} RPM exceeds the 2700 RPM redline`);

  return {
    rpm,
    fuelFlowBestPowerGph: FUEL_FLOW_GPH.bestPower[snapped],
    fuelFlowBestEconomyGph: FUEL_FLOW_GPH.bestEconomy[snapped],
    snappedPctPower: snapped,
    densityAltitudeFt: da,
    sigma,
    u,
    aP,
    fullThrottleCeilingDaFt: ceiling,
    fullThrottleLimited: limited,
    warnings,
  };
}

/**
 * The chart's own worked example:
 * 5000 ft, 16 °C, 75% power → POH prints 2625 RPM, 10.0 / 8.5 GPH.
 * Model: DA 6263 ft, 2624.7 RPM (−0.01%).
 */
export const CHART_EXAMPLE: EnginePerformanceInputs = {
  pressureAltitudeFt: 5000,
  oatC: 16,
  pctPower: 75,
};
