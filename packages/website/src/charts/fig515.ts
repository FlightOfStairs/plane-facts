/** Fig 5-15 chart page wiring: metadata + model-derived overlay trace. */

import type { EnginePerformanceInputs, EnginePerformanceResult } from "../model/enginePerformance";
import metaJson from "./fig-5-15.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { axisPx } from "./types";

export const fig515Meta: ChartMeta = metaJson;

/**
 * Build the POH-style worked-example trace from the model: up from the OAT
 * axis to the pressure-altitude curve (left panel), horizontally across to
 * the %rated-power line (right panel), then down to the RPM axis. Every
 * coordinate is a model output passed through the calibration — the y level
 * is the model's density altitude (u = chart major squares), the landing x
 * is the model's RPM. Demonstration only.
 */
export function fig515Trace(inputs: EnginePerformanceInputs, result: EnginePerformanceResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig515Meta;
  const oat = m.axes.oatC!;
  const rpm = m.axes.rpm!;
  const uAx = m.axes.uMajor!;

  // Keep the trace on the drawn lattice (u 0…8) even when inputs run off it.
  const u = Math.min(Math.max(result.u, 0), 8);

  const xOat = axisPx(oat, Math.min(Math.max(inputs.oatC, -40), 40));
  const yBase = axisPx(uAx, 0);
  const yU = axisPx(uAx, u);
  const xRpm = axisPx(rpm, Math.min(Math.max(result.rpm, 2100), 2700));

  return {
    polylines: [
      // OAT entry: vertical up to the PA curve
      {
        points: [
          [xOat, yBase],
          [xOat, yU],
        ],
        dashed: true,
      },
      // constant-DA transfer across to the %power line
      {
        points: [
          [xOat, yU],
          [xRpm, yU],
        ],
        dashed: true,
      },
      // down to the RPM axis
      {
        points: [
          [xRpm, yU],
          [xRpm, yBase],
        ],
        dashed: true,
      },
    ],
    marker: [xRpm, yU],
  };
}
