import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { AxisMeta, ChartMeta } from "../charts/types";
import { axisPx } from "../charts/types";
import { clientToViewBox, dragToValue } from "../lib/chartGeometry";

/**
 * Badge text size in viewBox units at full scan size. Deliberately small: a
 * badge has to fit in the margin outside the plot without covering the printed
 * scale it points at, and there can be five of them along one edge.
 */
const BASE_FONT_UNITS = 13;
/** …but never smaller than this on screen — the same floor the strokes use. */
const MIN_FONT_CSS_PX = 9;
/** Hit target, applied to the invisible rect rather than the visible pill, so
 *  a small badge is still catchable with a thumb. */
const MIN_TARGET_CSS_PX = 30;
/** Rough advance width of the UI font's digits, in ems. */
const EM_PER_CHAR = 0.58;

/** One branch of an input that the chart draws as more than one line. */
export interface BadgeToggle {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  /** Describes the choice for assistive tech, e.g. "Wind direction". */
  label: string;
}

export interface BadgeDrag {
  /** Bounds in *axis* space, which is not always input space — the wind axis
   *  plots |v|, so its handle drags 0…15 while the input stays signed. */
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Where the handle currently sits, in axis space — what a drag moves. */
  current: number;
  /**
   * The same handle in *input* space, for assistive tech. On a pressure-altitude
   * handle the axis carries a distance, and announcing that would be nonsense:
   * what the user is setting is an altitude.
   */
  ariaValue: number;
  ariaMin: number;
  ariaMax: number;
  /** Receives an axis-space value; the wiring maps it back to the input. */
  onChange: (axisValue: number) => void;
  /**
   * Keyboard nudge, in whole steps of the *input*. Arrow keys cannot work in
   * axis space: one step of power is not one step of the endurance the axis
   * carries.
   */
  onStep: (steps: number) => void;
  /** Spoken value, where the number alone is ambiguous ("15 kt headwind"). */
  valueText?: string;
}

/**
 * A value badge pinned to a chart axis: an arrow touching the axis at the
 * value, and a pill carrying the number. Given `drag`, it is a handle — drag
 * it along its axis, or focus it and use the arrow keys — and it writes to the
 * very same state the page's slider writes, so the two can never disagree.
 *
 * Without `drag` it is a read-only read-out of a model result.
 */
