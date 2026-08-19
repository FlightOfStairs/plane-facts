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

/** Append a warning when value falls outside the digitized chart range. */
export function warnRange(warnings: string[], value: number, min: number, max: number, label: string, unit: string): void {
  if (value < min || value > max) {
    warnings.push(`${label} outside chart (${min}…${max} ${unit})`);
  }
}
