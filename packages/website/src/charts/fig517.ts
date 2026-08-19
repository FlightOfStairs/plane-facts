/** Fig 5-17 chart page wiring: metadata + model-derived overlay trace. */

import type { ClimbPerformanceInputs, ClimbPerformanceResult } from "../model/climbPerformance";
import metaJson from "./fig-5-17.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { axisPx } from "./types";

export const fig517Meta: ChartMeta = metaJson;

/**
 * The printed ROC reflection line, digitized as [ROC fpm, ORIGINAL-page y px]
 * (from tools/digitize/out/fits/fig_5_17.json). It maps the shared nomograph
 * height to a rate of climb; slightly curved, so interpolate rather than fit.
 */
const ROC_LINE: [number, number][] = [
  [25.8, 510],
  [41.9, 535],
  [58.0, 560],
  [74.1, 585],
  [90.3, 610],
  [106.4, 635],
  [122.6, 660],
  [138.8, 685],
  [155.0, 710],
  [171.2, 735],
  [187.4, 760],
  [203.7, 785],
  [220.0, 810],
  [236.2, 835],
  [252.5, 860],
  [268.8, 885],
  [285.2, 910],
  [301.5, 935],
  [317.9, 960],
  [334.2, 985],
  [350.6, 1010],
  [367.0, 1035],
  [383.5, 1060],
  [399.9, 1085],
  [416.3, 1110],
  [432.8, 1135],
  [449.3, 1160],
  [465.8, 1185],
  [482.3, 1210],
  [498.8, 1235],
  [515.3, 1260],
  [531.9, 1285],
  [548.4, 1310],
  [565.0, 1335],
  [581.6, 1360],
  [598.2, 1385],
  [614.8, 1410],
  [631.5, 1435],
];

/** Bottom grid border of the chart, ORIGINAL-page y px. */
const GRID_BOTTOM_PAGE_Y = 1450;

/** Nomograph height (original-page y px) for a rate of climb, interpolated along the drawn line. */
function pageYFromRoc(rocFpm: number): number {
  const first = ROC_LINE[0]!;
  const last = ROC_LINE[ROC_LINE.length - 1]!;
  const r = Math.min(Math.max(rocFpm, first[0]), last[0]);
  for (let i = 1; i < ROC_LINE.length; i++) {
    const [r1, y1] = ROC_LINE[i]!;
    const [r0, y0] = ROC_LINE[i - 1]!;
    if (r <= r1) return y0 + ((r - r0) / (r1 - r0)) * (y1 - y0);
  }
  return last[1];
}

/**
 * Build the POH-style worked-example trace from the model: up from the OAT
 * axis to the pressure-altitude curve (whose height encodes the ROC), across
 * to the ROC reflection line, then down to the rate-of-climb axis. Every
 * coordinate is the model's output passed through the calibration —
 * demonstration only. The trace shows the printed chart's value (wheel
 * fairings installed); the fairings-removed adjustment is arithmetic below
 * the chart.
 */
export function fig517Trace(inputs: ClimbPerformanceInputs, result: ClimbPerformanceResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig517Meta;
  const oat = m.axes.oatC!;
  const roc = m.axes.rocFpm!;
  const yAx = m.axes.yPx!;

  const xOat = axisPx(oat, inputs.oatC);
  const yEntry = axisPx(yAx, pageYFromRoc(result.rocChartFpm));
  const xRoc = axisPx(roc, Math.max(result.rocChartFpm, 0));
  const yBottom = axisPx(yAx, GRID_BOTTOM_PAGE_Y);

  return {
    polylines: [
      {
        points: [
          [xOat, yBottom],
          [xOat, yEntry],
        ],
        dashed: true,
      },
      {
        points: [
          [xOat, yEntry],
          [xRoc, yEntry],
        ],
        dashed: true,
      },
      {
        points: [
          [xRoc, yEntry],
          [xRoc, yBottom],
        ],
        dashed: true,
      },
    ],
    marker: [xRoc, yBottom],
  };
}
