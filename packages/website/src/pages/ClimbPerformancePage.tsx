import { useState } from "react";
import { Card, CardContent, FormControlLabel, Grid, Switch, Typography } from "@mui/material";
import { fig517Meta, fig517Trace } from "../charts/fig517";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { ClimbPerformanceInputs } from "../model/climbPerformance";
import { ABSOLUTE_CEILING_DA_FT, CHART_EXAMPLE, climbPerformance } from "../model/climbPerformance";

export const chartEntry = {
  id: "fig-5-17",
  label: "Climb performance (Fig 5-17)",
  Component: ClimbPerformancePage,
};

export function ClimbPerformancePage() {
  const [inputs, setInputs] = useState<ClimbPerformanceInputs>(CHART_EXAMPLE);
  const result = climbPerformance(inputs);
  const { polylines, marker } = fig517Trace(inputs, result);

  const set = (k: "pressureAltitudeFt" | "oatC") => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Pressure altitude" unit="ft" value={inputs.pressureAltitudeFt} min={0} max={16000} step={100} onChange={set("pressureAltitudeFt")} />
            <InputSlider label="OAT" unit="°C" value={inputs.oatC} min={-40} max={40} step={1} onChange={set("oatC")} />
            <FormControlLabel
              control={<Switch checked={inputs.wheelFairingsRemoved} onChange={(_, v) => setInputs((prev) => ({ ...prev, wheelFairingsRemoved: v }))} />}
              label={
                <Typography variant="body2">
                  Wheel fairings removed <Typography component="span" variant="caption" color="text.secondary">
                    (−40 fpm)
                  </Typography>
                </Typography>
              }
            />
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
                { label: "ISA deviation", value: `${result.isaDevC >= 0 ? "+" : ""}${result.isaDevC.toFixed(0)} °C` },
                { label: "Chart ROC (fairings on)", value: `${Math.round(result.rocChartFpm)} fpm` },
                { label: "Rate of climb", value: `${Math.round(result.rocFpm)} fpm`, emphasize: true },
                { label: "ROC via DA collapse", value: `${Math.round(result.rocDaModelFpm)} fpm` },
              ]}
              warnings={result.warnings}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              At 2440 lb, full throttle, leaned per Lycoming, 79 KIAS. Implied absolute ceiling: ROC = 0 at DA ≈ {Math.round(ABSOLUTE_CEILING_DA_FT / 10) * 10} ft.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig517Meta.title}
            </Typography>
            <ChartOverlay meta={fig517Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Chart quirk: unlike the takeoff charts, this one is a true density-altitude collapse (~121 ft of DA per °C, vs the textbook 118.8). The curve family also includes unlabeled 15,000–16,000 ft lines, identified via their standard-temperature-line crossings.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
