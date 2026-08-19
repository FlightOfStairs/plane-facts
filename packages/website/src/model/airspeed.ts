/**
 * Airspeed system calibration, POH Figure 5-3 (KCAS ↔ KIAS).
 * Quadratic per flap setting, fitted to the printed lines (rms 0.23 kt).
 * Shared by stall/takeoff/landing models. Below ~43 KIAS the chart is not
 * drawn; Fig 5-5 implies a near-constant CAS ≈ IAS + 6.6 kt at stall AoA.
 */

export type FlapSetting = "up" | "deg40";

interface CalCoefs {
  a0: number;
  a1: number;
  a2: number;
  iasMin: number;
  iasMax: number;
}

const CAL: Record<FlapSetting, CalCoefs> = {
  up: { a0: 16.577, a1: 0.7544, a2: 0.0006344, iasMin: 56, iasMax: 159.4 },
  deg40: { a0: 23.196, a1: 0.52737, a2: 0.0020457, iasMin: 43.3, iasMax: 103.2 },
};

const STALL_RANGE_OFFSET_KT = 6.6;

/** KIAS → KCAS. Falls back to flaps-up above the flaps-40 drawn range (Vfe). */
export function casFromIas(iasKt: number, flaps: FlapSetting): number {
  let c = CAL[flaps];
  if (flaps === "deg40" && iasKt > c.iasMax) c = CAL.up;
  if (iasKt < c.iasMin - 10) return iasKt + STALL_RANGE_OFFSET_KT;
  return c.a0 + c.a1 * iasKt + c.a2 * iasKt * iasKt;
}

/** KCAS → KIAS (positive root of the calibration quadratic). */
export function iasFromCas(casKt: number, flaps: FlapSetting): number {
  let c = CAL[flaps];
  if (flaps === "deg40" && casFromIas(c.iasMax, "deg40") < casKt) c = CAL.up;
  const lowCas = c.a0 + c.a1 * (c.iasMin - 10) + c.a2 * (c.iasMin - 10) ** 2;
  if (casKt < lowCas) return casKt - STALL_RANGE_OFFSET_KT;
  const disc = c.a1 * c.a1 - 4 * c.a2 * (c.a0 - casKt);
  return (-c.a1 + Math.sqrt(disc)) / (2 * c.a2);
}
