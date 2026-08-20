/**
 * Wind handle for the six takeoff/landing charts.
 *
 * Their wind panel draws the tailwind guides in the 0–5 kt band on the *same*
 * side of the reference line as the headwind guides, so the axis carries |v|
 * and one pixel means two different winds. The handle therefore drags
 * magnitude only, and the badge's toggle chooses which family of lines is
 * being read — head- or tailwind.
 */

import type { BadgeToggle } from "../components/AxisBadge";
import type { ControlSpec } from "../components/InputSlider";
import type { AxisProjection } from "./chartHandles";

/** Slider min is the tailwind limit (negative), max the headwind limit. */
const tailwindMax = (spec: ControlSpec) => Math.abs(spec.min);

export function windProjection(spec: ControlSpec): AxisProjection {
  return {
    toAxis: Math.abs,
    fromAxis: (magnitude, current) => (current < 0 ? -Math.min(magnitude, tailwindMax(spec)) : magnitude),
    axisMin: 0,
    axisMax: spec.max,
    // The toggle beside it already says HW or TW, so the number stands alone.
    text: (v) => `${Math.abs(v)} ${spec.unit}`,
    valueText: (v) => `${Math.abs(v)} knots ${v < 0 ? "tailwind" : "headwind"}`,
  };
}

export function windToggle(windKt: number, set: (v: number) => void, spec: ControlSpec): BadgeToggle {
  return {
    options: [
      { value: "hw", label: "HW" },
      { value: "tw", label: "TW" },
    ],
    value: windKt < 0 ? "tw" : "hw",
    // Switching to tailwind clamps to the chart's 5 kt tailwind limit.
    onChange: (v) => set(v === "tw" ? -Math.min(Math.abs(windKt), tailwindMax(spec)) : Math.abs(windKt)),
    label: "Wind direction",
  };
}
