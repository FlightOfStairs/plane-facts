import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig531Meta, fig531Trace } from "../charts/fig531";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { DescentInputs } from "../model/descentFuelTimeDistance";
import { CHART_EXAMPLE, FUEL_TOLERANCE_GAL, descentFuelTimeDistance } from "../model/descentFuelTimeDistance";

export const chartEntry = {
  id: "fig-5-31",
  label: "Descent fuel/time/distance (Fig 5-31)",
  Component: DescentFuelTimeDistancePage,
};

export function DescentFuelTimeDistancePage() {
  const [inputs, setInputs] = useState<DescentInputs>(CHART_EXAMPLE);
  const result = descentFuelTimeDistance(inputs);
  const { polylines, marker } = fig531Trace(inputs, result);

  const set = (k: keyof DescentInputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              2500 RPM, 126 KIAS, no wind
            </Typography>
            <InputSlider label="Cruise pressure altitude" unit="ft" value={inputs.cruisePressureAltitudeFt} min={0} max={12000} step={100} onChange={set("cruisePressureAltitudeFt")} />
            <InputSlider label="Cruise OAT" unit="°C" value={inputs.cruiseOatC} min={-40} max={40} step={1} onChange={set("cruiseOatC")} />
            <InputSlider label="Destination pressure altitude" unit="ft" value={inputs.destPressureAltitudeFt} min={0} max={12000} step={100} onChange={set("destPressureAltitudeFt")} />
            <InputSlider label="Destination OAT" unit="°C" value={inputs.destOatC} min={-40} max={40} step={1} onChange={set("destOatC")} />
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Cruise effective altitude", value: `${Math.round(result.cruise.effectiveAltitudeFt)} ft` },
                { label: "Destination effective altitude", value: `${Math.round(result.destination.effectiveAltitudeFt)} ft` },
                { label: "Time readings (cruise − dest)", value: `${result.cruise.timeMin.toFixed(1)} − ${result.destination.timeMin.toFixed(1)} min` },
                { label: "Distance readings", value: `${result.cruise.distNm.toFixed(1)} − ${result.destination.distNm.toFixed(1)} nm` },
                { label: "Fuel readings", value: `${result.cruise.fuelGal.toFixed(2)} − ${result.destination.fuelGal.toFixed(2)} gal` },
                { label: "Time to descend", value: `${result.timeMin.toFixed(1)} min`, emphasize: true },
                { label: "Distance to descend", value: `${result.distNm.toFixed(1)} nm`, emphasize: true },
                { label: "Fuel to descend", value: `${result.fuelGal.toFixed(1)} ±${FUEL_TOLERANCE_GAL} gal`, emphasize: true },
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
              {fig531Meta.title}
            </Typography>
            <ChartOverlay meta={fig531Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary" component="p">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              Chart quirks: this chart&apos;s temperature sign is inverted vs density physics — warmer than ISA means <em>less</em> time, fuel and distance to descend. The near-vertical fuel curve on the 0.5-gal grid limits fuel answers to roughly ±0.2 gal (the POH&apos;s own example prints 0.5 gal for a drawn ≈0.6). Altitude curves above 10,000 ft are unlabeled in the original.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
