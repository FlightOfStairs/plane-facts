import { Card, CardContent, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig503Meta, fig503Trace } from "../charts/fig503";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { FlapSetting } from "../model/airspeed";
import type { CalDirection } from "../model/airspeedCalibration";
import { airspeedCalibration } from "../model/airspeedCalibration";

export const chartEntry = {
  id: "fig-5-03",
  label: "Airspeed calibration (Fig 5-3)",
  Component: AirspeedCalibrationPage,
};

const DEFAULTS: { direction: CalDirection; flaps: FlapSetting; speedKt: number } = {
  direction: "iasToCas",
  flaps: "up",
  speedKt: 100,
};

export function AirspeedCalibrationPage() {
  const [inputs, setInputs] = useUrlState(DEFAULTS);
  const { direction, flaps, speedKt } = inputs;

  const result = airspeedCalibration({ speedKt, direction, flaps });
  const { polylines, marker } = fig503Trace(result);

  const err = result.positionErrorKt;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <Stack spacing={2} sx={{ mb: 2 }}>
              <ToggleButtonGroup exclusive size="small" fullWidth value={direction} onChange={(_, v: CalDirection | null) => v && setInputs({ direction: v })}>
                <ToggleButton value="iasToCas">IAS → CAS</ToggleButton>
                <ToggleButton value="casToIas">CAS → IAS</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup exclusive size="small" fullWidth value={flaps} onChange={(_, v: FlapSetting | null) => v && setInputs({ flaps: v })}>
                <ToggleButton value="up">Flaps up</ToggleButton>
                <ToggleButton value="deg40">Flaps 40°</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <InputSlider label={direction === "iasToCas" ? "Indicated airspeed" : "Calibrated airspeed"} unit="kt" value={speedKt} min={43} max={160} step={1} onChange={(v) => setInputs({ speedKt: v })} />
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Indicated airspeed", value: `${result.iasKt.toFixed(1)} KIAS`, emphasize: direction === "casToIas" },
                { label: "Calibrated airspeed", value: `${result.casKt.toFixed(1)} KCAS`, emphasize: direction === "iasToCas" },
                { label: "Position error (CAS − IAS)", value: `${err >= 0 ? "+" : ""}${err.toFixed(1)} kt` },
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
              {fig503Meta.title}
            </Typography>
            <ChartOverlay meta={fig503Meta} polylines={polylines} marker={marker} />
            <TraceCaption sections={["entry", "result"]} labels={["IAS entry", "CAS read-out"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["CAS = a₀ + a₁·IAS + a₂·IAS²                (per flap setting)", "flaps up:  a = (16.577, 0.7544,  0.0006344)   56–159 KIAS", "flaps 40°: a = (23.196, 0.52737, 0.0020457)   43–103 KIAS (Vfe)", "below ~43 KIAS: CAS ≈ IAS + 6.6 kt          (stall-range offset from Fig 5-5)"]} fit="Quadratics fitted to the printed lines at 0.23 kt rms. The POH prints no worked example on this chart, so the fit is validated against Fig 5-5's independently digitized stall anchors: 44.1 KIAS flaps 40 → 50.4 KCAS vs 50.2 printed (+0.5%), and 50.2 KIAS flaps up → 56.1 KCAS vs 56.1 (−0.1%)." findings={["CAS = IAS at ~87 KIAS flaps up / ~71 KIAS flaps 40; below the crossover the indicator under-reads (CAS > IAS), which is why the stall speeds in Fig 5-5 look optimistic in KIAS.", "The flaps-40 line ends at Vfe (103 KIAS), where it merges into the flaps-up line — the model falls back to the flaps-up quadratic above it.", "Below ~43 KIAS nothing is drawn; Fig 5-5's paired CAS/IAS stall curves imply a near-constant CAS ≈ IAS + 6.6 kt offset, which the model uses in the stall range.", "This is one of the few Section 5 charts with no atmosphere in it at all — pure IAS↔CAS geometry, shared by the stall, takeoff and landing models.", "The landing charts anchor to it exactly: the 65-KIAS approach speed of Figs 5-35/5-37 is 1.3×Vs0 in CAS converted back through this calibration (64.7 KIAS)."]} />
      </Grid>
    </Grid>
  );
}
