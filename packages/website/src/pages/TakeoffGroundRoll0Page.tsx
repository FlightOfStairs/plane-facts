import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig507Meta, fig507Trace } from "../charts/fig507";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { TakeoffRoll0Inputs } from "../model/takeoffGroundRoll0";
import { CHART_EXAMPLE_5_07, takeoffGroundRoll0 } from "../model/takeoffGroundRoll0";

export const chartEntry = {
  id: "fig-5-07",
  label: "Takeoff ground roll — flaps 0° (Fig 5-7)",
  Component: TakeoffGroundRoll0Page,
};

export function TakeoffGroundRoll0Page() {
  const [inputs, setInputs] = useState<TakeoffRoll0Inputs>(CHART_EXAMPLE_5_07);
  const result = takeoffGroundRoll0(inputs);
  const { polylines, marker } = fig507Trace(inputs, result);

  const set = (k: keyof TakeoffRoll0Inputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Pressure altitude" unit="ft" value={inputs.pressureAltitudeFt} min={0} max={6000} step={100} onChange={set("pressureAltitudeFt")} />
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
                { label: "Ground roll", value: `${Math.round(result.groundRollFt)} ft`, emphasize: true },
                { label: "Lift-off", value: `${result.vLofKias.toFixed(0)} KIAS / ${result.vLofKtas.toFixed(0)} KTAS`, emphasize: true },
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
              {fig507Meta.title}
            </Typography>
            <ChartOverlay meta={fig507Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Chart quirks: this 0°-flap chart uses a weight exponent of ≈2.34 (the 25°-flap Fig 5-11 uses 1.85), so the two ground-roll charts nominally cross near 2000 lb — a drafting artifact, not physics. The printed lift-off strip runs 1–1.5 kt below the √W law at light weight, and its 52 KIAS at 2440 lb is identical to the 25°-flap figure — a publication artifact.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
