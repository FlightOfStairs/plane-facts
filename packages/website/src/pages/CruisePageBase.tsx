import { FormControlLabel, Switch, Typography } from "@mui/material";
import type { ChartAnchors, ChartMeta, Polyline } from "../charts/types";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { CruiseInputs, CruiseResult, Mixture } from "../model/cruisePerformance";
import { CHART_EXAMPLE, CRUISE_WEIGHT_LB, cruisePerformance } from "../model/cruisePerformance";

/**
 * Shared page for the two cruise-performance nomographs (Figs 5-21/5-23).
 * The figures differ only in mixture; the model is common.
 */
/** One spec per input, driving both the slider and its handle on the chart. */
const CONTROLS = {
  pressureAltitudeFt: { label: "Pressure altitude", unit: "ft", min: 0, max: 16000, step: 250 },
  oatC: { label: "OAT", unit: "°C", min: -40, max: 40, step: 1 },
} satisfies Record<string, ControlSpec>;

export function CruisePageBase(props: { mixture: Mixture; meta: ChartMeta; anchors: ChartAnchors; trace: (inputs: CruiseInputs, result: CruiseResult) => { polylines: Polyline[]; marker: [number, number] }; notes: { form: string[]; fit: string; findings: string[] } }) {
  const { mixture, meta, anchors, trace, notes } = props;
  const [urlInputs, setInputs] = useUrlState<{
    pressureAltitudeFt: number;
    oatC: number;
    powerPct: number;
    wheelFairings: boolean;
  }>({
    pressureAltitudeFt: CHART_EXAMPLE.pressureAltitudeFt,
    oatC: CHART_EXAMPLE.oatC,
    powerPct: CHART_EXAMPLE.powerPct,
    wheelFairings: CHART_EXAMPLE.wheelFairings,
  });
  // Guard the discrete setting against arbitrary URL values.
  const powerPct = Math.min(100, Math.max(55, urlInputs.powerPct));
  const inputs: CruiseInputs = { ...urlInputs, powerPct, mixture };
  const result = cruisePerformance(inputs);
  const { polylines, marker } = trace(inputs, result);

  const warnings = [...result.warnings];
  if (result.fullThrottleLimited && result.achievablePowerPct !== null) {
    warnings.unshift(`${inputs.powerPct}% power is not available here — full throttle gives ≈${result.achievablePowerPct.toFixed(0)}% (TAS capped at the full-throttle boundary)`);
  }

  return (
    <ChartPageLayout
      meta={meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "result"]}
      sectionLabels={["OAT entry", "DA transfer", "TAS read-out"]}
      conditionsNote={`Mid-cruise weight ${CRUISE_WEIGHT_LB} lb, ${mixture === "bestPower" ? "best power" : "best economy"} mixture per Section 4.`}
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltitudeFt} value={inputs.pressureAltitudeFt} onChange={(v) => setInputs({ pressureAltitudeFt: v })} />
          <InputSlider {...CONTROLS.oatC} value={inputs.oatC} onChange={(v) => setInputs({ oatC: v })} />
          <InputSlider
            label="Cruise power"
            unit="%"
            value={inputs.powerPct}
            min={0}
            max={100}
            step={1}
            softMin={55}
            marks={[
              { value: 55, label: "55" },
              { value: 65, label: "65" },
              { value: 75, label: "75" },
            ]}
            onChange={(v) => setInputs({ powerPct: v })}
          />
          <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={inputs.wheelFairings} onChange={(_, v) => setInputs({ wheelFairings: v })} />} label={<Typography variant="body2">Wheel fairings installed</Typography>} />
        </>
      }
      handles={{
        anchors,
        controls: CONTROLS,
        values: { pressureAltitudeFt: inputs.pressureAltitudeFt, oatC: inputs.oatC },
        setters: { oatC: (v) => setInputs({ oatC: v }) },
        outputs: [{ anchor: "tasKt", value: result.tasChartKt, text: `${Math.round(result.tasChartKt)} kt`, label: "True airspeed read-out" }],
      }}
      results={[
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
      ]}
      warnings={warnings}
      notes={notes}
    />
  );
}
