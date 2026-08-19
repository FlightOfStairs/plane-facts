import { Box } from "@mui/material";
import type { ChartMeta, Polyline } from "../charts/types";
import { SECTION_COLORS } from "../charts/types";

/**
 * Original POH chart scan with model-derived lines drawn over it.
 * The lines are for demonstration only — all output numbers come from the
 * mathematical model, never from reading the overlay.
 *
 * Each polyline is drawn with a white casing under a bold colored stroke so
 * the trace stays legible over the dense scanned grid. Stroke widths are in
 * asset-pixel units; the printed chart strokes measure 2-4 px there, so the
 * overlay is deliberately several times heavier.
 */
export function ChartOverlay(props: { meta: ChartMeta; polylines: Polyline[]; marker?: [number, number] }) {
  const { meta, polylines, marker } = props;
  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <img src={meta.image} alt={`POH chart scan: ${meta.title}`} style={{ width: "100%", height: "auto", display: "block" }} />
      <svg viewBox={`0 0 ${meta.widthPx} ${meta.heightPx}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        {polylines.map((line, i) => {
          const pts = line.points.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <g key={i}>
              <polyline points={pts} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
              <polyline points={pts} fill="none" stroke={line.color ?? SECTION_COLORS.entry} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={line.dashed ? "13 9" : undefined} opacity={0.95} />
            </g>
          );
        })}
        {marker && (
          <>
            <circle cx={marker[0]} cy={marker[1]} r={11} fill="#ffffff" opacity={0.8} />
            <circle cx={marker[0]} cy={marker[1]} r={8} fill={SECTION_COLORS.result} />
          </>
        )}
      </svg>
    </Box>
  );
}
