/** Fig 5-31 chart page wiring: metadata + model-derived overlay trace. */

import type { DescentInputs, DescentReading, DescentResult } from "../model/descentFuelTimeDistance";
import metaJson from "./fig-5-31.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { axisPx } from "./types";

export const fig531Meta: ChartMeta = metaJson;

/**
 * Build the POH-style worked-example trace from the model, once for the
 * cruise conditions and once for the destination: up from the OAT axis to
 * the pressure-altitude curve (the model's effective altitude h_e), then
 * horizontally across the right panel, dropping to the value axis at each
 * of the fuel / time / distance curve crossings. The printed answers are
 * cruise reading minus destination reading on each curve. Every
 * y-coordinate is the model's output passed through the calibration —
 * demonstration only.
 */
export function fig531Trace(inputs: DescentInputs, result: DescentResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig531Meta;
  const oat = m.axes.oatC!;
  const value = m.axes.value!;
  const alt = m.axes.isaAltFt!;
  const yBottom = axisPx(alt, 0);

  const legs = (oatC: number, reading: DescentReading): Polyline[] => {
    const xIn = axisPx(oat, oatC);
    const y = axisPx(alt, reading.effectiveAltitudeFt);
    const xFuel = axisPx(value, reading.fuelGal);
    const xTime = axisPx(value, reading.timeMin);
    const xDist = axisPx(value, reading.distNm);
    return [
      // entry: up from the OAT axis to the pressure-altitude curve
      {
        points: [
          [xIn, yBottom],
          [xIn, y],
        ],
        dashed: true,
      },
      // transfer: straight across to the farthest (distance) curve
      {
        points: [
          [xIn, y],
          [xDist, y],
        ],
        dashed: true,
      },
      // read-offs: drop to the shared value axis at each curve crossing
      {
        points: [
          [xFuel, y],
          [xFuel, yBottom],
        ],
        dashed: true,
      },
      {
        points: [
          [xTime, y],
          [xTime, yBottom],
        ],
        dashed: true,
      },
      {
        points: [
          [xDist, y],
          [xDist, yBottom],
        ],
        dashed: true,
      },
    ];
  };

  return {
    polylines: [...legs(inputs.cruiseOatC, result.cruise), ...legs(inputs.destOatC, result.destination)],
    marker: [axisPx(value, result.cruise.distNm), axisPx(alt, result.cruise.effectiveAltitudeFt)],
  };
}
