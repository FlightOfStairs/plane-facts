/** Fig 5-35 chart page wiring: metadata + model-derived overlay trace. */

import type { LandingDistance50Inputs, LandingDistance50Result } from "../model/landingDistance50";
import { MLW_LB, landingDistance50 } from "../model/landingDistance50";
import metaJson from "./fig-5-35.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { axisPx } from "./types";

export const fig535Meta: ChartMeta = metaJson;

/**
 * Build the POH-style worked-example trace from the model: up from the OAT
 * axis to the pressure-altitude curve, across to the weight reference line
 * (drawn at 2440 lb — the printed "2400 LBS" label is a misprint), along a
 * model-derived weight guide, across to the no-wind reference line, along
 * the wind guide (tailwinds plot to the right of the ref line, in the
 * 0–5 kt band), then out to the distance axis. Every y-coordinate is the
 * model's output passed through the calibration — demonstration only.
 */
export function fig535Trace(inputs: LandingDistance50Inputs, result: LandingDistance50Result): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig535Meta;
  const dist = m.axes.distanceFt!;
  const oat = m.axes.oatC!;
  const weight = m.axes.weightLb!;
  const wind = m.axes.windKt!;

  const xOat = axisPx(oat, inputs.oatC);
  const yS0 = axisPx(dist, result.s0Ft);
  const xWRef = axisPx(weight, MLW_LB);
  const yS1 = axisPx(dist, result.s1Ft);
  const xW = axisPx(weight, inputs.weightLb);
  const xWindRef = axisPx(wind, 0);
  const xWind = axisPx(wind, Math.abs(inputs.windKt));
  const yFinal = axisPx(dist, result.distanceOver50FtFt);
  const xRight = axisPx(wind, 15) + 14;
  const yAxisBottom = axisPx(dist, 600);

  const weightGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const w = MLW_LB + ((inputs.weightLb - MLW_LB) * i) / 20;
    const s = landingDistance50({ ...inputs, weightLb: w, windKt: 0 }).s1Ft;
    weightGuide.push([axisPx(weight, w), axisPx(dist, s)]);
  }

  const windGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const v = (inputs.windKt * i) / 20;
    const s = landingDistance50({ ...inputs, windKt: v }).distanceOver50FtFt;
    windGuide.push([axisPx(wind, Math.abs(v)), axisPx(dist, s)]);
  }

  return {
    polylines: [
      {
        points: [
          [xOat, yAxisBottom],
          [xOat, yS0],
        ],
        dashed: true,
      },
      {
        points: [
          [xOat, yS0],
          [xWRef, yS0],
        ],
        dashed: true,
      },
      { points: weightGuide },
      {
        points: [
          [xW, yS1],
          [xWindRef, yS1],
        ],
        dashed: true,
      },
      { points: windGuide },
      {
        points: [
          [xWind, yFinal],
          [xRight, yFinal],
        ],
        dashed: true,
      },
    ],
    marker: [xWind, yFinal],
  };
}
