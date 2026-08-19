import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig509Meta, fig509Trace } from "../charts/fig509";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { TakeoffOver50Flaps0Inputs } from "../model/takeoffOver50Flaps0";
import { CHART_EXAMPLE_5_09, takeoffOver50Flaps0 } from "../model/takeoffOver50Flaps0";

export const chartEntry = {
  id: "fig-5-09",
  label: "Takeoff over 50 ft — flaps 0° (Fig 5-9)",
  Component: TakeoffOver50Flaps0Page,
};

export function TakeoffOver50Flaps0Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffOver50Flaps0Inputs]: number }>(CHART_EXAMPLE_5_09);
  const result = takeoffOver50Flaps0(inputs);
  const { polylines, marker } = fig509Trace(inputs, result);

  const set = (k: keyof TakeoffOver50Flaps0Inputs) => (v: number) => setInputs({ [k]: v });

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
            <TraceCaption sections={["entry", "weight", "wind", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["S₀ = 1674 + 0.261·PA + 1.13e−5·PA² + (22.9 + 0.00182·PA)·OAT", "S  = S₀ · exp((2.04 − 0.417·ln(S₀/2500))·u − 3.18·u² − 4.57·u³),  u = ln(W/2440)", "f_wind = (1 − 0.5·Vw/57)^(1.44−0.23·ln(S/2500)) HW · (1 + 1.5·Vw/57)^(1.62−0.56·ln(S/2500)) TW", "V_LOF = 17.9 + 0.0139·W KIAS,   V₅₀ = 19.3 + 0.0154·W KIAS"]} fit="Panel fits land at 0.7–1.1% rms. Against the chart's printed worked example (1500 ft, 27 °C, 2316 lb, 15 kt HW → 2100 ft, 50/55 KIAS) the model gives ≈2029 ft (−3.4%) and 50.1/54.9 KIAS — the printed dashed trace itself sits 1–2.5% above the chart's own guide curves, so the smooth fit reads low." findings={["The weight correction is not a power law: the local exponent drifts ≈2.0 → 2.7 toward light weight, needing a cubic in ln(W) — its siblings use constant exponents (1.85, 2.02, 2.34).", "The bottom 500-ft headwind guide implies an absurd ~25-kt reference speed — a drafting error, excluded from the fit.", "Speed strips are linear in weight (not √W as on Figs 5-7/5-11) and extend past the 1700-lb axis end to a ~1600-lb position; barrier speed ≈ 1.10 × lift-off throughout.", "The wind panel keeps the universal 50% headwind / 150% tailwind certification credit but with distance-dependent exponents — longer takeoffs get proportionally less wind relief; the tailwind penalty is still ~3× the headwind benefit.", "The topmost altitude curve is unlabeled: identified as 7000 ft via its ISA std-temp-line crossing.", "The POH's own worked example is imperfect: the printed 2100 ft sits 1–2.5% above the chart's own guide curves."]} />
      </Grid>
    </Grid>
  );
}
