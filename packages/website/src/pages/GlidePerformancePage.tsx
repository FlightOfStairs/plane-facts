import { useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig533Meta, fig533Trace } from "../charts/fig533";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { GlideInputs } from "../model/glidePerformance";
import { BEST_GLIDE_KIAS, CHART_EXAMPLE, glidePerformance } from "../model/glidePerformance";

export const chartEntry = {
  id: "fig-5-33",
  label: "Glide range (Fig 5-33)",
  Component: GlidePerformancePage,
};

export function GlidePerformancePage() {
  const [inputs, setInputs] = useState<GlideInputs>(CHART_EXAMPLE);
  const result = glidePerformance(inputs);
  const { polylines, marker } = fig533Trace(inputs, result);

  const set = (k: keyof GlideInputs) => (v: number) => setInputs((prev) => ({ ...prev, [k]: v }));

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
            <Typography variant="caption" color="text.secondary" component="p">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              The chart is a single straight line: L/D ≈ 11.45 at {BEST_GLIDE_KIAS} KIAS with the prop windmilling (≈1.9 nm per 1000 ft). Still-air range needs no atmosphere correction — at a fixed IAS schedule, TAS and sink rate scale together, so density cancels. Best-glide IAS scales as √weight below 2440 lb.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
