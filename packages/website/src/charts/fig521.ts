/** Fig 5-21 (best power cruise) chart page wiring: metadata + overlay trace. */

import type { CruiseInputs, CruiseResult } from "../model/cruisePerformance";
import { cruiseAnchors, cruiseTrace } from "./cruiseTrace";
import metaJson from "./fig-5-21.meta.json";
import type { ChartMeta, Polyline } from "./types";

export const fig521Meta: ChartMeta = metaJson;

export const fig521Anchors = cruiseAnchors(fig521Meta);

export function fig521Trace(inputs: CruiseInputs, result: CruiseResult): { polylines: Polyline[]; marker: [number, number] } {
  return cruiseTrace(fig521Meta, inputs, result);
}
