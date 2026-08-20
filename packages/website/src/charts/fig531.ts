/** Fig 5-31 chart page wiring: metadata + model-derived overlay trace. */

import type { DescentInputs, DescentReading, DescentResult } from "../model/descentFuelTimeDistance";
import metaJson from "./fig-5-31.meta.json";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig531Meta: ChartMeta = metaJson;

/** Sea-level baseline, where the OAT entries and the read-outs sit. */
const AXIS_BOTTOM = axisPx(fig531Meta.axes.isaAltFt!, 0);

/**
 * Cruise and destination temperatures share the OAT axis, and the three
 * read-outs share the `value` axis, so both sets are laned apart.
 */
/** Left end of a leg's transfer line, which moves with that leg's OAT. */
export function fig531PaAnchorPx(oatC: number): number {
  return axisPx(fig531Meta.axes.oatC!, oatC);
}

export const fig531Anchors: ChartAnchors = {
  cruiseOatC: { axis: "oatC", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
  destOatC: { axis: "oatC", atPx: AXIS_BOTTOM, point: "up", color: "weight" },
  // Each leg's pressure altitude sets the height its transfer line runs at —
  // the model's effective altitude — so its badge rides left of that line.
  cruisePressureAltitudeFt: { axis: "isaAltFt", atPx: 0, point: "right", color: "entry" },
  destPressureAltitudeFt: { axis: "isaAltFt", atPx: 0, point: "right", color: "weight" },
  // Coloured to match their own trace segments, since all three read-outs
  // land within a few pixels of each other on the shared value axis.
  fuelGal: { axis: "value", atPx: AXIS_BOTTOM, point: "up", color: "weight" },
  timeMin: { axis: "value", atPx: AXIS_BOTTOM, point: "up", color: "wind" },
  distNm: { axis: "value", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
};

/**
 * Build the POH-style worked-example trace from the model, once for the
 * cruise conditions and once for the destination: up from the OAT axis to
 * the pressure-altitude curve (the model's effective altitude h_e), then
 * horizontally across the right panel, dropping to the value axis at each
 * of the fuel / time / distance curve crossings. The printed answers are
 * cruise reading minus destination reading on each curve. Every
 * y-coordinate is the model's output passed through the calibration —
 * demonstration only.
 */
export function fig531Trace(inputs: DescentInputs, result: DescentResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig531Meta;
  const oat = m.axes.oatC!;
  const value = m.axes.value!;
  const alt = m.axes.isaAltFt!;
  const yBottom = axisPx(alt, 0);

  const legs = (oatC: number, reading: DescentReading): Polyline[] => {
    const xIn = axisPx(oat, oatC);
    const y = axisPx(alt, reading.effectiveAltitudeFt);
    const xFuel = axisPx(value, reading.fuelGal);
    const xTime = axisPx(value, reading.timeMin);
    const xDist = axisPx(value, reading.distNm);
    return [
      // entry: up from the OAT axis to the pressure-altitude curve
      {
        points: [
          [xIn, yBottom],
          [xIn, y],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      // transfer: straight across to the farthest (distance) curve
      {
        points: [
          [xIn, y],
          [xDist, y],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      // read-offs: drop to the shared value axis at each curve crossing
      // (per-curve colors: fuel=weight, time=wind, distance=entry)
      {
        points: [
          [xFuel, y],
          [xFuel, yBottom],
        ],
        dashed: true,
        color: SECTION_COLORS.weight,
      },
      {
        points: [
          [xTime, y],
          [xTime, yBottom],
        ],
        dashed: true,
        color: SECTION_COLORS.wind,
      },
      {
        points: [
          [xDist, y],
          [xDist, yBottom],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
    ];
  };

  return {
    polylines: [...legs(inputs.cruiseOatC, result.cruise), ...legs(inputs.destOatC, result.destination)],
    marker: [axisPx(value, result.cruise.distNm), axisPx(alt, result.cruise.effectiveAltitudeFt)],
  };
}