export function AxisBadge(props: { meta: ChartMeta; axis: AxisMeta; /** Rendered width ÷ asset width, for the CSS-pixel floors. */ scale: number; atPx: number; point: "up" | "down" | "left" | "right"; /** Position along the axis, in axis units — not always the value itself. */ axisValue: number; text: string; /** A second number to weigh, e.g. "(1300 ft)" factored. */ secondaryText?: string; label: string; color: string; drag?: BadgeDrag; toggle?: BadgeToggle; onActivate?: () => void }) {
  const { meta, axis, scale, atPx, point, axisValue, text, secondaryText, label, color, drag, toggle } = props;
  const [focused, setFocused] = useState(false);
  const grabOffsetPx = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const groupRef = useRef<SVGGElement>(null);
  const draggable = Boolean(drag);

  /**
   * Stop the browser claiming the gesture as a scroll. `touch-action: none` is
   * set below and is honoured on ordinary boxes, but Chrome ignores it on SVG
   * child elements: a touch drag on a badge gets four pointermoves and then a
   * pointercancel, which is why it used to move a little and stop. React makes
   * its own touch listeners passive, so preventDefault has to come from a
   * listener registered by hand.
   */
  useEffect(() => {
    const el = groupRef.current;
    if (!el || !draggable) return undefined;
    const stopScrolling = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchstart", stopScrolling, { passive: false });
    el.addEventListener("touchmove", stopScrolling, { passive: false });
    return () => {
      el.removeEventListener("touchstart", stopScrolling);
      el.removeEventListener("touchmove", stopScrolling);
    };
  }, [draggable]);

  /** CSS pixels → viewBox units. */
  const units = (css: number) => css / (scale || 1);

  const font = Math.max(BASE_FONT_UNITS, units(MIN_FONT_CSS_PX));
  const padX = font * 0.4;
  const subFont = font * 0.82;
  // The second line carries the CAA-factored distance. It sits under the chart
  // figure, in parentheses, because only the chart figure is a point on the
  // scan behind it — the factored number is derived from it, not read off it.
  const height = secondaryText ? font * 2.7 : font * 1.6;
  const textWidth = text.length * EM_PER_CHAR * font;
  const secondaryWidth = secondaryText ? secondaryText.length * EM_PER_CHAR * subFont : 0;
  const toggleWidth = toggle ? font * 0.5 + (toggle.options.find((o) => o.value === toggle.value)?.label.length ?? 0) * EM_PER_CHAR * font : 0;
  const width = Math.max(font * 3, Math.max(textWidth + toggleWidth, secondaryWidth) + padX * 2);
  const arrow = font * 0.5;
  const halfBase = font * 0.5;

  const along = axisPx(axis, axisValue);
  const vertical = point === "up" || point === "down";
  // The arrow points from the badge at the axis, so an up-pointing arrow puts
  // the badge *below* the line it points at, with its tip on that line.
  const side = point === "down" || point === "right" ? -1 : 1;

  // Clamp onto the sheet in both directions rather than flipping to the other
  // side: a badge that hops inside the plot when the margin is tight reads as
  // a different thing entirely. The arrow tip always stays on the axis, so a
  // clamped pill reads as a callout rather than as a wrong value.
  const clamp = (v: number, half: number, max: number) => Math.min(Math.max(v, half), max - half);
  const perpendicular = atPx + side * (arrow + (vertical ? height : width) / 2);
  const cx = vertical ? clamp(along, width / 2, meta.widthPx) : clamp(perpendicular, width / 2, meta.widthPx);
  const cy = vertical ? clamp(perpendicular, height / 2, meta.heightPx) : clamp(along, height / 2, meta.heightPx);

  const tipX = vertical ? along : atPx;
  const tipY = vertical ? atPx : along;
  const baseX = vertical ? along : atPx + side * arrow;
  const baseY = vertical ? atPx + side * arrow : along;
  const triangle = vertical ? `${tipX},${tipY} ${baseX - halfBase},${baseY} ${baseX + halfBase},${baseY}` : `${tipX},${tipY} ${baseX},${baseY - halfBase} ${baseX},${baseY + halfBase}`;

  // Floor the hit target along the drag axis; a 21 CSS px pill is fine to look
  // at on a phone but not to catch with a thumb.
  const hitWidth = vertical ? Math.max(width, units(MIN_TARGET_CSS_PX)) : width + arrow;
  const hitHeight = vertical ? height + arrow : Math.max(height, units(MIN_TARGET_CSS_PX));

  const svgRect = (e: ReactPointerEvent<SVGGElement>) => e.currentTarget.ownerSVGElement?.getBoundingClientRect();

  function onPointerDown(e: ReactPointerEvent<SVGGElement>) {
    if (!drag || !e.isPrimary) return;
    const rect = svgRect(e);
    if (!rect) return;
    const p = clientToViewBox(rect, meta, e.clientX, e.clientY);
    grabOffsetPx.current = (axis.orient === "y" ? p.y : p.x) - along;
    activePointerId.current = e.pointerId;
    // jsdom has no pointer capture, so this must stay optional for the tests.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    props.onActivate?.();
    e.preventDefault();
  }

  function onPointerMove(e: ReactPointerEvent<SVGGElement>) {
    if (!drag || activePointerId.current !== e.pointerId) return;
    const rect = svgRect(e);
    if (!rect) return;
    e.preventDefault();
    const next = dragToValue({ rect, meta, axis, clientX: e.clientX, clientY: e.clientY, grabOffsetPx: grabOffsetPx.current, min: drag.min, max: drag.max, step: drag.step });
    // Re-rendering the trace re-runs the model ~40 times: skip no-op moves.
    if (next !== drag.current) drag.onChange(next);
  }

  function endDrag(e: ReactPointerEvent<SVGGElement>) {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function onKeyDown(e: KeyboardEvent<SVGGElement>) {
    if (!drag) return;
    const bump = e.shiftKey ? 10 : 1;
    let steps: number;
    switch (e.key) {
      // Value semantics, not pixel semantics: Up/Right always increase, which
      // stays right on the y axes and the right-to-left weight axes alike.
      case "ArrowRight":
      case "ArrowUp":
        steps = bump;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        steps = -bump;
        break;
      case "Home":
        steps = -Infinity;
        break;
      case "End":
        steps = Infinity;
        break;
      default:
        return;
    }
    e.preventDefault();
    drag.onStep(steps);
  }

  const cycleToggle = () => {
    if (!toggle) return;
    const i = toggle.options.findIndex((o) => o.value === toggle.value);
    const next = toggle.options[(i + 1) % toggle.options.length];
    if (next) toggle.onChange(next.value);
  };

  const a11y = drag ? ({ role: "slider", tabIndex: 0, "aria-label": label, "aria-valuenow": drag.ariaValue, "aria-valuemin": drag.ariaMin, "aria-valuemax": drag.ariaMax, "aria-valuetext": drag.valueText ?? `${drag.ariaValue} ${drag.unit}`, "aria-orientation": axis.orient === "y" ? ("vertical" as const) : ("horizontal" as const) } as const) : ({ role: "img", "aria-label": `${label}: ${text}` } as const);

  const toggleLabel = toggle?.options.find((o) => o.value === toggle.value)?.label ?? "";
  const toggleX = cx + width / 2 - padX - toggleWidth / 2;

  return (
    <g>
      <g
        ref={groupRef}
        {...a11y}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          // Without this, dragging on a phone scrolls the page instead.
          touchAction: "none",
          cursor: drag ? (axis.orient === "y" ? "ns-resize" : "ew-resize") : "default",
          outline: "none",
        }}
      >
        <polygon points={triangle} fill={color} />
        {/* Transparent, not fill="none" — only the former is hit-testable. */}
        <rect x={cx - hitWidth / 2} y={cy - hitHeight / 2} width={hitWidth} height={hitHeight} fill="transparent" />
        <rect x={cx - width / 2} y={cy - height / 2} width={width} height={height} rx={height * 0.42} fill="#ffffff" fillOpacity={0.94} stroke={color} strokeWidth={Math.max(2, units(1.5))} />
        {focused && <rect x={cx - width / 2 - units(3)} y={cy - height / 2 - units(3)} width={width + units(6)} height={height + units(6)} rx={height * 0.5} fill="none" stroke={color} strokeWidth={units(2)} strokeDasharray={`${units(3)} ${units(2)}`} />}
        <text x={toggle ? cx - width / 2 + padX : cx} y={secondaryText ? cy - font * 0.6 : cy} textAnchor={toggle ? "start" : "middle"} dominantBaseline="central" fontSize={font} fontWeight={600} fill={color} pointerEvents="none">
          {text}
        </text>
        {secondaryText && (
          <text x={cx} y={cy + font * 0.7} textAnchor="middle" dominantBaseline="central" fontSize={subFont} fontWeight={600} fill={color} opacity={0.8} pointerEvents="none">
            {secondaryText}
          </text>
        )}
      </g>
      {toggle && (
        <g
          // oxlint-disable-next-line prefer-tag-over-role -- a <button> cannot be a child of <svg>; this is an SVG group
          role="button"
          tabIndex={0}
          aria-label={`${toggle.label}: ${toggleLabel}`}
          onPointerDown={(e) => {
            // Must not start a drag of the badge underneath.
            e.stopPropagation();
            e.preventDefault();
            cycleToggle();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            cycleToggle();
          }}
          style={{ touchAction: "none", cursor: "pointer", outline: "none" }}
        >
          <rect x={toggleX - toggleWidth / 2 - font * 0.15} y={cy - height / 2 + units(2)} width={toggleWidth + font * 0.3} height={height - units(4)} rx={height * 0.3} fill={color} />
          <text x={toggleX} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={font * 0.82} fontWeight={700} fill="#ffffff" pointerEvents="none">
            {toggleLabel}
          </text>
        </g>
      )}
    </g>
  );
}
