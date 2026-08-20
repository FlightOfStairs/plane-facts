import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import type { ChartMeta, Polyline } from "../charts/types";
import { SECTION_COLORS } from "../charts/types";
import type { ResolvedBadge } from "../lib/chartHandles";
import { AxisBadge } from "./AxisBadge";

/**
 * Stroke width in viewBox units when the scan renders near full size — close to
 * the printed chart lines (2–4 units), so the trace reads as drawn on the chart
 * rather than pasted over it.
 */
const BASE_STROKE_UNITS = 3.2;
/**
 * Never let the trace render thinner than this many CSS pixels. The SVG scales
 * with the scan, so a viewBox-unit stroke shrinks with it — on a phone, 1050
 * units squeezed into ~370 px would turn the base stroke into barely 1 px,
 * which disappears into the printed grid. Small screens therefore get a
 * proportionally bolder trace than desktop, which is the intent.
 */
const MIN_STROKE_CSS_PX = 3.5;

/** Rendered width of an element, so stroke width can compensate for scaling. */
function useRenderedWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Original POH chart scan with model-derived lines drawn over it.
 * The lines are for demonstration only — all output numbers come from the
 * mathematical model, never from reading the overlay.
 *
 * Each polyline is drawn with a white casing under a colored stroke so the
 * trace stays legible over the dense scanned grid, and it thickens as the
 * chart shrinks, holding a usable width on small screens.
 */
export function ChartOverlay(props: {
  meta: ChartMeta;
  polylines: Polyline[];
  marker?: [number, number];
  /** Several labelled points, each able to carry its own colour. */
  markers?: { at: [number, number]; color: string; label?: string }[];
  /** Draggable input handles and read-only result read-outs. */
  badges?: ResolvedBadge[];
}) {
  const { meta, polylines, marker, markers, badges } = props;
  const [boxRef, renderedWidth] = useRenderedWidth();
  /** Last badge touched, redrawn on top so a dragged handle is never buried. */
  const [activeBadge, setActiveBadge] = useState<string | null>(null);

  const scale = renderedWidth > 0 ? renderedWidth / meta.widthPx : 1;
  const stroke = Math.max(BASE_STROKE_UNITS, MIN_STROKE_CSS_PX / scale);
  const casing = stroke * 1.8;
  const dash = `${(stroke * 2.6).toFixed(1)} ${(stroke * 1.8).toFixed(1)}`;

  return (
    <Box ref={boxRef} sx={{ position: "relative", width: "100%" }}>
      <img src={meta.image} alt={`POH chart scan: ${meta.title}`} style={{ width: "100%", height: "auto", display: "block" }} />
      {/* The trace is decorative, but the handles are real controls, so the
          svg can only be aria-hidden while there are none — focusable content
          inside an aria-hidden subtree is an accessibility fault. */}
      <svg viewBox={`0 0 ${meta.widthPx} ${meta.heightPx}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: badges?.length ? undefined : "none" }} aria-hidden={badges?.length ? undefined : true} role={badges?.length ? "group" : undefined} aria-label={badges?.length ? `${meta.title} — draggable value handles` : undefined}>
        <g aria-hidden style={{ pointerEvents: "none" }}>
          {polylines.map((line, i) => {
            const pts = line.points.map(([x, y]) => `${x},${y}`).join(" ");
            const sw = stroke * (line.widthScale ?? 1);
            const cw = casing * (line.widthScale ?? 1);
            return (
              <g key={i}>
                <polyline points={pts} fill="none" stroke="#ffffff" strokeWidth={cw} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
                <polyline points={pts} fill="none" stroke={line.color ?? SECTION_COLORS.entry} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={line.dashed ? dash : undefined} opacity={0.95} />
              </g>
            );
          })}
          {marker && (
            <>
              <circle cx={marker[0]} cy={marker[1]} r={stroke * 2.2} fill="#ffffff" opacity={0.8} />
              <circle cx={marker[0]} cy={marker[1]} r={stroke * 1.6} fill={SECTION_COLORS.result} />
            </>
          )}
          {markers?.map((mk) => (
            <g key={`${mk.label ?? ""}${mk.at[0]},${mk.at[1]}`}>
              <circle cx={mk.at[0]} cy={mk.at[1]} r={stroke * 2.2} fill="#ffffff" opacity={0.85} />
              <circle cx={mk.at[0]} cy={mk.at[1]} r={stroke * 1.5} fill={mk.color} />
              {mk.label && (
                <text x={mk.at[0] + stroke * 2.8} y={mk.at[1] - stroke * 1.4} fontSize={stroke * 3.4} fill={mk.color} stroke="#ffffff" strokeWidth={stroke * 0.7} paintOrder="stroke" fontWeight={600}>
                  {mk.label}
                </text>
              )}
            </g>
          ))}
        </g>
        {badges
          ?.slice()
          .sort((a, b) => Number(a.id === activeBadge) - Number(b.id === activeBadge))
          .map((badge) => (
            <AxisBadge key={badge.id} meta={meta} scale={scale} onActivate={() => setActiveBadge(badge.id)} {...badge} />
          ))}
      </svg>
    </Box>
  );
}
