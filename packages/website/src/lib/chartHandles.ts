/**
 * Joins the two halves of a chart handle: the page owns each input's range and
 * step (the same object its slider is built from), the chart file owns the
 * pixel geometry, and the axis calibration comes from the meta. Nothing is
 * written twice, so a slider and its handle cannot drift apart.
 */

import type { BadgeDrag, BadgeToggle } from "../components/AxisBadge";
import type { ControlSpec } from "../components/InputSlider";
import type { AxisMeta, ChartAnchors, ChartMeta } from "../charts/types";
import { SECTION_COLORS } from "../charts/types";

export interface ResolvedBadge {
  id: string;
  axis: AxisMeta;
  atPx: number;
  point: "up" | "down" | "left" | "right";
  value: number;
  /**
   * Where the badge sits, in the axis's own units. Not always the value: a
   * pressure altitude rides a density-altitude scale, and a wind rides |v|.
   */
  axisValue: number;
  text: string;
  secondaryText?: string;
  label: string;
  color: string;
  drag?: BadgeDrag | undefined;
  toggle?: BadgeToggle;
}

/** A read-only badge showing where one of the model's answers lands. */
export interface OutputBadge {
  /** Key in the chart's anchors. */
  anchor: string;
  /**
   * Chart-axis value, which positions the badge. Where a safety factor
   * applies this stays the *POH* figure: the factored distance is not a point
   * on the printed chart, so plotting it there would misread the scan.
   */
  value: number;
  text: string;
  /** A second number the reader should weigh, e.g. a factored distance. */
  secondaryText?: string;
  label: string;
}

/**
 * For inputs whose position on the axis is not the value itself. The wind
 * panels are the case in point: the chart mirrors tailwind into the headwind
 * band, so the axis carries |v| and a pixel cannot recover the sign. The
 * handle then drags magnitude and the badge's toggle supplies the sign.
 */
export interface AxisProjection {
  /** Input value → axis-space value. */
  toAxis: (value: number) => number;
  /** Axis-space value → input value, given the input's current value. */
  fromAxis: (axisValue: number, current: number) => number;
  axisMin: number;
  axisMax: number;
  /** Overrides the badge text, which is otherwise `${value} ${unit}`. */
  text?: (value: number) => string;
  /** Overrides the spoken value. */
  valueText?: (value: number) => string;
}

export interface HandleWiring {
  anchors: ChartAnchors;
  controls: Record<string, ControlSpec>;
  values: Record<string, number>;
  /**
   * One setter per draggable input — not a single patch function, because a
   * page's state often holds booleans and strings too, and those must not have
   * to be widened into a numeric patch type just to move a handle.
   */
  setters: Record<string, (value: number) => void>;
  outputs?: OutputBadge[];
  /**
   * A word under the value, for badges that would otherwise be
   * indistinguishable: two OATs, or two pressure altitudes, sharing one axis
   * *and* one domain. Where the quantities differ — fuel against time, KIAS
   * against KCAS — the number and its unit already say which is which.
   */
  captions?: Record<string, string>;
  /** Branch pickers for inputs the chart draws as more than one line. */
  toggles?: Record<string, BadgeToggle>;
  projections?: Record<string, AxisProjection>;
}

function format(value: number, spec: ControlSpec): string {
  return `${value} ${spec.unit}`;
}

export function resolveBadges(meta: ChartMeta, wiring: HandleWiring): ResolvedBadge[] {
  const badges: ResolvedBadge[] = [];

  for (const [key, anchor] of Object.entries(wiring.anchors)) {
    const spec = wiring.controls[key];
    const axis = meta.axes[anchor.axis];
    const value = wiring.values[key];
    // Anchors also cover outputs, which have no control spec — those are added
    // below from `outputs`, where the value comes from the model.
    const setter = wiring.setters[key];
    if (!spec || !axis || value === undefined) continue;
    const projection = wiring.projections?.[key];
    badges.push({
      id: key,
      axis,
      atPx: anchor.atPx,
      point: anchor.point,
      value,
      axisValue: projection ? projection.toAxis(value) : value,
      text: projection?.text?.(value) ?? format(value, spec),
      secondaryText: wiring.captions?.[key],
      label: `${spec.label} — drag along the chart axis`,
      color: SECTION_COLORS[anchor.color ?? "entry"],
      drag: setter && {
        // Honour the slider's shaded dead band as the real floor.
        min: projection?.axisMin ?? spec.softMin ?? spec.min,
        max: projection?.axisMax ?? spec.max,
        step: spec.step,
        unit: spec.unit,
        current: projection ? projection.toAxis(value) : value,
        valueText: projection?.valueText?.(value),
        onChange: (axisValue) => setter(projection ? projection.fromAxis(axisValue, value) : axisValue),
      },
      toggle: wiring.toggles?.[key],
    });
  }

  for (const output of wiring.outputs ?? []) {
    const anchor = wiring.anchors[output.anchor];
    const axis = anchor && meta.axes[anchor.axis];
    if (!anchor || !axis) {
      // Silently dropping this is how a renamed anchor loses a read-out
      // without anyone noticing, so say so in development.
      if (import.meta.env.DEV) console.warn(`${meta.id}: no anchor named "${output.anchor}" for read-out "${output.label}"`);
      continue;
    }
    badges.push({
      id: output.anchor,
      axis,
      atPx: anchor.atPx,
      point: anchor.point,
      value: output.value,
      axisValue: output.value,
      text: output.text,
      secondaryText: output.secondaryText ?? wiring.captions?.[output.anchor],
      label: output.label,
      color: SECTION_COLORS[anchor.color ?? "result"],
    });
  }

  return badges;
}
