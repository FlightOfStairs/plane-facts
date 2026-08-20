/** Fig 5-3 chart page wiring: metadata + model-derived overlay trace. */

import type { AirspeedCalResult } from "../model/airspeedCalibration";
import metaJson from "./fig-5-03.meta.json";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig503Meta: ChartMeta = metaJson;

/** Grid corners: the CAS 40 gridline (bottom) and the IAS 40 gridline (left). */
const AXIS_BOTTOM = axisPx(fig503Meta.axes.casKt!, 40);
const GRID_LEFT = axisPx(fig503Meta.axes.iasKt!, 40);

/**
 * Both scales are inputs now: the page keeps IAS and CAS as two linked
 * sliders, so either handle can be grabbed directly — the x one along the
 * bottom, the y one up the left-hand scale, sitting outside the grid.
 */
export const fig503Anchors: ChartAnchors = {
  iasKt: { axis: "iasKt", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
  casKt: { axis: "casKt", atPx: GRID_LEFT, point: "right", color: "result" },
};

/**
 * Single-panel chart: vertical entry line at the IAS, horizontal line out to
 * the CAS axis, marker on the calibration line. Both coordinates come from
 * the model (shared model/airspeed.ts) through the calibration — the overlay
 * is demonstration only.
 */
export function fig503Trace(result: AirspeedCalResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig503Meta;
  const ias = m.axes.iasKt!;
  const cas = m.axes.casKt!;

  const x = axisPx(ias, result.iasKt);
  const y = axisPx(cas, result.casKt);
  const yBottom = axisPx(cas, 40); // grid bottom (CAS 40 gridline)
  const xLeft = axisPx(ias, 40); // grid left (IAS 40 gridline)

  return {
    polylines: [
      {
        points: [
          [x, yBottom],
          [x, y],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      {
        points: [
          [x, y],
          [xLeft, y],
        ],
        dashed: true,
        color: SECTION_COLORS.result,
      },
    ],
    marker: [x, y],
  };
}
