import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig533Meta, fig533Trace } from "../charts/fig533";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { GlideInputs } from "../model/glidePerformance";
import { BEST_GLIDE_KIAS, CHART_EXAMPLE, glidePerformance } from "../model/glidePerformance";

export const chartEntry = {
  id: "fig-5-33",
  label: "Glide range (Fig 5-33)",
  Component: GlidePerformancePage,
};

export function GlidePerformancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof GlideInputs]: number }>(CHART_EXAMPLE);
  const result = glidePerformance(inputs);
  const { polylines, marker } = fig533Trace(inputs, result);

  const set = (k: keyof GlideInputs) => (v: number) => setInputs({ [k]: v });

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              2440 lb, prop windmilling, flaps 0°, {BEST_GLIDE_KIAS} KIAS, no wind
            </Typography>
            <InputSlider label="Cruise pressure altitude" unit="ft" value={inputs.cruisePressureAltitudeFt} min={0} max={12000} step={100} onChange={set("cruisePressureAltitudeFt")} />
            <InputSlider label="Terrain pressure altitude" unit="ft" value={inputs.terrainPressureAltitudeFt} min={0} max={12000} step={100} onChange={set("terrainPressureAltitudeFt")} />
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Range reading at cruise", value: `${result.rangeCruiseNm.toFixed(1)} nm` },
                { label: "Range reading at terrain", value: `${result.rangeTerrainNm.toFixed(1)} nm` },
                { label: "Glide distance", value: `${result.glideNm.toFixed(1)} nm`, emphasize: true },
                { label: "Glide ratio", value: `${result.glideRatio.toFixed(1)} : 1` },
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
              {fig533Meta.title}
            </Typography>
            <ChartOverlay meta={fig533Meta} polylines={polylines} marker={marker} />
            <TraceCaption sections={["entry", "weight", "result"]} labels={["cruise-altitude read", "terrain-altitude read", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["range(h) = (h + 85.7) / 530.47                (nm; h in ft)", "glide = range(cruise PA) − range(terrain PA)", "L/D = 6076.115 / 530.47 ≈ 11.45"]} fit="Straight-line fit at 0.165% rms (≈20 ft). The chart's printed example (cruise 5000 ft, terrain 2000 ft → 9.5 − 3.9 = 5.6 nm) reproduces at 9.59 − 3.93 = 5.66 nm (+1.0%)." findings={["The chart is a single dead-straight line (curvature term −0.15 ft/nm² — negligible): ≈1.9 nm per 1000 ft of height.", "Still-air range needs no atmosphere correction at all — flying a fixed IAS schedule, TAS and sink rate scale together, so density cancels; this is the POH's only chart with no atmosphere input.", "L/D 11.45 at 73 KIAS with the prop windmilling bootstraps a drag polar: CL 0.796, CD 0.0695 → CD₀ ≈ 0.032 with e = 0.75 — including ~0.005–0.008 of windmilling-prop drag (subtract before reusing as a clean airframe polar).", "Best-glide IAS scales as √(W/2440) below max gross; the chart's 73 KIAS is the 2440-lb value.", "The fit assumes CAS = IAS at 73 kt; Fig 5-3's ~+1 kt position-error correction is not applied — well inside the line's own scatter."]} />
      </Grid>
    </Grid>
  );
}
