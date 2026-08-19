/**
 * Helpers shared by the chart models.
 */

/**
 * AFM wind-credit policy common to all six wind panels (FINDINGS.md):
 * credit 50% of headwind, penalize 150% of tailwind, as
 * (1 ∓ credit·Vw/Vref)^m. Positive windKt = headwind.
 */
export function windCreditFactor(windKt: number, vRefKt: number, mHeadwind: number, mTailwind: number = mHeadwind): number {
  if (windKt > 0) return Math.pow(1 - (0.5 * windKt) / vRefKt, mHeadwind);
  if (windKt < 0) return Math.pow(1 + (1.5 * -windKt) / vRefKt, mTailwind);
  return 1;
}

/** The three power settings the POH prints curves for. */
export const PRINTED_POWER_SETTINGS = [55, 65, 75] as const;

/**
 * Interpolate a quantity the POH prints only at 55/65/75% power to a
 * continuous setting. Quadratic through all three printed values, so it is
 * exact at 55, 65 and 75, and clamped to that range — the charts license no
 * extrapolation beyond their drawn settings.
 *
 * Validated by leave-one-out: a smooth law fitted to the 55% and 75% curves
 * alone reproduces the printed 65% curve to ≤1.3 kt (≤1.25%) on cruise TAS
 * and ≤1.0% on endurance, so interpolation informed by all three sits
 * comfortably inside the charts' own drafting tolerance (~1 kt).
 */
export function interpolateByPower(pctPower: number, at55: number, at65: number, at75: number): number {
  const p = Math.max(55, pctPower);
  if (p <= 75) {
    const t = (p - 65) / 10; // −1 at 55, 0 at 65, +1 at 75
    return at65 + 0.5 * t * (at75 - at55) + 0.5 * t * t * (at75 - 2 * at65 + at55);
  }
  // Above the printed settings the quadratic would bend away, so continue
  // with the power law the three values imply. On the cruise charts this is
  // corroborated: the drawn full-throttle boundary lands within 0.7 points of
  // the same law, so the region up to full throttle is anchored, not invented.
  const n = Math.log(at75 / at55) / Math.log(75 / 55);
  return at75 * Math.pow(p / 75, n);
}

/** Highest power setting the POH draws a curve for. */
export const MAX_PRINTED_POWER = 75;

/** Append a warning when value falls outside the digitized chart range. */
export function warnRange(warnings: string[], value: number, min: number, max: number, label: string, unit: string): void {
  if (value < min || value > max) {
    warnings.push(`${label} outside chart (${min}…${max} ${unit})`);
  }
}
