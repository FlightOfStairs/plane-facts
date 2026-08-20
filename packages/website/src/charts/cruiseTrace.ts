/** Shared worked-example trace for the cruise nomographs (Figs 5-21/5-23). */

import type { CruiseInputs, CruiseResult } from "../model/cruisePerformance";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Mimic the POH dashed trace: up from the OAT axis to the pressure-altitude
 * line (the model's DA sets the height), horizontally across to the %power
 * curve — or the full-throttle boundary when the setting is capped — then
 * down to the TAS axis. Every coordinate comes from the model through the
 * calibration; the chart is never read.
 */
/**
 * Badge anchors for both cruise charts. Pressure altitude is drawn as a family
 * of diagonals and % power as a curve family, so neither has a line to slide
 * along; OAT is the only draggable input.
 */
export function cruiseAnchors(meta: ChartMeta): ChartAnchors {
  const bottom = axisPx(meta.axes.daFt!, 0);
  return {
    oatC: { axis: "oatC", atPx: bottom, point: "up", color: "entry" },
    tasKt: { axis: "tasKt", atPx: bottom, point: "up", color: "result" },
  };
}

export function cruiseTrace(meta: ChartMeta, inputs: CruiseInputs, result: CruiseResult): { polylines: Polyline[]; marker: [number, number] } {
  const oat = meta.axes.oatC!;
  const tas = meta.axes.tasKt!;
  const da = meta.axes.daFt!;

  const xOat = axisPx(oat, clamp(inputs.oatC, -40, 40));
  const yBottom = axisPx(da, 0);
  const yDa = axisPx(da, clamp(result.densityAltitudeFt, 0, 16000));
  // Chart reading is always the fairings-installed value; the −7 kt note is arithmetic.
  const xTas = axisPx(tas, clamp(result.tasChartKt, 90, 130));

  return {
    polylines: [
      // OAT vertical up to the PA line
      {
        points: [
          [xOat, yBottom],
          [xOat, yDa],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      // horizontal transfer at constant DA to the %power curve / FT boundary
      {
        points: [
          [xOat, yDa],
          [xTas, yDa],
        ],
        dashed: true,
        color: SECTION_COLORS.weight,
      },
      // down to the TAS axis
      {
        points: [
          [xTas, yDa],
          [xTas, yBottom],
        ],
        dashed: true,
        color: SECTION_COLORS.result,
      },
    ],
    marker: [xTas, yBottom],
  };
}
