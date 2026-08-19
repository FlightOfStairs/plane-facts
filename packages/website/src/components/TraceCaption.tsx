import { Box, Typography } from "@mui/material";
import { SECTION_COLORS } from "../charts/types";

const SWATCH_LABELS: Record<keyof typeof SECTION_COLORS, string> = {
  entry: "altitude / entry",
  weight: "weight",
  wind: "wind",
  result: "result",
};

/**
 * Caption + color legend under a chart overlay. Pass the section keys the
 * chart's trace actually uses, in reading order.
 */
export function TraceCaption(props: {
  sections: (keyof typeof SECTION_COLORS)[];
  /** Override the per-section labels, aligned with `sections`. */
  labels?: string[];
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        Trace drawn from the model for illustration — the printed numbers are the model outputs.
      </Typography>
      {props.sections.map((s, i) => (
        <Box key={s} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <Box
            sx={{
              width: 14,
              height: 4,
              borderRadius: 1,
              bgcolor: SECTION_COLORS[s],
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {props.labels?.[i] ?? SWATCH_LABELS[s]}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
