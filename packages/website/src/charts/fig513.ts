/** Fig 5-13 chart page wiring: metadata + model-derived overlay trace. */

import type { TakeoffOver50Flaps25Inputs, TakeoffOver50Flaps25Result } from "../model/takeoffOver50Flaps25";
import { MTOW_LB, takeoffOver50Flaps25 } from "../model/takeoffOver50Flaps25";
import metaJson from "./fig-5-13.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig513Meta: ChartMeta = metaJson;

/**
 * Build the POH-style worked-example trace from the model: up from the OAT
 * axis to the pressure-altitude curve, across to the 2440-lb reference
 * line, along a model-derived weight guide, across to the no-wind
 * reference line, along the wind guide, then out to the distance axis.
 * Every y-coordinate is the model's output passed through the calibration —
 * demonstration only.
 */
export function fig513Trace(inputs: TakeoffOver50Flaps25Inputs, result: TakeoffOver50Flaps25Result): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig513Meta;
  const dist = m.axes.distanceFt!;
  const oat = m.axes.oatC!;
  const weight = m.axes.weightLb!;
  const wind = m.axes.windKt!;

  const xOat = axisPx(oat, inputs.oatC);
  const yS0 = axisPx(dist, result.s0Ft);
  const xWRef = axisPx(weight, MTOW_LB);
  const yS1 = axisPx(dist, result.s1Ft);
  const xW = axisPx(weight, inputs.weightLb);
  const xWindRef = axisPx(wind, 0);
  const xWind = axisPx(wind, Math.abs(inputs.windKt));
  const yFinal = axisPx(dist, result.distanceOver50Ft);
  const xRight = axisPx(wind, 15) + 14;

  const weightGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const w = MTOW_LB + ((inputs.weightLb - MTOW_LB) * i) / 20;
    const s = takeoffOver50Flaps25({ ...inputs, weightLb: w, windKt: 0 }).s1Ft;
    weightGuide.push([axisPx(weight, w), axisPx(dist, s)]);
  }

  const windGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const v = (inputs.windKt * i) / 20;
    const s = takeoffOver50Flaps25({ ...inputs, windKt: v }).distanceOver50Ft;
    windGuide.push([axisPx(wind, Math.abs(v)), axisPx(dist, s)]);
  }

  return {
    polylines: [
      {
        points: [
          [xOat, axisPx(dist, 0)],
          [xOat, yS0],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      {
        points: [
          [xOat, yS0],
          [xWRef, yS0],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      { points: weightGuide, color: SECTION_COLORS.weight },
      {
        points: [
          [xW, yS1],
          [xWindRef, yS1],
        ],
        dashed: true,
        color: SECTION_COLORS.weight,
      },
      { points: windGuide, color: SECTION_COLORS.wind },
      {
        points: [
          [xWind, yFinal],
          [xRight, yFinal],
        ],
        dashed: true,
        color: SECTION_COLORS.result,
      },
    ],
    marker: [xWind, yFinal],
  };
}
