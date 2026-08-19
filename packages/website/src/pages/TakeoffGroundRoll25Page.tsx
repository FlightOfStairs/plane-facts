import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig511Meta, fig511Trace } from "../charts/fig511";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { TakeoffInputs } from "../model/takeoffGroundRoll25";
import { CHART_EXAMPLE, takeoffGroundRoll25 } from "../model/takeoffGroundRoll25";

export const chartEntry = {
  id: "fig-5-11",
  label: "Takeoff ground roll — flaps 25° (Fig 5-11)",
  Component: TakeoffGroundRoll25Page,
};

export function TakeoffGroundRoll25Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffInputs]: number }>(CHART_EXAMPLE);
  const result = takeoffGroundRoll25(inputs);
  const { polylines, marker } = fig511Trace(inputs, result);

  const set = (k: keyof TakeoffInputs) => (v: number) => setInputs({ [k]: v });

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
                { label: "Ground roll", value: `${Math.round(result.groundRollFt)} ft`, emphasize: true },
                { label: "Lift-off", value: `${result.vLofKcas.toFixed(0)} KIAS / ${result.vLofKtas.toFixed(0)} KTAS`, emphasize: true },
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
              {fig511Meta.title}
            </Typography>
            <ChartOverlay meta={fig511Meta} polylines={polylines} marker={marker} />
            <TraceCaption sections={["entry", "weight", "wind", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["S₀ = 812 + 0.188·PA + 15.1·OAT            (ft; at 2440 lb, calm)", "S  = S₀ · (W/2440)^1.85 · f_wind", "f_wind = (1 − 0.5·Vw/V_TAS)^1.55 headwind · (1 + 1.5·Vw/V_TAS)^1.55 tailwind", "V_LOF = 52·√(W/2440) KIAS"]} fit="Panel-1 plane fitted to the eight altitude curves at 1.1% rms; the assembled chain reproduces the chart's printed worked example (1500 ft, 27 °C, 2175 lb, 15 kt HW → 975 ft, 48 KIAS) at −2.6% with every intermediate matching the printed dashed trace. Source: tools/digitize/out/fits + CLAUDE.md." findings={["Panel 1 is a plane in (PA, OAT), not any σ-power law: the chart weighs temperature at only ~80 ft-PA/°C vs the ~96 a density-altitude model would force — the signature of carburetted full-rich power lapse (P ∝ δ/√θ).", "Altitude sensitivity (×2.05 at 7000 ft ISA) exceeds σ-physics (×1.67) — conservatism baked in aloft.", "Weight exponent 1.85 is constant along all guide curves — but the sibling 0°-flap chart uses 2.34, so the two charts nominally cross near 2000 lb (drafting artifact, not physics).", "Wind panel encodes certification policy: credit 50% of headwind, 150% of tailwind; the tailwind penalty is ~3× the headwind benefit.", "V_LOF follows √W exactly and sits only 3.6% above the flaps-40 calibrated stall speed."]} />
      </Grid>
    </Grid>
  );
}
