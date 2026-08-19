import { useState } from "react";
import { Card, CardContent, Grid, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig505Meta, fig505Trace } from "../charts/fig505";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { StallFlaps, StallInputs } from "../model/stallSpeed";
import { CHART_EXAMPLE, stallSpeed } from "../model/stallSpeed";

export const chartEntry = {
  id: "fig-5-05",
  label: "Stall speeds (Fig 5-5)",
  Component: StallSpeedPage,
};

export function StallSpeedPage() {
  const [inputs, setInputs] = useState<StallInputs>(CHART_EXAMPLE);
  const result = stallSpeed(inputs);
  const { polylines, marker } = fig505Trace(inputs, result);

  const set = (k: "weightLb" | "bankDeg") => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <ToggleButtonGroup exclusive size="small" fullWidth value={inputs.flaps} onChange={(_, v: StallFlaps | null) => v !== null && setInputs((prev) => ({ ...prev, flaps: v }))} sx={{ mb: 2 }}>
              <ToggleButton value={0}>Flaps 0°</ToggleButton>
              <ToggleButton value={40}>Flaps 40°</ToggleButton>
            </ToggleButtonGroup>
            <InputSlider label="Gross weight" unit="lb" value={inputs.weightLb} min={1600} max={2440} step={10} onChange={set("weightLb")} />
            <InputSlider label="Angle of bank" unit="°" value={inputs.bankDeg} min={0} max={60} step={1} onChange={set("bankDeg")} />
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Wings-level stall", value: `${result.wingsLevelIasKt.toFixed(1)} KIAS / ${result.wingsLevelCasKt.toFixed(1)} KCAS` },
                { label: "Load factor n", value: `${result.loadFactor.toFixed(2)} g` },
                { label: "Bank multiplier", value: `× ${result.bankFactorApplied.toFixed(3)}` },
                { label: "Stall speed", value: `${result.stallIasKt.toFixed(1)} KIAS`, emphasize: true },
                { label: "Stall speed", value: `${result.stallCasKt.toFixed(1)} KCAS`, emphasize: true },
              ]}
              warnings={result.warnings}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig505Meta.title}
            </Typography>
            <ChartOverlay meta={fig505Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration (following the solid indicated-speed curves, like the printed example); the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Quirks: the right-panel bank fan is one universal curve family V = V₀/cos(φ)^0.499 — exact load-factor physics (n = 1/cos φ, V ∝ √n) applied to any entry speed. The POH's own printed answer (44 KIAS at 2170 lb, 20°, flaps 40) is 0.5–1 kt generous against the chart's drawn curves; the model reads 43.5 KIAS.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
