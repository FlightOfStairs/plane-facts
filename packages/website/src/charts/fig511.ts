/** Fig 5-11 chart page wiring: metadata + model-derived overlay trace. */

import type { TakeoffInputs, TakeoffResult } from "../model/takeoffGroundRoll25";
import { MTOW_LB, takeoffGroundRoll25 } from "../model/takeoffGroundRoll25";
import metaJson from "./fig-5-11.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig511Meta: ChartMeta = metaJson;

/**
 * Build the POH-style worked-example trace from the model: up from the OAT
 * axis to the pressure-altitude curve, across to the weight reference line,
 * along a model-derived guide curve to the weight, across to the wind
 * reference line, along the wind guide, then out to the distance axis.
 * Every y-coordinate is the model's output passed through the calibration —
 * demonstration only.
 */
export function fig511Trace(inputs: TakeoffInputs, result: TakeoffResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig511Meta;
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
  // Tailwind guides are drawn in the 0–5 kt band right of the ref line, so
  // the trace uses |wind| for x regardless of sign.
  const xWind = axisPx(wind, Math.abs(inputs.windKt));
  const yFinal = axisPx(dist, result.groundRollFt);
  const xRight = axisPx(wind, 15) + 14;

  const weightGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const w = MTOW_LB + ((inputs.weightLb - MTOW_LB) * i) / 20;
    const s = takeoffGroundRoll25({ ...inputs, weightLb: w, windKt: 0 }).s1Ft;
    weightGuide.push([axisPx(weight, w), axisPx(dist, s)]);
  }

  const windGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const v = (inputs.windKt * i) / 20;
    const s = takeoffGroundRoll25({ ...inputs, windKt: v }).groundRollFt;
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
