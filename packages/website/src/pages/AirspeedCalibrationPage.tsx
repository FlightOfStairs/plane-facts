import { useState } from "react";
import { Card, CardContent, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig503Meta, fig503Trace } from "../charts/fig503";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { FlapSetting } from "../model/airspeed";
import type { CalDirection } from "../model/airspeedCalibration";
import { airspeedCalibration } from "../model/airspeedCalibration";

export const chartEntry = {
  id: "fig-5-03",
  label: "Airspeed calibration (Fig 5-3)",
  Component: AirspeedCalibrationPage,
};

export function AirspeedCalibrationPage() {
  const [direction, setDirection] = useState<CalDirection>("iasToCas");
  const [flaps, setFlaps] = useState<FlapSetting>("up");
  const [speedKt, setSpeedKt] = useState(100);

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
              <ToggleButtonGroup exclusive size="small" fullWidth value={direction} onChange={(_, v: CalDirection | null) => v && setDirection(v)}>
                <ToggleButton value="iasToCas">IAS → CAS</ToggleButton>
                <ToggleButton value="casToIas">CAS → IAS</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup exclusive size="small" fullWidth value={flaps} onChange={(_, v: FlapSetting | null) => v && setFlaps(v)}>
                <ToggleButton value="up">Flaps up</ToggleButton>
                <ToggleButton value="deg40">Flaps 40°</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <InputSlider label={direction === "iasToCas" ? "Indicated airspeed" : "Calibrated airspeed"} unit="kt" value={speedKt} min={43} max={160} step={1} onChange={setSpeedKt} />
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
            <Typography variant="caption" color="text.secondary">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Quirks: the POH prints no worked example on this chart — the fit is validated against Fig 5-5's stall anchors (within ~0.5%). CAS = IAS at ~87 KIAS flaps up / ~71 KIAS flaps 40. The flaps-40 line ends at Vfe (103 KIAS) where it merges into the flaps-up line; below ~43 KIAS nothing is drawn and the model uses the near-constant CAS ≈ IAS + 6.6 kt offset implied by Fig 5-5's stall curves.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
