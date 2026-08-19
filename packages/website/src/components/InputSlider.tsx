import { Box, Slider, Typography } from "@mui/material";

export function InputSlider(props: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const { label, unit, value, min, max, step, onChange } = props;
  return (
    <Box>
      <Typography variant="body2" gutterBottom>
        {label}: <strong>{value}</strong> {unit}
      </Typography>
      <Slider size="small" value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(v)} valueLabelDisplay="auto" />
    </Box>
  );
}
