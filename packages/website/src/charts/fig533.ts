/** Fig 5-33 chart page wiring: metadata + model-derived overlay trace. */

import type { GlideInputs, GlideResult } from "../model/glidePerformance";
import metaJson from "./fig-5-33.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { axisPx } from "./types";

export const fig533Meta: ChartMeta = metaJson;

/**
 * Build the POH-style worked-example trace from the model: horizontal
 * lines in from the pressure-altitude axis at cruise and terrain altitude
 * to the glide line, then vertical drops to the range axis; the glide
 * distance is the difference of the two readings. Every coordinate is the
 * model's output passed through the calibration — demonstration only.
 */
export function fig533Trace(inputs: GlideInputs, result: GlideResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig533Meta;
  const range = m.axes.glideRangeNm!;
  const alt = m.axes.pressureAltFt!;
  const xLeft = axisPx(range, 0);
  const yBottom = axisPx(alt, 0);

  const leg = (altitudeFt: number, rangeNm: number): Polyline[] => {
    const y = axisPx(alt, altitudeFt);
    const x = axisPx(range, rangeNm);
    return [
      {
        points: [
          [xLeft, y],
          [x, y],
        ],
        dashed: true,
      },
      {
        points: [
          [x, y],
          [x, yBottom],
        ],
        dashed: true,
      },
    ];
  };

  return {
    polylines: [...leg(inputs.cruisePressureAltitudeFt, result.rangeCruiseNm), ...leg(inputs.terrainPressureAltitudeFt, result.rangeTerrainNm)],
    marker: [axisPx(range, result.rangeCruiseNm), axisPx(alt, inputs.cruisePressureAltitudeFt)],
  };
}
