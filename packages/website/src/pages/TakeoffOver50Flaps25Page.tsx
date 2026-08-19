import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig513Meta, fig513Trace } from "../charts/fig513";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { TakeoffOver50Flaps25Inputs } from "../model/takeoffOver50Flaps25";
import { CHART_EXAMPLE_5_13, takeoffOver50Flaps25 } from "../model/takeoffOver50Flaps25";

export const chartEntry = {
  id: "fig-5-13",
  label: "Takeoff over 50 ft — flaps 25° (Fig 5-13)",
  Component: TakeoffOver50Flaps25Page,
};

export function TakeoffOver50Flaps25Page() {
  const [inputs, setInputs] = useState<TakeoffOver50Flaps25Inputs>(CHART_EXAMPLE_5_13);
  const result = takeoffOver50Flaps25(inputs);
  const { polylines, marker } = fig513Trace(inputs, result);

  const set = (k: keyof TakeoffOver50Flaps25Inputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

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
              {fig513Meta.title}
            </Typography>
            <ChartOverlay meta={fig513Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Chart quirks: unlike Fig 5-11, the altitude fan here is not a plane in (PA, OAT) — a full quadratic is needed. The lift-off/barrier speed strips are linear in weight (not ∝ √W) and extend past the 1700-lb axis end; the barrier speed is ≈1.10 × lift-off throughout. The tailwind exponent is weakly constrained by the chart's short tailwind guides.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
