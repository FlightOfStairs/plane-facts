import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig519Meta, fig519Trace } from "../charts/fig519";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { ClimbToInputs } from "../model/climbFuelTimeDistance";
import { CHART_EXAMPLE, climbFuelTimeDistance } from "../model/climbFuelTimeDistance";

export const chartEntry = {
  id: "fig-5-19",
  label: "Fuel, time & distance to climb (Fig 5-19)",
  Component: ClimbFuelTimeDistancePage,
};

export function ClimbFuelTimeDistancePage() {
  const [inputs, setInputs] = useState<ClimbToInputs>(CHART_EXAMPLE);
  const result = climbFuelTimeDistance(inputs);
  const { polylines, marker } = fig519Trace(inputs, result);

  const set = (k: keyof ClimbToInputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

  const legValue = (leg: { timeMin: number; distNm: number; fuelGal: number }) => `${leg.timeMin.toFixed(1)} min / ${leg.distNm.toFixed(1)} nm / ${leg.fuelGal.toFixed(1)} gal`;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Departure airport
            </Typography>
            <InputSlider label="Pressure altitude" unit="ft" value={inputs.departurePaFt} min={0} max={11000} step={100} onChange={set("departurePaFt")} />
            <InputSlider label="OAT" unit="°C" value={inputs.departureOatC} min={-40} max={40} step={1} onChange={set("departureOatC")} />
            <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
              Cruise
            </Typography>
            <InputSlider label="Pressure altitude" unit="ft" value={inputs.cruisePaFt} min={0} max={11000} step={100} onChange={set("cruisePaFt")} />
            <InputSlider label="OAT" unit="°C" value={inputs.cruiseOatC} min={-40} max={40} step={1} onChange={set("cruiseOatC")} />
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Chart lookup — departure", value: legValue(result.departure) },
                { label: "Chart lookup — cruise", value: legValue(result.cruise) },
                { label: "Time to climb", value: `${result.timeMin.toFixed(1)} min`, emphasize: true },
                { label: "Distance to climb", value: `${result.distNm.toFixed(1)} nm`, emphasize: true },
                { label: "Fuel to climb", value: `${result.fuelGal.toFixed(1)} gal`, emphasize: true },
              ]}
              warnings={result.warnings}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              At 2440 lb, flaps 0°, full throttle, leaned per Lycoming, 79 KIAS, no wind. Answers are the cruise lookup minus the departure lookup, per the chart's printed instructions.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig519Meta.title}
            </Typography>
            <ChartOverlay meta={fig519Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Chart quirks: the cumulative curves carry a ~1 min / ~1 nm sea-level allowance that cancels in the chart's subtract-two-lookups usage, so only the differences are meaningful; the 12,000-ft curve is clipped by the title box and unusable (the model stops at 11,000 ft); the implied climb fuel flow is a constant ≈12 GPH.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
