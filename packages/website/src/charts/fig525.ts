/** Fig 5-25 (best power mixture range) chart wiring: metadata + overlay trace. */

import type { ReservePolicy } from "../model/rangeEndurance";
import metaJson from "./fig-5-25.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { axisPx } from "./types";

export const fig525Meta: ChartMeta = metaJson;

/** Left edge of the chart lattice in asset px (start of the entry line). */
const GRID_LEFT_PX = 104;

/**
 * POH-style trace: horizontal from the pressure-altitude axis across both
 * power-curve families (45-min-reserve on the left scale, no-reserve on the
 * offset right scale), then a drop from each intersection to the range axis.
 * The x positions are the MODEL's std-temperature curve reads pushed through
 * the calibration — the chart's temperature correction is arithmetic, applied
 * after the graphical read (as in the printed example).
 */
export function fig525Trace(pressureAltFt: number, baseReserveNm: number, baseNoReserveNm: number, selected: ReservePolicy): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig525Meta;
  const paAxis = m.axes.pressureAltFt!;
  const resAxis = m.axes.rangeNmReserve45!;
  const noResAxis = m.axes.rangeNmNoReserve!;

  const y = axisPx(paAxis, pressureAltFt);
  const yAxis = axisPx(paAxis, 0); // sea-level baseline
  const xRes = axisPx(resAxis, baseReserveNm);
  const xNoRes = axisPx(noResAxis, baseNoReserveNm);
  const xSel = selected === "reserve45" ? xRes : xNoRes;

  return {
    polylines: [
      {
        points: [
          [GRID_LEFT_PX, y],
          [Math.max(xRes, xNoRes), y],
        ],
        dashed: true,
      },
      {
        points: [
          [xRes, y],
          [xRes, yAxis],
        ],
        dashed: true,
      },
      {
        points: [
          [xNoRes, y],
          [xNoRes, yAxis],
        ],
        dashed: true,
      },
    ],
    marker: [xSel, yAxis],
  };
}
