import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig513Meta, fig513Trace } from "../charts/fig513";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { TakeoffOver50Flaps25Inputs } from "../model/takeoffOver50Flaps25";
import { CHART_EXAMPLE_5_13, takeoffOver50Flaps25 } from "../model/takeoffOver50Flaps25";

export const chartEntry = {
  id: "fig-5-13",
  label: "Takeoff over 50 ft — flaps 25° (Fig 5-13)",
  Component: TakeoffOver50Flaps25Page,
};

export function TakeoffOver50Flaps25Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffOver50Flaps25Inputs]: number }>(CHART_EXAMPLE_5_13);
  const result = takeoffOver50Flaps25(inputs);
  const { polylines, marker } = fig513Trace(inputs, result);

  const set = (k: keyof TakeoffOver50Flaps25Inputs) => (v: number) => setInputs({ [k]: v });

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
            <TraceCaption sections={["entry", "weight", "wind", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["S₀ = 1313 + 0.206·PA + 21.5·OAT + 0.00187·PA·OAT + 1.29e−5·PA² + 0.0445·OAT²", "S  = S₀ · (W/2440)^2.02 · f_wind", "f_wind = (1 − 0.5·Vw/52)^1.49 headwind · (1 + 1.5·Vw/52)^1.42 tailwind", "V_LOF, V₅₀ = printed strip anchors, piecewise-linear in W  (V₅₀ ≈ 1.10·V_LOF)"]} fit="Panel-1 quadratic fitted at 1.06% rms; the assembled chain reproduces the chart's printed worked example (1500 ft, 27 °C, 2175 lb, 15 kt HW → 1500 ft, 48/53 KIAS) at −1.9% (≈1470 ft, 47.8/52.6 KIAS), with intermediates matching the printed dashed trace (S₀ ≈ 2345, after-weight ≈ 1873) to <1%." findings={["Unlike Fig 5-11, the altitude fan is not a plane in (PA, OAT): a full quadratic is needed for ~1% rms — a plane alone leaves 3.8%.", "Weight exponent 2.02 sits between its siblings' 1.85 (Fig 5-11) and 2.34 (Fig 5-7) — the POH's weight exponents are per-chart content, not a shared convention.", "Refit in TAS terms, the headwind exponent becomes 1.55 — matching Fig 5-11's wind panel exactly; both encode the 50% headwind / 150% tailwind certification credit against 52 KIAS.", "The lift-off/barrier speed strips are linear in weight (not ∝ √W) and extend past the 1700-lb axis end; the barrier speed is ≈1.10 × lift-off throughout.", "The tailwind exponent (1.42) is weakly constrained — the chart draws only two short usable tailwind guides."]} />
      </Grid>
    </Grid>
  );
}
