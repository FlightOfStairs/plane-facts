/**
 * Pointer-to-chart-value arithmetic for the overlay's draggable handles.
 *
 * Deliberately free of React and the DOM: jsdom implements neither
 * `setPointerCapture` nor SVG layout, so keeping every calculation here is what
 * makes the drag testable at all. The components above only supply a rect and
 * the event's client coordinates.
 */

import type { AxisMeta, ChartMeta } from "../charts/types";
import { axisPx, axisValue } from "../charts/types";

/** The part of DOMRect this needs, so a test can pass an object literal. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Client coordinates → viewBox units, for an `<svg>` laid out at width:100%
 * with the default preserveAspectRatio. The scan's aspect ratio drives the
 * box, so the centring slack is normally nil, but computing it keeps the
 * mapping exact if the box is ever letterboxed.
 */
export function clientToViewBox(rect: Rect, meta: ChartMeta, clientX: number, clientY: number): { x: number; y: number } {
  const scale = Math.min(rect.width / meta.widthPx, rect.height / meta.heightPx) || 1;
  const slackX = (rect.width - meta.widthPx * scale) / 2;
  const slackY = (rect.height - meta.heightPx * scale) / 2;
  return { x: (clientX - rect.left - slackX) / scale, y: (clientY - rect.top - slackY) / scale };
}

/** Decimal places implied by a step, so 0.1-sized steps don't collect float dust. */
export function decimalsFor(step: number): number {
  const dot = String(step).indexOf(".");
  return dot < 0 ? 0 : String(step).length - dot - 1;
}

/** Snap to the step's grid measured from `min`, then clamp into range. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(decimalsFor(step)));
}

/**
 * The whole drag as one pure function: where the pointer is now, plus the
 * offset grabbed at pointerdown so the badge doesn't jump under the finger,
 * gives the value the input should take.
 *
 * `pxPerUnit` is negative on every y axis (image y grows downward) and on the
 * weight axes (which run right to left), so nothing here may assume that a
 * larger pixel means a larger value — `axisValue` carries the sign through.
 */
export function dragToValue(args: { rect: Rect; meta: ChartMeta; axis: AxisMeta; clientX: number; clientY: number; grabOffsetPx: number; min: number; max: number; step: number; unproject?: (axis: AxisMeta, px: number) => number }): number {
  const point = clientToViewBox(args.rect, args.meta, args.clientX, args.clientY);
  const px = (args.axis.orient === "y" ? point.y : point.x) - args.grabOffsetPx;
  const raw = (args.unproject ?? axisValue)(args.axis, px);
  return snapToStep(raw, args.min, args.max, args.step);
}

/** Pixel a badge sits at, honouring any per-chart projection (e.g. |wind|). */
export function badgePx(axis: AxisMeta, value: number, project?: (axis: AxisMeta, value: number) => number): number {
  return (project ?? axisPx)(axis, value);
}
