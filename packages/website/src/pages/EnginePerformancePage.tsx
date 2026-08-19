import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig515Meta, fig515Trace } from "../charts/fig515";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { EnginePerformanceInputs } from "../model/enginePerformance";
import { CHART_EXAMPLE, enginePerformance } from "../model/enginePerformance";

export const chartEntry = {
  id: "fig-5-15",
  label: "Engine performance (Fig 5-15)",
  Component: EnginePerformancePage,
};

export function EnginePerformancePage() {
  const [inputs, setInputs] = useState<EnginePerformanceInputs>(CHART_EXAMPLE);
  const result = enginePerformance(inputs);
  const { polylines, marker } = fig515Trace(inputs, result);

  const set = (k: keyof EnginePerformanceInputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

  const atTableColumn = inputs.pctPower === result.snappedPctPower;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Pressure altitude" unit="ft" value={inputs.pressureAltitudeFt} min={-2000} max={16000} step={100} onChange={set("pressureAltitudeFt")} />
            <InputSlider label="OAT" unit="°C" value={inputs.oatC} min={-40} max={40} step={1} onChange={set("oatC")} />
            <InputSlider label="Rated power" unit="%" value={inputs.pctPower} min={55} max={75} step={1} onChange={set("pctPower")} />
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
                { label: "Sea-level intercept a(p)", value: `${Math.round(result.aP)} RPM` },
                { label: "Engine speed", value: `${Math.round(result.rpm)} RPM`, emphasize: true },
                {
                  label: `Fuel flow @ ${result.snappedPctPower}% (best power)`,
                  value: `${result.fuelFlowBestPowerGph.toFixed(1)} GPH`,
                  emphasize: true,
                },
                {
                  label: `Fuel flow @ ${result.snappedPctPower}% (best economy)`,
                  value: `${result.fuelFlowBestEconomyGph.toFixed(1)} GPH`,
                },
                {
                  label: "Full-throttle ceiling for this power",
                  value: `≈${Math.round(result.fullThrottleCeilingDaFt / 10) * 10} ft DA`,
                },
              ]}
              warnings={result.warnings}
            />
            {!atTableColumn && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                The POH fuel-flow table lists only 55 / 65 / 75%; flows shown are the nearest table column ({result.snappedPctPower}%). RPM is interpolated continuously between the printed lines.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig515Meta.title}
            </Typography>
            <ChartOverlay meta={fig515Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Chart quirks: the left panel is exactly a density-altitude converter (1 major square ≈ 2000 ft DA); altitude curves above 14,000 ft and below sea level are drawn but unlabeled. The %power lines end where full throttle runs out — 75% is unavailable above ≈8000 ft DA (65% above ≈13,500 ft). Extrapolated to 100% at sea level the line law gives 2751 RPM, above the 2700 redline: rated power is not reachable static, as expected for a fixed-pitch prop.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
