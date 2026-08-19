import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig507Meta, fig507Trace } from "../charts/fig507";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { TakeoffRoll0Inputs } from "../model/takeoffGroundRoll0";
import { CHART_EXAMPLE_5_07, takeoffGroundRoll0 } from "../model/takeoffGroundRoll0";

export const chartEntry = {
  id: "fig-5-07",
  label: "Takeoff ground roll — flaps 0° (Fig 5-7)",
  Component: TakeoffGroundRoll0Page,
};

export function TakeoffGroundRoll0Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffRoll0Inputs]: number }>(CHART_EXAMPLE_5_07);
  const result = takeoffGroundRoll0(inputs);
  const { polylines, marker } = fig507Trace(inputs, result);

  const set = (k: keyof TakeoffRoll0Inputs) => (v: number) => setInputs({ [k]: v });

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
            <TraceCaption sections={["entry", "weight", "wind", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["S₀ = 865 + 0.211·PA + 17.8·OAT            (ft; at 2440 lb, calm)", "S  = S₀ · (W/2440)^2.34 · f_wind", "f_wind = (1 − Vw/93)^1.45 headwind · (1 + Vw/28)^1.4 tailwind", "V_LOF = 52·√(W/2440) KIAS"]} fit="Panel-1 plane fitted to the altitude curves at 1.6% rms (weight panel 1.0%); the assembled chain reproduces the chart's printed worked example (1500 ft, 27 °C, 2316 lb, 15 kt HW → 1150 ft, 50 KIAS) at −0.9% (≈1139 ft, 50.7 KIAS), with intermediates matching the printed dashed trace (S₀ ≈ 1665, after-weight ≈ 1477)." findings={["Panel 1 is a plane in (PA, OAT) weighing temperature at ~84 ft-PA/°C — well below the ~96 a density-altitude model would force. Same carburetted full-rich power-lapse anisotropy (P ∝ δ/√θ) as Fig 5-11: a takeoff-family trait, not a POH-wide convention.", "Weight exponent 2.34 vs 1.85 on the 25°-flap Fig 5-11 — the two ground-roll charts nominally cross near 2000 lb, so the 0-flap distance penalty shrinks with weight. Drafting artifact, not physics.", "V_LOF at 2440 lb is 52 KIAS — identical to the 25°-flap chart, which is aerodynamically suspect (publication artifact). The printed strip labels also run 1–1.5 kt below the √W law at light weight.", "Wind panel encodes the AFM policy of ~−2%/kt headwind credit (f(15 kt HW) = 0.775) against a tailwind penalty ≈3× the headwind benefit (f(5 kt TW) = 1.26)."]} />
      </Grid>
    </Grid>
  );
}
