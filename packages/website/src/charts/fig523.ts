/** Fig 5-23 (best economy cruise) chart page wiring: metadata + overlay trace. */

import type { CruiseInputs, CruiseResult } from "../model/cruisePerformance";
import { cruiseAnchors, cruiseTrace } from "./cruiseTrace";
import metaJson from "./fig-5-23.meta.json";
import type { ChartMeta, Polyline } from "./types";

export const fig523Meta: ChartMeta = metaJson;

export const fig523Anchors = cruiseAnchors(fig523Meta);

export function fig523Trace(inputs: CruiseInputs, result: CruiseResult): { polylines: Polyline[]; marker: [number, number] } {
  return cruiseTrace(fig523Meta, inputs, result);
}
