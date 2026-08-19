import { Card, CardContent, Grid, Typography } from "@mui/material";
import { fig531Meta, fig531Trace } from "../charts/fig531";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { DescentInputs } from "../model/descentFuelTimeDistance";
import { CHART_EXAMPLE, FUEL_TOLERANCE_GAL, descentFuelTimeDistance } from "../model/descentFuelTimeDistance";

export const chartEntry = {
  id: "fig-5-31",
  label: "Descent fuel/time/distance (Fig 5-31)",
  Component: DescentFuelTimeDistancePage,
};

export function DescentFuelTimeDistancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof DescentInputs]: number }>(CHART_EXAMPLE);
  const result = descentFuelTimeDistance(inputs);
  const { polylines, marker } = fig531Trace(inputs, result);

  const set = (k: keyof DescentInputs) => (v: number) => setInputs({ [k]: v });

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              2500 RPM, 126 KIAS, no wind
            </Typography>
            <InputSlider label="Cruise pressure altitude" unit="ft" value={inputs.cruisePressureAltitudeFt} min={0} max={12000} step={100} onChange={set("cruisePressureAltitudeFt")} />
            <InputSlider label="Cruise OAT" unit="°C" value={inputs.cruiseOatC} min={-40} max={40} step={1} onChange={set("cruiseOatC")} />
            <InputSlider label="Destination pressure altitude" unit="ft" value={inputs.destPressureAltitudeFt} min={0} max={12000} step={100} onChange={set("destPressureAltitudeFt")} />
            <InputSlider label="Destination OAT" unit="°C" value={inputs.destOatC} min={-40} max={40} step={1} onChange={set("destOatC")} />
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Cruise effective altitude", value: `${Math.round(result.cruise.effectiveAltitudeFt)} ft` },
                { label: "Destination effective altitude", value: `${Math.round(result.destination.effectiveAltitudeFt)} ft` },
                { label: "Time readings (cruise − dest)", value: `${result.cruise.timeMin.toFixed(1)} − ${result.destination.timeMin.toFixed(1)} min` },
                { label: "Distance readings", value: `${result.cruise.distNm.toFixed(1)} − ${result.destination.distNm.toFixed(1)} nm` },
                { label: "Fuel readings", value: `${result.cruise.fuelGal.toFixed(2)} − ${result.destination.fuelGal.toFixed(2)} gal` },
                { label: "Time to descend", value: `${result.timeMin.toFixed(1)} min`, emphasize: true },
                { label: "Distance to descend", value: `${result.distNm.toFixed(1)} nm`, emphasize: true },
                { label: "Fuel to descend", value: `${result.fuelGal.toFixed(1)} ±${FUEL_TOLERANCE_GAL} gal`, emphasize: true },
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
              {fig531Meta.title}
            </Typography>
            <ChartOverlay meta={fig531Meta} polylines={polylines} marker={marker} />
            <TraceCaption sections={["entry", "weight", "wind", "result"]} labels={["entry / distance read", "fuel read", "time read", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["h_e = PA + a₁·ΔT + a₂·ΔT·PA/1000 + b₁·ΔT² + b₂·ΔT²·PA/1000 + c₃·ΔT³", "ΔT = OAT − (15 − 1.9812·PA/1000)", "time, dist, fuel = cubic(h_e)                  (cumulative curves)", "answer = reading(cruise PA, OAT) − reading(dest PA, OAT)"]} fit="Overall fit 1.37% rms (effective-altitude surface 164 ft rms; per-curve 0.18 min / 0.16 nm / 0.08 gal). The chart's printed example (cruise 5000 ft / 16 °C, destination 2500 ft / 24 °C → 3.0 min, 5.5 nm, 0.5 gal) reproduces at 2.91 min (−3.1%), 5.56 nm (+1.0%) and 0.33 gal — the printed 0.5 is a rounded read of a drawn ≈0.62 gal." findings={["The temperature sign is inverted vs density physics: warmer than ISA means less time, fuel and distance to descend (≈−8 ft/°C at sea level to ≈−60 ft/°C at 10,000 ft) — certification-policy smoothing, faithfully reproduced.", "The implied rate of descent grows strongly with altitude — ~500 fpm near sea level to 1400+ fpm above 10,000 ft — at the fixed 2500 RPM / 126 KIAS schedule.", "The near-vertical fuel curve on the 0.5-gal grid limits fuel answers to roughly ±0.2 gal; the POH's own example prints 0.5 gal for a drawn ≈0.6.", "This is a difference nomograph: the drawn curves carry small drafting offsets, so only cruise-minus-destination differences are meaningful — never absolute readings.", "Altitude curves above 10,000 ft are unlabeled in the original (identified via the STD TEMP diagonal's crossings), and a hidden 6000-ft curve lies under the example's dashed transfer line."]} />
      </Grid>
    </Grid>
  );
}
