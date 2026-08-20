/** Fig 5-37 chart page wiring: metadata + model-derived overlay trace. */

import type { LandingGroundRollInputs, LandingGroundRollResult } from "../model/landingGroundRoll";
import { MLW_LB, landingGroundRoll } from "../model/landingGroundRoll";
import metaJson from "./fig-5-37.meta.json";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig537Meta: ChartMeta = metaJson;

/** Bottom edge of the plot: where the three input panels are entered. */
const AXIS_BOTTOM = axisPx(fig537Meta.axes.distanceFt!, 300);
/** Right-hand distance scale, where the trace exits. */
const READOUT_X = axisPx(fig537Meta.axes.windKt!, 15) + 14;

/**
 * Where the value badges attach. Pressure altitude is deliberately absent: the
 * chart draws it as a family of curves, not an axis, so there is nothing for a
 * handle to slide along and it stays slider-only.
 */
export const fig537Anchors: ChartAnchors = {
  oatC: { axis: "oatC", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
  weightLb: { axis: "weightLb", atPx: AXIS_BOTTOM, point: "up", color: "weight" },
  // The wind panel mirrors tailwind into the headwind band, so the badge sits
  // at |v| and the sign comes from its toggle rather than from the pixel.
  windKt: { axis: "windKt", atPx: AXIS_BOTTOM, point: "up", color: "wind", project: (a, v) => axisPx(a, Math.abs(v)) },
  groundRollFt: { axis: "distanceFt", atPx: READOUT_X, point: "left", color: "result" },
};

/**
 * Build the POH-style worked-example trace from the model: up from the OAT
 * axis to the pressure-altitude curve, across to the 2440-lb weight
 * reference line, along a model-derived weight guide, across to the no-wind
 * reference line, along the wind guide (tailwinds plot to the right of the
 * ref line, in the 0–5 kt band), then out to the distance axis. Every
 * y-coordinate is the model's output passed through the calibration —
 * demonstration only.
 */
export function fig537Trace(inputs: LandingGroundRollInputs, result: LandingGroundRollResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig537Meta;
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
  const yFinal = axisPx(dist, result.groundRollFt);
  const xRight = axisPx(wind, 15) + 14;
  const yAxisBottom = axisPx(dist, 300);

  const weightGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const w = MLW_LB + ((inputs.weightLb - MLW_LB) * i) / 20;
    const s = landingGroundRoll({ ...inputs, weightLb: w, windKt: 0 }).s1Ft;
    weightGuide.push([axisPx(weight, w), axisPx(dist, s)]);
  }

  const windGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const v = (inputs.windKt * i) / 20;
    const s = landingGroundRoll({ ...inputs, windKt: v }).groundRollFt;
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
