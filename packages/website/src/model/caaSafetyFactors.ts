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
 * Source: CAA Safety Sense Leaflet 07 (Aeroplane Performance).
 * https://www.caa.co.uk/data-and-publications/publications/documents/content/safety-sense-leaflet-07/
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

/** Leaflet gives ×1.1 per 2% of slope, in the unfavourable direction only. */
export const SLOPE_FACTOR_PER_2_PERCENT = 1.1;

export interface SafetyFactorInputs {
  surface: RunwaySurface;
  /** Runway slope in %, positive = uphill in the direction of travel. */
  slopePct: number;
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
  slopePct: 0,
  generalFactor: true,
};

export function safetyFactors(op: Operation, inp: SafetyFactorInputs): SafetyFactorResult {
  const terms: FactorTerm[] = [];

  const surface = SURFACES[inp.surface];
  const surfaceFactor = op === "takeoff" ? surface.takeoff : surface.landing;
  if (surfaceFactor !== 1) terms.push({ label: surface.label, factor: surfaceFactor });

  // Uphill penalises takeoff, downhill penalises landing; the leaflet gives
  // no credit for a favourable slope.
  const adverse = op === "takeoff" ? inp.slopePct : -inp.slopePct;
  if (adverse > 0) {
    terms.push({
      label: `${adverse.toFixed(1)}% ${op === "takeoff" ? "uphill" : "downhill"} slope`,
      factor: Math.pow(SLOPE_FACTOR_PER_2_PERCENT, adverse / 2),
    });
  }

  if (inp.generalFactor) {
    terms.push({ label: "General safety factor", factor: GENERAL_FACTOR[op] });
  }

  return { total: terms.reduce((acc, t) => acc * t.factor, 1), terms };
}
