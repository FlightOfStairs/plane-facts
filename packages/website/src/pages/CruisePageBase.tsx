import { Card, CardContent, FormControlLabel, Grid, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { ChartMeta, Polyline } from "../charts/types";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { CruiseInputs, CruiseResult, Mixture, PowerSetting } from "../model/cruisePerformance";
import { CHART_EXAMPLE, CRUISE_WEIGHT_LB, cruisePerformance } from "../model/cruisePerformance";

/**
 * Shared page for the two cruise-performance nomographs (Figs 5-21/5-23).
 * The figures differ only in mixture; the model is common.
 */
export function CruisePageBase(props: { mixture: Mixture; meta: ChartMeta; trace: (inputs: CruiseInputs, result: CruiseResult) => { polylines: Polyline[]; marker: [number, number] }; notes: { form: string[]; fit: string; findings: string[] } }) {
  const { mixture, meta, trace, notes } = props;
  const [urlInputs, setInputs] = useUrlState<{
    pressureAltitudeFt: number;
    oatC: number;
    powerPct: PowerSetting;
    wheelFairings: boolean;
  }>({
    pressureAltitudeFt: CHART_EXAMPLE.pressureAltitudeFt,
    oatC: CHART_EXAMPLE.oatC,
    powerPct: CHART_EXAMPLE.powerPct,
    wheelFairings: CHART_EXAMPLE.wheelFairings,
  });
  // Guard the discrete setting against arbitrary URL values.
  const powerPct: PowerSetting = urlInputs.powerPct === 55 || urlInputs.powerPct === 65 ? urlInputs.powerPct : 75;
  const inputs: CruiseInputs = { ...urlInputs, powerPct, mixture };
  const result = cruisePerformance(inputs);
  const { polylines, marker } = trace(inputs, result);

  const rows = [
    { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` },
    { label: `TAS on the ${inputs.powerPct}% curve`, value: `${result.tasPowerCurveKt.toFixed(1)} kt` },
    ...(result.fullThrottleLimited
      ? [
          {
            label: "Full-throttle limit — achievable power",
            value: result.achievablePowerPct !== null ? `≈${result.achievablePowerPct.toFixed(0)}%` : "—",
          },
        ]
      : []),
    ...(inputs.wheelFairings ? [] : [{ label: "Wheel fairings removed", value: "−7 kt" }]),
    { label: "Cruise speed", value: `${result.tasKt.toFixed(1)} KTAS`, emphasize: true },
    {
      label: result.fullThrottleLimited ? "Fuel consumption (at achievable power)" : "Fuel consumption",
      value: `${result.fuelGph.toFixed(1)} GPH`,
      emphasize: true,
    },
  ];

  const warnings = [...result.warnings];
  if (result.fullThrottleLimited && result.achievablePowerPct !== null) {
    warnings.unshift(`${inputs.powerPct}% power is not available here — full throttle gives ≈${result.achievablePowerPct.toFixed(0)}% (TAS capped at the full-throttle boundary)`);
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Pressure altitude" unit="ft" value={inputs.pressureAltitudeFt} min={0} max={16000} step={250} onChange={(v) => setInputs({ pressureAltitudeFt: v })} />
            <InputSlider label="OAT" unit="°C" value={inputs.oatC} min={-40} max={40} step={1} onChange={(v) => setInputs({ oatC: v })} />
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", mt: 1 }}>
              <Typography variant="body2">Power</Typography>
              <ToggleButtonGroup size="small" exclusive value={inputs.powerPct} onChange={(_, v: PowerSetting | null) => v !== null && setInputs({ powerPct: v })}>
                <ToggleButton value={55}>55%</ToggleButton>
                <ToggleButton value={65}>65%</ToggleButton>
                <ToggleButton value={75}>75%</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={inputs.wheelFairings} onChange={(_, v) => setInputs({ wheelFairings: v })} />} label={<Typography variant="body2">Wheel fairings installed</Typography>} />
            <Typography variant="caption" color="text.secondary" component="p">
              Mid-cruise weight {CRUISE_WEIGHT_LB} lb, {mixture === "bestPower" ? "best power" : "best economy"} mixture per Section 4.
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel rows={rows} warnings={warnings} />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {meta.title}
            </Typography>
            <ChartOverlay meta={meta} polylines={polylines} marker={marker} />
            <TraceCaption sections={["entry", "weight", "result"]} labels={["OAT entry", "DA transfer", "TAS read-out"]} />
          </CardContent>
        </Card>
        <ModelNotes form={notes.form} fit={notes.fit} findings={notes.findings} />
      </Grid>
    </Grid>
  );
}
