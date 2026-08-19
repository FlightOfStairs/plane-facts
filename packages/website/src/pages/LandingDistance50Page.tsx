import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig535Meta, fig535Trace } from "../charts/fig535";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { LandingDistance50Inputs } from "../model/landingDistance50";
import { CHART_EXAMPLE_5_35, landingDistance50 } from "../model/landingDistance50";

export const chartEntry = {
  id: "fig-5-35",
  label: "Landing distance over 50 ft (Fig 5-35)",
  Component: LandingDistance50Page,
};

export function LandingDistance50Page() {
  const [inputs, setInputs] = useState<LandingDistance50Inputs>(CHART_EXAMPLE_5_35);
  const result = landingDistance50(inputs);
  const { polylines, marker } = fig535Trace(inputs, result);

  const set = (k: keyof LandingDistance50Inputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Pressure altitude" unit="ft" value={inputs.pressureAltitudeFt} min={0} max={7000} step={100} onChange={set("pressureAltitudeFt")} />
            <InputSlider label="OAT" unit="°C" value={inputs.oatC} min={-40} max={40} step={1} onChange={set("oatC")} />
            <InputSlider label="Weight" unit="lb" value={inputs.weightLb} min={1700} max={2440} step={5} onChange={set("weightLb")} />
            <InputSlider label="Wind (+HW / −TW)" unit="kt" value={inputs.windKt} min={-5} max={15} step={1} onChange={set("windKt")} />
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` },
                { label: "S₀ @ 2440 lb, calm", value: `${Math.round(result.s0Ft)} ft` },
                { label: "× weight", value: `${Math.round(result.s1Ft)} ft` },
                { label: "× wind", value: `× ${result.windFactor.toFixed(3)}` },
                { label: "Distance over 50 ft", value: `${Math.round(result.distanceOver50FtFt)} ft`, emphasize: true },
                { label: "Approach / touchdown", value: `${result.approachKias.toFixed(0)} / ${result.touchdownKias.toFixed(0)} KIAS`, emphasize: true },
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
              {fig535Meta.title}
            </Typography>
            <ChartOverlay meta={fig535Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Chart quirk: the printed &ldquo;REF. LINE — 2400 LBS.&rdquo; label is a misprint — the line&apos;s geometry sits at 2440 lb, the anchor all four takeoff/landing nomographs share (Fig 5-37 prints it correctly). Note the tailwind penalty is roughly 3× the headwind credit.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
