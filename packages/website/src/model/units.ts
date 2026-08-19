/**
 * Unit conversions — single source of truth. Model modules work in the POH's
 * units (lb, inches, US gallons); these exist only so the UI can accept and
 * display other units.
 */

export type WeightUnit = "lb" | "kg";
export type VolumeUnit = "usgal" | "l";
/** Fuel may be entered by weight or by volume; everything else by weight. */
export type Unit = WeightUnit | VolumeUnit;

export const LB_PER_KG = 2.20462;
export const L_PER_US_GAL = 3.785411784;

/**
 * Avgas specific gravity. 0.72 gives 6.009 lb per US gallon, which matches the
 * "FUEL (6 LB. TO GAL)" line on the POH loading graph (Fig 6-13) to 0.15%.
 */
export const FUEL_SPECIFIC_GRAVITY = 0.72;
export const LB_PER_US_GAL = FUEL_SPECIFIC_GRAVITY * L_PER_US_GAL * LB_PER_KG;

export const UNIT_LABELS: Record<Unit, string> = {
  lb: "lb",
  kg: "kg",
  usgal: "US gal",
  l: "litres",
};

export function isVolume(unit: Unit): unit is VolumeUnit {
  return unit === "usgal" || unit === "l";
}

/** Pounds per one of each unit — volumes via the avgas density above. */
const LB_PER: Record<Unit, number> = {
  lb: 1,
  kg: LB_PER_KG,
  usgal: LB_PER_US_GAL,
  l: LB_PER_US_GAL / L_PER_US_GAL,
};

/** Convert a quantity to pounds. */
export function toPounds(value: number, unit: Unit): number {
  return value * LB_PER[unit];
}

/** Convert pounds into the given unit. */
export function fromPounds(lb: number, unit: Unit): number {
  return lb / LB_PER[unit];
}

/**
 * Re-express a value when the user switches units, keeping the physical
 * quantity unchanged (340 lb becomes 154.2 kg, not 340 kg).
 */
export function convert(value: number, from: Unit, to: Unit): number {
  return fromPounds(toPounds(value, from), to);
}

/** Sensible display precision per unit — volumes and kg need a decimal. */
export function roundForUnit(value: number, unit: Unit): number {
  const dp = unit === "lb" ? 1 : 2;
  return Math.round(value * 10 ** dp) / 10 ** dp;
}
