/**
 * PA-28-161 Warrior II — stall speed vs gross weight, bank angle and flaps.
 * Reverse-engineered from POH Figure 5-5 (Report VB-1180, Aug 1982).
 * Constants from tools/digitize/out/fits/fig_5_05.json (fit rms 0.08–0.21 kt
 * per curve, 0.47% overall). Study/planning tool only — not a substitute for
 * the POH/AFM.
 *
 * Left panel: separate CAS (dash-dot) and IAS (solid) curves per flap
 * setting, quadratic in w = W/2440 — drawn shallower than √W near gross,
 * steepening to ~√W below ~2000 lb. Right panel: a universal bank fan,
 * V(φ) = V₀ / cos(φ)^0.499 — exact load-factor physics (n = 1/cos φ,
 * V ∝ √n) applied multiplicatively to any entry speed.
 */

export type StallFlaps = 0 | 40;

export interface StallInputs {
  /** Gross weight, lb (chart: 1600–2440) */
  weightLb: number;
  /** Bank angle, degrees (chart: 0–60) */
  bankDeg: number;
  /** Flap setting — the chart draws only 0° and 40° families */
  flaps: StallFlaps;
}

export interface StallResult {
  /** Stall speed at the given bank, KCAS */
  stallCasKt: number;
  /** Stall speed at the given bank, KIAS */
  stallIasKt: number;
  /** Left-panel (wings-level) stall speed, KCAS */
  wingsLevelCasKt: number;
  /** Left-panel (wings-level) stall speed, KIAS */
  wingsLevelIasKt: number;
  /** Load factor n = 1/cos φ */
  loadFactor: number;
  /** Bank fan multiplier cos(φ)^−0.499 */
  bankFactorApplied: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

export const MAX_WEIGHT_LB = 2440;
export const MIN_WEIGHT_LB = 1600;
export const MAX_BANK_DEG = 60;

/** Fitted bank-fan exponent — indistinguishable from the physical 0.5. */
const BANK_EXPONENT = 0.499;

interface Quad {
  c2: number;
  c1: number;
  c0: number;
}

/** Quadratics in w = W/2440, from fig_5_05.json model.params. */
const CURVES: Record<StallFlaps, { cas: Quad; ias: Quad }> = {
  0: {
    cas: { c2: -55.445, c1: 118.192, c0: -6.688 },
    ias: { c2: -43.564, c1: 102.683, c0: -8.669 },
  },
  40: {
    cas: { c2: -58.266, c1: 122.37, c0: -14.054 },
    ias: { c2: -52.972, c1: 117.228, c0: -20.167 },
  },
};

function evalQuad(q: Quad, w: number): number {
  return q.c2 * w * w + q.c1 * w + q.c0;
}

/** Right-panel fan multiplier: V(φ)/V₀ = cos(φ)^−0.499. */
export function bankFactor(bankDeg: number): number {
  return Math.pow(Math.cos((bankDeg * Math.PI) / 180), -BANK_EXPONENT);
}

export function stallSpeed(inp: StallInputs): StallResult {
  const { weightLb, bankDeg, flaps } = inp;
  const w = weightLb / MAX_WEIGHT_LB;
  const curves = CURVES[flaps];

  const wingsLevelCas = evalQuad(curves.cas, w);
  const wingsLevelIas = evalQuad(curves.ias, w);
  const f = bankFactor(bankDeg);

  const warnings: string[] = [];
  if (weightLb < MIN_WEIGHT_LB || weightLb > MAX_WEIGHT_LB) warnings.push("weight outside chart (1600–2440 lb)");
  if (bankDeg < 0 || bankDeg > MAX_BANK_DEG) warnings.push("bank angle outside chart (0–60°)");

  return {
    stallCasKt: wingsLevelCas * f,
    stallIasKt: wingsLevelIas * f,
    wingsLevelCasKt: wingsLevelCas,
    wingsLevelIasKt: wingsLevelIas,
    loadFactor: 1 / Math.cos((bankDeg * Math.PI) / 180),
    bankFactorApplied: f,
    warnings,
  };
}

/**
 * The chart's own worked example: 2170 lb, 20° bank, flaps 40° → POH prints
 * 44 KIAS. Model gives 43.5 KIAS (−1.1%) — the printed answer is 0.5–1 kt
 * generous against the chart's own drawn curves (see docs/FINDINGS.md).
 */
export const CHART_EXAMPLE: StallInputs = {
  weightLb: 2170,
  bankDeg: 20,
  flaps: 40,
};
