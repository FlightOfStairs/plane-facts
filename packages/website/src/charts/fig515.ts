/** Fig 5-15 chart page wiring: metadata + model-derived overlay trace. */

import type { EnginePerformanceInputs, EnginePerformanceResult } from "../model/enginePerformance";
import metaJson from "./fig-5-15.meta.json";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig515Meta: ChartMeta = metaJson;

/** Bottom of the lattice: the OAT entry and the RPM read-out share it. */
const AXIS_BOTTOM = axisPx(fig515Meta.axes.uMajor!, 0);

/**
 * Pressure altitude and % power both select curves rather than positions —
 * the PA family runs diagonally across the lattice, so there is no line for a
 * handle to slide along — leaving OAT as the only draggable input.
 */
/** Left end of the transfer line, which moves with the OAT. */
export function fig515PaAnchorPx(oatC: number): number {
  return axisPx(fig515Meta.axes.oatC!, Math.min(Math.max(oatC, -40), 40));
}

/** Height of the constant-DA transfer, where the %power corner sits. */
export function fig515PowerAnchorPx(u: number): number {
  return axisPx(fig515Meta.axes.uMajor!, Math.min(Math.max(u, 0), 8));
}

export const fig515Anchors: ChartAnchors = {
  oatC: { axis: "oatC", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
  // No PA scale — the family runs diagonally — but the PA does set the height
  // of the transfer line, so the badge rides just left of where it starts.
  pressureAltitudeFt: { axis: "uMajor", atPx: 0, point: "right", color: "entry" },
  // %power picks one of the drawn lines; what it moves is where the transfer
  // meets it, so its badge rides above that corner.
  pctPower: { axis: "rpm", atPx: 0, point: "down", color: "weight" },
  rpm: { axis: "rpm", atPx: AXIS_BOTTOM, point: "up", color: "result" },
};

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
        color: SECTION_COLORS.entry,
      },
      // constant-DA transfer across to the %power line
      {
        points: [
          [xOat, yU],
          [xRpm, yU],
        ],
        dashed: true,
        color: SECTION_COLORS.weight,
      },
      // down to the RPM axis
      {
        points: [
          [xRpm, yU],
          [xRpm, yBase],
        ],
        dashed: true,
        color: SECTION_COLORS.result,
      },
    ],
    marker: [xRpm, yU],
  };
}
