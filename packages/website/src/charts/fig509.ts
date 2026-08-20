/** Fig 5-9 chart page wiring: metadata + model-derived overlay trace. */

import type { TakeoffOver50Flaps0Inputs, TakeoffOver50Flaps0Result } from "../model/takeoffOver50Flaps0";
import { MTOW_LB, takeoffOver50Flaps0 } from "../model/takeoffOver50Flaps0";
import metaJson from "./fig-5-09.meta.json";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig509Meta: ChartMeta = metaJson;

/** Bottom edge of the plot: where the three input panels are entered. */
const AXIS_BOTTOM = axisPx(fig509Meta.axes.distanceFt!, 0);
/** Right-hand distance scale, where the trace exits. */
const READOUT_X = axisPx(fig509Meta.axes.windKt!, 15);

/**
 * Where the value badges attach. Pressure altitude is deliberately absent: the
 * chart draws it as a family of curves, not an axis, so there is nothing for a
 * handle to slide along and it stays slider-only.
 */
/** Left end of the transfer line: where the OAT entry turns the corner. */
export function fig509PaAnchorPx(oatC: number): number {
  return axisPx(fig509Meta.axes.oatC!, oatC);
}

export const fig509Anchors: ChartAnchors = {
  oatC: { axis: "oatC", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
  // Pressure altitude has no scale of its own — it picks a curve — but it does
  // set the height of the transfer line out of the OAT entry, so the badge
  // rides just left of that line's start. `atPx` moves with the OAT, so the
  // page overrides it each render (see paAnchorPx below).
  pressureAltitudeFt: { axis: "distanceFt", atPx: 0, point: "right", color: "entry" },
  weightLb: { axis: "weightLb", atPx: AXIS_BOTTOM, point: "up", color: "weight" },
  // The wind panel mirrors tailwind into the headwind band, so the badge sits
  // at |v| and the sign comes from its toggle rather than from the pixel.
  windKt: { axis: "windKt", atPx: AXIS_BOTTOM, point: "up", color: "wind" },
  distanceOver50Ft: { axis: "distanceFt", atPx: READOUT_X, point: "left", color: "result" },
};

/**
 * Build the POH-style worked-example trace from the model: up from the OAT
 * axis to the pressure-altitude curve, across to the 2440-lb reference
 * line, along a model-derived weight guide, across to the no-wind
 * reference line, along the wind guide, then out to the distance axis.
 * Every y-coordinate is the model's output passed through the calibration —
 * demonstration only.
 */
export function fig509Trace(inputs: TakeoffOver50Flaps0Inputs, result: TakeoffOver50Flaps0Result): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig509Meta;
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
    const s = takeoffOver50Flaps0({ ...inputs, weightLb: w, windKt: 0 }).s1Ft;
    weightGuide.push([axisPx(weight, w), axisPx(dist, s)]);
  }

  const windGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const v = (inputs.windKt * i) / 20;
    const s = takeoffOver50Flaps0({ ...inputs, windKt: v }).distanceOver50Ft;
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
