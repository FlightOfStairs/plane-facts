import { Box } from "@mui/material";
import type { ChartMeta, Polyline } from "../charts/types";

/**
 * Original POH chart scan with model-derived lines drawn over it.
 * The lines are for demonstration only — all output numbers come from the
 * mathematical model, never from reading the overlay.
 */
export function ChartOverlay(props: { meta: ChartMeta; polylines: Polyline[]; marker?: [number, number] }) {
  const { meta, polylines, marker } = props;
  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <img src={meta.image} alt={`POH chart scan: ${meta.title}`} style={{ width: "100%", height: "auto", display: "block" }} />
      <svg viewBox={`0 0 ${meta.widthPx} ${meta.heightPx}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        {polylines.map((line, i) => (
          <polyline key={i} points={line.points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#d32f2f" strokeWidth={2} strokeDasharray={line.dashed ? "6 4" : undefined} opacity={0.85} />
        ))}
        {marker && <circle cx={marker[0]} cy={marker[1]} r={5} fill="#d32f2f" opacity={0.9} />}
      </svg>
    </Box>
  );
}
