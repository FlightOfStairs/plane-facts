import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import type { ChartMeta, Polyline } from "../charts/types";
import { SECTION_COLORS } from "../charts/types";

/** Stroke width in viewBox units when the scan renders near full size. */
const BASE_STROKE_UNITS = 5;
/**
 * Never let the trace render thinner than this many CSS pixels. The SVG scales
 * with the scan, so a viewBox-unit stroke shrinks with it — on a phone, 1050
 * units squeezed into ~370 px turns a 5-unit stroke into ~1.8 px, which
 * disappears into the printed grid.
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
 * Each polyline is drawn with a white casing under a bold colored stroke so
 * the trace stays legible over the dense scanned grid. The printed strokes
 * measure 2–4 viewBox px, so the overlay is deliberately heavier — and it
 * thickens as the chart shrinks, holding a usable width on small screens.
 */
export function ChartOverlay(props: { meta: ChartMeta; polylines: Polyline[]; marker?: [number, number] }) {
  const { meta, polylines, marker } = props;
  const [boxRef, renderedWidth] = useRenderedWidth();

  const scale = renderedWidth > 0 ? renderedWidth / meta.widthPx : 1;
  const stroke = Math.max(BASE_STROKE_UNITS, MIN_STROKE_CSS_PX / scale);
  const casing = stroke * 1.8;
  const dash = `${(stroke * 2.6).toFixed(1)} ${(stroke * 1.8).toFixed(1)}`;

  return (
    <Box ref={boxRef} sx={{ position: "relative", width: "100%" }}>
      <img src={meta.image} alt={`POH chart scan: ${meta.title}`} style={{ width: "100%", height: "auto", display: "block" }} />
      <svg viewBox={`0 0 ${meta.widthPx} ${meta.heightPx}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        {polylines.map((line, i) => {
          const pts = line.points.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <g key={i}>
              <polyline points={pts} fill="none" stroke="#ffffff" strokeWidth={casing} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
              <polyline points={pts} fill="none" stroke={line.color ?? SECTION_COLORS.entry} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={line.dashed ? dash : undefined} opacity={0.95} />
            </g>
          );
        })}
        {marker && (
          <>
            <circle cx={marker[0]} cy={marker[1]} r={stroke * 2.2} fill="#ffffff" opacity={0.8} />
            <circle cx={marker[0]} cy={marker[1]} r={stroke * 1.6} fill={SECTION_COLORS.result} />
          </>
        )}
      </svg>
    </Box>
  );
}
