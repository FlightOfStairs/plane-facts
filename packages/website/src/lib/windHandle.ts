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

/**
 * Which way the wind is set to blow. Held separately from the value because a
 * sign cannot survive zero: wind the handle down to 0 kt and back up, and
 * without this the setting would silently revert to headwind.
 */
export function isTailwind(windKt: number, remembered: boolean): boolean {
  return windKt === 0 ? remembered : windKt < 0;
}

export function windProjection(spec: ControlSpec, tailwind: boolean): AxisProjection {
  return {
    toAxis: Math.abs,
    fromAxis: (magnitude) => (tailwind ? -Math.min(magnitude, tailwindMax(spec)) : magnitude),
    axisMin: 0,
    axisMax: tailwind ? tailwindMax(spec) : spec.max,
    // The toggle beside it already says HW or TW, so the number stands alone.
    text: (v) => `${Math.abs(v)} ${spec.unit}`,
    valueText: (v) => `${Math.abs(v)} knots ${tailwind ? "tailwind" : "headwind"}`,
  };
}

export function windToggle(windKt: number, tailwind: boolean, set: (windKt: number, tailwind: boolean) => void, spec: ControlSpec): BadgeToggle {
  return {
    options: [
      { value: "hw", label: "HW" },
      { value: "tw", label: "TW" },
    ],
    value: tailwind ? "tw" : "hw",
    // Switching to tailwind clamps to the chart's 5 kt tailwind limit.
    onChange: (v) => (v === "tw" ? set(-Math.min(Math.abs(windKt), tailwindMax(spec)), true) : set(Math.abs(windKt), false)),
    label: "Wind direction",
  };
}
