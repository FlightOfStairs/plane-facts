/**
 * Page-facing wrapper around the shared Fig 5-3 airspeed calibration model
 * (model/airspeed.ts — quadratic KCAS↔KIAS per flap setting, rms 0.23 kt).
 * Adds direction handling and chart-envelope warnings; the polynomial
 * evaluation itself lives only in airspeed.ts.
 * Envelope constants from tools/digitize/out/fits/fig_5_03.json.
 */

import type { FlapSetting } from "./airspeed";
import { casFromIas, iasFromCas } from "./airspeed";

export type CalDirection = "iasToCas" | "casToIas";

export interface AirspeedCalInputs {
  /** The known speed, kt — IAS or CAS depending on direction */
  speedKt: number;
  direction: CalDirection;
  flaps: FlapSetting;
}

export interface AirspeedCalResult {
  iasKt: number;
  casKt: number;
  /** Position error CAS − IAS, kt */
  positionErrorKt: number;
  /** Non-empty if the point falls off the drawn calibration lines */
  warnings: string[];
}

/** Drawn IAS range per flap setting (fig_5_03.json envelope). */
export const IAS_ENVELOPE: Record<FlapSetting, [number, number]> = {
  up: [56.0, 159.4],
  deg40: [43.3, 103.2],
};

/** Vfe — the flaps-40 line ends here and merges into the flaps-up line. */
export const FLAPS40_VFE_KIAS = IAS_ENVELOPE.deg40[1];

export function airspeedCalibration(inp: AirspeedCalInputs): AirspeedCalResult {
  const { speedKt, direction, flaps } = inp;
  const iasKt = direction === "iasToCas" ? speedKt : iasFromCas(speedKt, flaps);
  const casKt = direction === "iasToCas" ? casFromIas(speedKt, flaps) : speedKt;

  const [iasMin, iasMax] = IAS_ENVELOPE[flaps];
  const warnings: string[] = [];
  if (iasKt < iasMin) {
    warnings.push(`below the drawn line (min ${iasMin.toFixed(0)} KIAS) — stall-range offset CAS ≈ IAS + 6.6 kt from Fig 5-5 takes over`);
  }
  if (flaps === "up" && iasKt > iasMax) {
    warnings.push(`above the drawn line (max ${iasMax.toFixed(0)} KIAS) — extrapolated`);
  }
  if (flaps === "deg40" && iasKt > FLAPS40_VFE_KIAS) {
    warnings.push(`above Vfe ${FLAPS40_VFE_KIAS.toFixed(0)} KIAS — flaps-40 line ends; flaps-up calibration used`);
  }

  return { iasKt, casKt, positionErrorKt: casKt - iasKt, warnings };
}
