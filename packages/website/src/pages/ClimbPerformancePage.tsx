import { Card, CardContent, FormControlLabel, Grid, Switch, Typography } from "@mui/material";
import { fig517Meta, fig517Trace } from "../charts/fig517";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { ClimbPerformanceInputs } from "../model/climbPerformance";
import { ABSOLUTE_CEILING_DA_FT, CHART_EXAMPLE, climbPerformance } from "../model/climbPerformance";

export const chartEntry = {
  id: "fig-5-17",
  label: "Climb performance (Fig 5-17)",
  Component: ClimbPerformancePage,
};

export function ClimbPerformancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof ClimbPerformanceInputs]: ClimbPerformanceInputs[K] }>(CHART_EXAMPLE);
  const result = climbPerformance(inputs);
  const { polylines, marker } = fig517Trace(inputs, result);

  const set = (k: "pressureAltitudeFt" | "oatC") => (v: number) => setInputs({ [k]: v });

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
              control={<Switch checked={inputs.wheelFairingsRemoved} onChange={(_, v) => setInputs({ wheelFairingsRemoved: v })} />}
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
            <TraceCaption sections={["entry", "weight", "result"]} labels={["OAT / altitude entry", "transfer to ROC line", "ROC read-out"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["ROC = 730.7 − 0.060689·PA − 5.9218·OAT + 0.00866·OAT²   (fpm; 2440 lb)", "  ≈ 645.8 − 0.048888·DA                                  (equivalent pure-DA collapse)", "wheel fairings removed: −40 fpm"]} fit="Fitted at 3.9 fpm rms (1.22%); the chart's printed worked example (5000 ft, 16 °C → 340 fpm) reproduces at ≈335 fpm (−1.6%). The pure-DA form costs only 5.6 fpm rms, so both are exposed in the results panel." findings={["Unlike the takeoff charts, this one is a true density-altitude collapse: ~121 ft of DA per °C, essentially the textbook 118.8 — leaned climb performance is a clean function of DA, where full-rich takeoff is not.", "The implied absolute ceiling (ROC = 0 at DA ≈ 13,200 ft) agrees with the cruise charts' 65% full-throttle intersections (DA 11,900–12,800) and the range/endurance curve endpoints — a coherent ceiling picture across four independently drafted charts.", "The curve family includes unlabeled 15,000–16,000 ft lines, identified via their standard-temperature-line crossings.", "The chart is drawn down to 25 fpm (DA ≈ 12,700 ft); below that the model flags 'effectively at the ceiling'.", "A 79/√σ KTAS climb schedule built on this chart reproduces Fig 5-19's distance-to-climb integral to +3%."]} />
      </Grid>
    </Grid>
  );
}
