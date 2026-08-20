/** Fig 5-19 chart page wiring: metadata + model-derived overlay trace. */

import type { ClimbLeg, ClimbToInputs, ClimbToResult } from "../model/climbFuelTimeDistance";
import metaJson from "./fig-5-19.meta.json";
import { Y_RANGE_PX } from "./fixtures/fig519Fit";
import type { ChartAnchors, ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

export const fig519Meta: ChartMeta = metaJson;

/** Bottom grid border of the chart, ORIGINAL-page y px. */
const GRID_BOTTOM_PAGE_Y = 1444;

/** Bottom of the grid: both OAT entries and all three read-outs sit on it. */
const AXIS_BOTTOM = axisPx(fig519Meta.axes.yPx!, GRID_BOTTOM_PAGE_Y);

/**
 * Two temperatures share the one OAT axis, and three quantities share the one
 * `value` axis, so the badges are laned to stop them colliding.
 */
export const fig519Anchors: ChartAnchors = {
  departureOatC: { axis: "oatC", atPx: AXIS_BOTTOM, point: "up", color: "entry" },
  cruiseOatC: { axis: "oatC", atPx: AXIS_BOTTOM, point: "up", color: "weight", lane: 1 },
  // Coloured to match their own trace segments, since all three read-outs
  // land within a few pixels of each other on the shared value axis.
  fuelGal: { axis: "value", atPx: AXIS_BOTTOM, point: "up", color: "weight" },
  timeMin: { axis: "value", atPx: AXIS_BOTTOM, point: "up", color: "wind", lane: 1 },
  distNm: { axis: "value", atPx: AXIS_BOTTOM, point: "up", color: "entry", lane: 2 },
};

/**
 * Build the POH-style worked-example trace from the model, mimicking the
 * printed "DEPARTURE AIRPORT" / "CRUISE ALTITUDE" construction: for each of
 * the two lookups, up from the OAT axis to the altitude-curve family (the
 * model's fitted surface height), across to the three value curves
 * (fuel / time / distance), then down to the shared bottom axis. The final
 * answers are the differences of the two lookups. Every coordinate is the
 * model's output passed through the calibration — demonstration only.
 */
export function fig519Trace(inputs: ClimbToInputs, result: ClimbToResult): { polylines: Polyline[]; marker: [number, number] } {
  const m = fig519Meta;
  const oat = m.axes.oatC!;
  const value = m.axes.value!;
  const yAx = m.axes.yPx!;
  const yBottom = axisPx(yAx, GRID_BOTTOM_PAGE_Y);

  const legLines = (oatC: number, leg: ClimbLeg): { lines: Polyline[]; xDist: number } => {
    const xOat = axisPx(oat, oatC);
    const clampedY = Math.min(Math.max(leg.yPx, Y_RANGE_PX[0]), GRID_BOTTOM_PAGE_Y);
    const y = axisPx(yAx, clampedY);
    // value-curve intersections: values are the leg's cumulative readings
    const xFuel = axisPx(value, leg.fuelGal);
    const xTime = axisPx(value, leg.timeMin);
    const xDist = axisPx(value, leg.distNm);
    const lines: Polyline[] = [
      {
        points: [
          [xOat, yBottom],
          [xOat, y],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      {
        points: [
          [xOat, y],
          [Math.max(xFuel, xTime, xDist), y],
        ],
        dashed: true,
        color: SECTION_COLORS.entry,
      },
      // drops from each value-curve intersection to the bottom axis
      // (per-curve colors: fuel=weight, time=wind, distance=entry)
      ...(
        [
          [xFuel, SECTION_COLORS.weight],
          [xTime, SECTION_COLORS.wind],
          [xDist, SECTION_COLORS.entry],
        ] as const
      ).map(([x, color]): Polyline => ({
        points: [
          [x, y],
          [x, yBottom],
        ],
        dashed: true,
        color,
      })),
    ];
    return { lines, xDist };
  };

  const dep = legLines(inputs.departureOatC, result.departure);
  const cru = legLines(inputs.cruiseOatC, result.cruise);

  return {
    polylines: [...dep.lines, ...cru.lines],
    marker: [cru.xDist, yBottom],
  };
}
