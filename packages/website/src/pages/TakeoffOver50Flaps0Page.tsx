import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig509Meta, fig509Trace } from "../charts/fig509";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { TakeoffOver50Flaps0Inputs } from "../model/takeoffOver50Flaps0";
import { CHART_EXAMPLE_5_09, takeoffOver50Flaps0 } from "../model/takeoffOver50Flaps0";

export const chartEntry = {
  id: "fig-5-09",
  label: "Takeoff over 50 ft — flaps 0° (Fig 5-9)",
  Component: TakeoffOver50Flaps0Page,
};

export function TakeoffOver50Flaps0Page() {
  const [inputs, setInputs] = useState<TakeoffOver50Flaps0Inputs>(CHART_EXAMPLE_5_09);
  const result = takeoffOver50Flaps0(inputs);
  const { polylines, marker } = fig509Trace(inputs, result);

  const set = (k: keyof TakeoffOver50Flaps0Inputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

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
                { label: "Distance over 50 ft", value: `${Math.round(result.distanceOver50Ft)} ft`, emphasize: true },
                { label: "Lift-off", value: `${result.vLofKias.toFixed(0)} KIAS / ${result.vLofKtas.toFixed(0)} KTAS`, emphasize: true },
                { label: "Barrier (50 ft)", value: `${result.v50Kias.toFixed(0)} KIAS / ${result.v50Ktas.toFixed(0)} KTAS`, emphasize: true },
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
              {fig509Meta.title}
            </Typography>
            <ChartOverlay meta={fig509Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Chart quirks: the chart's own printed example (2100 ft) sits 1–2.5% above its own guide curves, so the model reads slightly low against it. The weight correction is not a constant power law (local exponent drifts ≈2.0 → 2.7 toward light weight), the speed strips are linear in weight, and the bottom 500-ft headwind guide implies an absurd ~25-kt reference speed — a drafting error excluded from the fit.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
