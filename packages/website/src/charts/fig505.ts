/** Fig 5-5 chart page wiring: metadata + model-derived overlay trace. */

import type { StallInputs, StallResult } from "../model/stallSpeed";
import { bankFactor } from "../model/stallSpeed";
import metaJson from "./fig-5-05.meta.json";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig505Meta: ChartMeta = metaJson;

/** Bottom of the grid, where the weight and bank panels are entered. */
const AXIS_BOTTOM = axisPx(fig505Meta.axes.speedKt!, 20);
/** Out past the bank fan, where the stall-speed scale is read. */
const READOUT_X = axisPx(fig505Meta.axes.bankDeg!, 60) + 26;

/** Flap setting picks a curve family rather than a position, so it has no handle. */
export const fig505Anchors: ChartAnchors = {
  weightLb: { axis: "weightLb", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
  bankDeg: { axis: "bankDeg", atPx: AXIS_BOTTOM, point: "up", color: "weight" },
  stallSpeed: { axis: "speedKt", atPx: READOUT_X, point: "left", color: "result" },
};

/**
 * Build the POH-style worked-example trace from the model: up from the
 * weight axis to the flap's solid IAS curve, across into the right panel,
 * along a model-derived bank-fan guide (V₀·cos φ^−0.499) to the bank angle,
 * then out to the stall-speed scale. Every coordinate is a model output
 * passed through the calibration — demonstration only. The printed example
 * traces the solid (indicated) curves; CAS is reported in the results panel.
 */
export function fig505Trace(inputs: StallInputs, result: StallResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig505Meta;
  const speed = m.axes.speedKt!;
  const weight = m.axes.weightLb!;
  const bank = m.axes.bankDeg!;

  const xW = axisPx(weight, inputs.weightLb);
  const yV0 = axisPx(speed, result.wingsLevelIasKt);
  const yBottom = axisPx(speed, 20); // near the grid bottom
  const xBank0 = axisPx(bank, 0);
  const xBank = axisPx(bank, inputs.bankDeg);
  const yFinal = axisPx(speed, result.stallIasKt);
  const xRight = axisPx(bank, 60) + 26; // out to the stall-speed scale

  const fanGuide: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const phi = (inputs.bankDeg * i) / 20;
    fanGuide.push([axisPx(bank, phi), axisPx(speed, result.wingsLevelIasKt * bankFactor(phi))]);
  }

  return {
    polylines: [
      {
        points: [
          [xW, yBottom],
          [xW, yV0],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      {
        points: [
          [xW, yV0],
          [xBank0, yV0],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      { points: fanGuide, color: SECTION_COLORS.wind },
      {
        points: [
          [xBank, yFinal],
          [xRight, yFinal],
        ],
        dashed: true,
        color: SECTION_COLORS.result,
      },
    ],
    marker: [xBank, yFinal],
  };
}
