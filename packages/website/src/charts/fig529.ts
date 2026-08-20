/** Fig 5-29 (endurance) chart wiring: metadata + overlay trace. */

import type { ReservePolicy } from "../model/rangeEndurance";
import metaJson from "./fig-5-29.meta.json";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig529Meta: ChartMeta = metaJson;

/** Left edge of the chart lattice in asset px (start of the entry line). */
const GRID_LEFT_PX = 90;

/**
 * Pressure altitude is entered up the left-hand scale — a vertical handle —
 * and the chart draws both reserve policies, so both read-outs get a badge.
 * Power selects a curve, so it stays slider-only.
 */
/** Height of the altitude transfer, where the %power corner sits. */
export function fig529PowerAnchorPx(pressureAltFt: number): number {
  return axisPx(fig529Meta.axes.pressureAltFt!, pressureAltFt);
}

export const fig529Anchors: ChartAnchors = {
  pressureAltFt: { axis: "pressureAltFt", atPx: GRID_LEFT_PX, point: "right", color: "entry" },
  // %power selects one of the drawn curves; what it moves is where the
  // altitude transfer meets it, so its badge rides above that corner. It is
  // shown against the reserve read-out, which is the one the chart leads with.
  power: { axis: "enduranceHrReserve45", atPx: 0, point: "down", color: "weight" },
  reserve45: { axis: "enduranceHrReserve45", atPx: axisPx(fig529Meta.axes.pressureAltFt!, 0), point: "up", color: "weight" },
  noReserve: { axis: "enduranceHrNoReserve", atPx: axisPx(fig529Meta.axes.pressureAltFt!, 0), point: "up", color: "wind" },
};

/**
 * POH-style trace: horizontal from the pressure-altitude axis across both
 * endurance families (45-min-reserve on the left 1-hr scale, no-reserve on
 * the offset right scale), then a drop from each intersection to the hours
 * axis. X positions are the MODEL's curve evaluations via the calibration.
 */
export function fig529Trace(pressureAltFt: number, reserveHr: number, noReserveHr: number, selected: ReservePolicy): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig529Meta;
  const paAxis = m.axes.pressureAltFt!;
  const resAxis = m.axes.enduranceHrReserve45!;
  const noResAxis = m.axes.enduranceHrNoReserve!;

  const y = axisPx(paAxis, pressureAltFt);
  const yAxis = axisPx(paAxis, 0); // sea-level baseline
  const xRes = axisPx(resAxis, reserveHr);
  const xNoRes = axisPx(noResAxis, noReserveHr);
  const xSel = selected === "reserve45" ? xRes : xNoRes;

  return {
    polylines: [
      {
        points: [
          [GRID_LEFT_PX, y],
          [Math.max(xRes, xNoRes), y],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      {
        points: [
          [xRes, y],
          [xRes, yAxis],
        ],
        dashed: true,
        color: SECTION_COLORS.weight,
      },
      {
        points: [
          [xNoRes, y],
          [xNoRes, yAxis],
        ],
        dashed: true,
        color: SECTION_COLORS.wind,
      },
    ],
    marker: [xSel, yAxis],
  };
}
