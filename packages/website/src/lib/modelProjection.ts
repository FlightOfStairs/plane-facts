/**
 * A handle for an input the chart draws as a family of curves rather than a
 * scale — pressure altitude, on nearly every nomograph here.
 *
 * There is no PA axis to slide along, but there *is* a line whose height the
 * PA sets: the horizontal transfer at the top of the entry. So the badge rides
 * that line, and the mapping between the two runs through the model itself —
 * PA to the line's height going out, and a bisection coming back. Change the
 * temperature and the line moves while the PA stays put, which is exactly what
 * the chart does.
 */

import type { AxisProjection } from "./chartHandles";

/** Enough halvings to land inside a foot on any range these charts use. */
const ITERATIONS = 32;

export function modelProjection(args: {
  /** Input value → the axis value the model puts the transfer line at. */
  toAxis: (value: number) => number;
  /** The slider's own range and step, so the handle cannot exceed it. */
  bounds: { min: number; max: number; step: number };
}): AxisProjection {
  const { toAxis, bounds } = args;
  const atMin = toAxis(bounds.min);
  const atMax = toAxis(bounds.max);
  // Rate of climb falls with altitude while distance and density altitude
  // rise, so the search must not assume which way round it is.
  const increasing = atMax >= atMin;

  return {
    toAxis,
    fromAxis: (target) => {
      let low = bounds.min;
      let high = bounds.max;
      for (let i = 0; i < ITERATIONS; i++) {
        const mid = (low + high) / 2;
        if (toAxis(mid) < target === increasing) low = mid;
        else high = mid;
      }
      const solved = (low + high) / 2;
      return Math.min(bounds.max, Math.max(bounds.min, Math.round(solved / bounds.step) * bounds.step));
    },
    axisMin: Math.min(atMin, atMax),
    axisMax: Math.max(atMin, atMax),
  };
}
