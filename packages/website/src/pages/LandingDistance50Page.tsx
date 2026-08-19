import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig535Meta, fig535Trace } from "../charts/fig535";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { LandingDistance50Inputs } from "../model/landingDistance50";
import { CHART_EXAMPLE_5_35, landingDistance50 } from "../model/landingDistance50";

export const chartEntry = {
  id: "fig-5-35",
  label: "Landing distance over 50 ft (Fig 5-35)",
  Component: LandingDistance50Page,
};

export function LandingDistance50Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof LandingDistance50Inputs]: number }>(CHART_EXAMPLE_5_35);
  const result = landingDistance50(inputs);
  const { polylines, marker } = fig535Trace(inputs, result);

  const set = (k: keyof LandingDistance50Inputs) => (v: number) => setInputs({ [k]: v });

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
                { label: "Distance over 50 ft", value: `${Math.round(result.distanceOver50FtFt)} ft`, emphasize: true },
                { label: "Approach / touchdown", value: `${result.approachKias.toFixed(0)} / ${result.touchdownKias.toFixed(0)} KIAS`, emphasize: true },
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
              {fig535Meta.title}
            </Typography>
            <ChartOverlay meta={fig535Meta} polylines={polylines} marker={marker} />
            <TraceCaption sections={["entry", "weight", "wind", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["S₀ = 1116 + 0.0261·PA + 2.73·OAT + 1.34e−4·PA·OAT + 1.11e−6·PA² − 8e−4·OAT²", "S  = S₀ · (W/2440)^0.96 · f_wind", "f_wind = (1 − 0.5·Vw/45)^1.47 headwind · (1 + 1.5·Vw/45)^1.70 tailwind"]} fit="Panel-1 quadratic surface fitted to the five altitude curves at 0.23% rms; the chain reproduces the chart's printed worked example (2500 ft, 24 °C, 2179 lb, calm → 1135 ft) at −0.4% (≈1131 ft), with intermediates matching the printed dashed trace (S₀ ≈ 1270, after-weight ≈ 1133)." findings={["The printed “REF. LINE — 2400 LBS.” label is a misprint: the line's geometry sits at ≈2438 lb, the 2440 anchor all four takeoff/landing nomographs share (sibling Fig 5-37 prints it correctly).", "Panel 1 is nearly a pure σ^−0.73 power law — power-off landing has none of the takeoff charts' engine-lapse temperature anisotropy, so a density-altitude collapse works here.", "Weight exponent 0.96 ≈ 1 is textbook landing physics: kinetic energy ∝ W·Vs² ∝ W² while braking force ∝ W, so distance ∝ W — a sharp contrast with the takeoff charts' 1.85–2.34.", "Wind panel encodes the universal certification policy — credit 50% of headwind, 150% of tailwind, here against the 45-kt touchdown speed; the tailwind penalty is ~3× the headwind benefit.", "The speed strips anchor exactly to physics at 2440 lb (touchdown 45 KIAS = flaps-40 stall IAS from Fig 5-5; approach 65 KIAS = 1.3·Vs0 converted CAS→IAS), but at lighter weights the printed values sit deliberately above both rules — a conservative floor."]} />
      </Grid>
    </Grid>
  );
}
