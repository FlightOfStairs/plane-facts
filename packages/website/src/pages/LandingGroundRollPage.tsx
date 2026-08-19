import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig537Meta, fig537Trace } from "../charts/fig537";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { LandingGroundRollInputs } from "../model/landingGroundRoll";
import { CHART_EXAMPLE_5_37, landingGroundRoll } from "../model/landingGroundRoll";

export const chartEntry = {
  id: "fig-5-37",
  label: "Landing ground roll (Fig 5-37)",
  Component: LandingGroundRollPage,
};

export function LandingGroundRollPage() {
  const [inputs, setInputs] = useState<LandingGroundRollInputs>(CHART_EXAMPLE_5_37);
  const result = landingGroundRoll(inputs);
  const { polylines, marker } = fig537Trace(inputs, result);

  const set = (k: keyof LandingGroundRollInputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

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
                { label: "Ground roll", value: `${Math.round(result.groundRollFt)} ft`, emphasize: true },
                { label: "Touchdown", value: `${result.touchdownKias.toFixed(0)} KIAS`, emphasize: true },
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
              {fig537Meta.title}
            </Typography>
            <ChartOverlay meta={fig537Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              This chart&apos;s &ldquo;REF. LINE 2440 LBS.&rdquo; is printed correctly (its sibling Fig 5-35 mislabels the same line &ldquo;2400 LBS.&rdquo;). Wind acts on the ground roll from a lower reference speed, so the tailwind penalty — roughly 3× the headwind credit — bites hardest here.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
