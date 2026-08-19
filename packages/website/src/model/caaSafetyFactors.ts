/**
 * CAA Safety Sense performance factors, applied on top of the POH chart
 * models for the conditions the charts do NOT cover.
 *
 * The POH takeoff/landing charts are drawn for a "paved, level, dry runway"
 * and already model weight, pressure altitude, temperature and wind properly,
 * so the leaflet's "performance changes" rules of thumb for those variables
 * are deliberately not applied here — only surface condition, runway slope,
 * and the general safety factor, which the charts say nothing about.
 *
 * Source: CAA Safety Sense Leaflet 09 (Weight, Balance and Performance).
 * https://www.caa.co.uk/data-and-publications/publications/documents/content/safety-sense-leaflet-09/
 */

export type Operation = "takeoff" | "landing";

export type RunwaySurface = "pavedDry" | "pavedWet" | "grassDry" | "grassWet" | "softOrSnow";

interface SurfaceSpec {
  label: string;
  takeoff: number;
  landing: number;
}

/** Leaflet "Safety factors" table; 1.0 where the leaflet prints "–". */
export const SURFACES: Record<RunwaySurface, SurfaceSpec> = {
  pavedDry: { label: "Paved, dry", takeoff: 1, landing: 1 },
  pavedWet: { label: "Wet paved surface", takeoff: 1, landing: 1.15 },
  grassDry: { label: "Dry grass (up to 20 cm)", takeoff: 1.2, landing: 1.15 },
  grassWet: { label: "Wet grass (up to 20 cm)", takeoff: 1.3, landing: 1.35 },
  softOrSnow: { label: "Soft ground or snow", takeoff: 1.25, landing: 1.25 },
};

export const SURFACE_ORDER: RunwaySurface[] = ["pavedDry", "pavedWet", "grassDry", "grassWet", "softOrSnow"];

/** General safety factor, applied after the others. */
export const GENERAL_FACTOR: Record<Operation, number> = { takeoff: 1.33, landing: 1.43 };

/**
 * The leaflet tabulates exactly one slope step — 2% uphill for takeoff,
 * 2% downhill for landing — and neither it nor the POH offers a rule for
 * intermediate gradients, so this is applied as a step, never interpolated.
 */
export const SLOPE_2_PERCENT_FACTOR = 1.1;

export interface SafetyFactorInputs {
  surface: RunwaySurface;
  /** Runway slopes ~2% the unfavourable way (uphill takeoff / downhill landing). */
  adverseSlope: boolean;
  /** Apply the general ×1.33 / ×1.43 factor (CAA recommends it). */
  generalFactor: boolean;
}

export interface FactorTerm {
  label: string;
  factor: number;
}

export interface SafetyFactorResult {
  /** Product of all applicable terms; 1 when nothing applies. */
  total: number;
  terms: FactorTerm[];
}

export const SAFETY_DEFAULTS: SafetyFactorInputs = {
  surface: "pavedDry",
  adverseSlope: false,
  generalFactor: true,
};

/** Label for the slope step, which direction is adverse depends on the operation. */
export function slopeLabel(op: Operation): string {
  return `2% ${op === "takeoff" ? "uphill" : "downhill"} slope`;
}

export function safetyFactors(op: Operation, inp: SafetyFactorInputs): SafetyFactorResult {
  const terms: FactorTerm[] = [];

  const surface = SURFACES[inp.surface];
  const surfaceFactor = op === "takeoff" ? surface.takeoff : surface.landing;
  if (surfaceFactor !== 1) terms.push({ label: surface.label, factor: surfaceFactor });

  // Uphill penalises takeoff, downhill penalises landing; the leaflet gives
  // no credit for a favourable slope.
  if (inp.adverseSlope) {
    terms.push({ label: slopeLabel(op), factor: SLOPE_2_PERCENT_FACTOR });
  }

  if (inp.generalFactor) {
    terms.push({ label: "General safety factor", factor: GENERAL_FACTOR[op] });
  }

  return { total: terms.reduce((acc, t) => acc * t.factor, 1), terms };
}
