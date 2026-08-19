import { Box, Slider, Typography } from "@mui/material";

export function InputSlider(props: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Tick marks; `true` uses the step, or pass explicit values. */
  marks?: boolean | { value: number; label?: string }[];
  /**
   * Lowest selectable value when the track extends below it — the span from
   * `min` to `softMin` is shaded and cannot be dragged into. Used where the
   * chart simply publishes nothing below a threshold.
   */
  softMin?: number;
}) {
  const { label, unit, value, min, max, step, onChange, marks, softMin } = props;
  const deadPct = softMin === undefined ? 0 : ((softMin - min) / (max - min)) * 100;

  return (
    <Box>
      <Typography variant="body2" gutterBottom>
        {label}: <strong>{value}</strong> {unit}
      </Typography>
      <Slider
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        marks={marks}
        onChange={(_, v) => onChange(softMin === undefined ? v : Math.max(softMin, v))}
        valueLabelDisplay="auto"
        sx={
          deadPct > 0
            ? {
                // Grey out the span the chart publishes nothing for; it sits
                // above the filled track so the unusable range stays obvious.
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  width: `${deadPct}%`,
                  height: 2, // matches the small-slider track exactly, so it reads as greyed-out rail
                  transform: "translateY(-50%)",
                  borderRadius: 1,
                  backgroundColor: (theme) => theme.palette.grey[400],
                  zIndex: 2,
                  pointerEvents: "none",
                },
              }
            : undefined
        }
      />
    </Box>
  );
}
