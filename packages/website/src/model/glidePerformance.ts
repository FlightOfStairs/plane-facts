/**
 * PA-28-161 Warrior II — glide performance.
 * Reverse-engineered from POH Figure 5-33 (Report VB-1180, Aug 1982).
 * Constants from tools/digitize/out/fits/fig_5_33.json (line fit rms
 * 0.165% ≈ 20 ft). Study/planning tool only — not a substitute for the
 * POH/AFM.
 *
 * Associated conditions: 2440 lb, prop windmilling, flaps 0°, 73 KIAS,
 * no wind.
 *
 * The chart is a single straight line: still-air ground range is
 * altitude × L/D with no atmosphere dependence — flying a fixed IAS
 * schedule, TAS and sink rate scale together, so density cancels
 * (docs/FINDINGS.md "no atmosphere at all" family). Usage is the range
 * read at cruise PA minus the range read at terrain PA.
 */

// Fitted line: glide_range_nm(h) = (h_ft − B) / M
// From tools/digitize/out/fits/fig_5_33.json
const M_FT_PER_NM = 530.47;
const B_FT = -85.7;

/** L/D implied by the line slope: 6076.115 / 530.47 ≈ 11.45 (windmilling prop). */
export const GLIDE_RATIO = 6076.115 / M_FT_PER_NM;

/** Best-glide speed printed on the chart (2440 lb; scales as √W). */
export const BEST_GLIDE_KIAS = 73;

export interface GlideInputs {
  /** Cruise pressure altitude, ft (chart: 0–12,000) */
  cruisePressureAltitudeFt: number;
  /** Terrain pressure altitude, ft (chart: 0–12,000) */
  terrainPressureAltitudeFt: number;
}

export interface GlideResult {
  /** Chart range reading at cruise PA, nm */
  rangeCruiseNm: number;
  /** Chart range reading at terrain PA, nm */
  rangeTerrainNm: number;
  /** Still-air glide distance, nm */
  glideNm: number;
  /** L/D ≈ 11.45 (constant on this chart) */
  glideRatio: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

/** Chart range reading (nm) at a pressure altitude. */
export function glideRangeNm(pressureAltitudeFt: number): number {
  return (pressureAltitudeFt - B_FT) / M_FT_PER_NM;
}

export function glidePerformance(inp: GlideInputs): GlideResult {
  const rangeCruiseNm = glideRangeNm(inp.cruisePressureAltitudeFt);
  const rangeTerrainNm = glideRangeNm(inp.terrainPressureAltitudeFt);

  const warnings: string[] = [];
  if (inp.cruisePressureAltitudeFt < 0 || inp.cruisePressureAltitudeFt > 12000) warnings.push("cruise pressure altitude outside chart (0–12,000 ft)");
  if (inp.terrainPressureAltitudeFt < 0 || inp.terrainPressureAltitudeFt > 12000) warnings.push("terrain pressure altitude outside chart (0–12,000 ft)");
  if (inp.terrainPressureAltitudeFt >= inp.cruisePressureAltitudeFt) warnings.push("terrain is at or above cruise altitude — no glide range to compute");

  return {
    rangeCruiseNm,
    rangeTerrainNm,
    glideNm: rangeCruiseNm - rangeTerrainNm,
    glideRatio: GLIDE_RATIO,
    warnings,
  };
}

/**
 * The chart's own worked example: cruise 5000 ft, terrain 2000 ft →
 * POH prints 9.5 − 3.9 = 5.6 nm. Model: 9.59 − 3.93 = 5.66 nm (+1.0%).
 */
export const CHART_EXAMPLE: GlideInputs = {
  cruisePressureAltitudeFt: 5000,
  terrainPressureAltitudeFt: 2000,
};
