import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig537Meta, fig537Trace } from "../charts/fig537";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { LandingGroundRollInputs } from "../model/landingGroundRoll";
import { CHART_EXAMPLE_5_37, landingGroundRoll } from "../model/landingGroundRoll";

export const chartEntry = {
  id: "fig-5-37",
  label: "Landing ground roll (Fig 5-37)",
  Component: LandingGroundRollPage,
};

export function LandingGroundRollPage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof LandingGroundRollInputs]: number }>(CHART_EXAMPLE_5_37);
  const result = landingGroundRoll(inputs);
  const { polylines, marker } = fig537Trace(inputs, result);

  const set = (k: keyof LandingGroundRollInputs) => (v: number) => setInputs({ [k]: v });

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
            <TraceCaption sections={["entry", "weight", "wind", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["S₀ = 594 + 0.0198·PA + 2.02·OAT + 9e−5·PA·OAT + 5.7e−7·PA² + 0.0015·OAT²", "S  = S₀ · (W/2440)^0.96 · f_wind", "f_wind = (1 − 0.5·Vw/45)^1.90 headwind · (1 + 1.5·Vw/45)^2.08 tailwind"]} fit="Panel-1 quadratic surface fitted to the five altitude curves at 0.25% rms; the chain reproduces the chart's printed worked example (2500 ft, 24 °C, 2179 lb, calm → 625 ft) at +0.9% (≈630 ft), with intermediates matching the printed dashed trace (S₀ ≈ 698, after-weight ≈ 625)." findings={["This chart's “REF. LINE 2440 LBS.” is printed correctly — its sibling Fig 5-35 mislabels the same shared reference line “2400 LBS.” (geometry: ≈2438 lb).", "Panel 1 is nearly a pure σ^−0.95 power law: power-off ground roll scales ~1/σ (touchdown TAS²), with none of the takeoff charts' engine-lapse temperature anisotropy.", "Weight exponent 0.96 ≈ 1 is textbook landing physics (KE ∝ W·Vs² ∝ W², braking force ∝ W ⇒ S ∝ W).", "Wind exponents 1.90/2.08 are the largest of all six wind panels, but it is the same physics seen from a lower 45-kt reference speed — rescaled to the 65-KIAS approach speed they match Fig 5-35's 1.47/1.70.", "Same 50%/150% certification wind credit as everywhere; here the ground roll changes ≈ −2%/kt of headwind but +6–8%/kt of tailwind — the tailwind penalty (~3× the headwind benefit) bites hardest on this chart."]} />
      </Grid>
    </Grid>
  );
}
