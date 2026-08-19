/** Fig 5-27 (best economy mixture range) chart wiring: metadata + overlay trace. */

import type { ReservePolicy } from "../model/rangeEndurance";
import metaJson from "./fig-5-27.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { axisPx } from "./types";

export const fig527Meta: ChartMeta = metaJson;

/** Left edge of the chart lattice in asset px (start of the entry line). */
const GRID_LEFT_PX = 35;

/**
 * POH-style trace: horizontal from the pressure-altitude axis across both
 * power-curve families (45-min-reserve on the left scale, no-reserve on the
 * offset right scale), then a drop from each intersection to the range axis.
 * X positions are the MODEL's std-temperature curve reads via the calibration;
 * the temperature correction is arithmetic, applied after the graphical read.
 */
export function fig527Trace(pressureAltFt: number, baseReserveNm: number, baseNoReserveNm: number, selected: ReservePolicy): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig527Meta;
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
