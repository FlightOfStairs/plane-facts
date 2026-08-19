import { FormControlLabel, Switch, Typography } from "@mui/material";
import { fig517Meta, fig517Trace } from "../charts/fig517";
import { ChartPageLayout } from "../components/ChartPageLayout";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { ClimbPerformanceInputs } from "../model/climbPerformance";
import { ABSOLUTE_CEILING_DA_FT, CHART_EXAMPLE, climbPerformance } from "../model/climbPerformance";

export const chartEntry = {
  id: "fig-5-17",
  label: "Climb performance (Fig 5-17)",
  Component: ClimbPerformancePage,
};

export function ClimbPerformancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof ClimbPerformanceInputs]: ClimbPerformanceInputs[K] }>(CHART_EXAMPLE);
  const result = climbPerformance(inputs);
  const { polylines, marker } = fig517Trace(inputs, result);

  const set = (k: "pressureAltitudeFt" | "oatC") => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig517Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "result"]}
      sectionLabels={["OAT / altitude entry", "transfer to ROC line", "ROC read-out"]}
      conditionsNote="2440 lb, full throttle, mixture leaned per Lycoming, 79 KIAS."
      conditions={
        <>
          <InputSlider label="Pressure altitude" unit="ft" value={inputs.pressureAltitudeFt} min={0} max={16000} step={100} onChange={set("pressureAltitudeFt")} />
          <InputSlider label="OAT" unit="°C" value={inputs.oatC} min={-40} max={40} step={1} onChange={set("oatC")} />
          <FormControlLabel
            control={<Switch checked={inputs.wheelFairingsRemoved} onChange={(_, v) => setInputs({ wheelFairingsRemoved: v })} />}
            label={
              <Typography variant="body2">
                Wheel fairings removed <Typography component="span" variant="caption" color="text.secondary">
                  (−40 fpm)
                </Typography>
              </Typography>
            }
          />
        </>
      }
      results={[
        { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` },
        { label: "ISA deviation", value: `${result.isaDevC >= 0 ? "+" : ""}${result.isaDevC.toFixed(0)} °C` },
        { label: "Chart ROC (fairings on)", value: `${Math.round(result.rocChartFpm)} fpm` },
        { label: "Rate of climb", value: `${Math.round(result.rocFpm)} fpm`, emphasize: true },
        { label: "ROC via DA collapse", value: `${Math.round(result.rocDaModelFpm)} fpm` },
      ]}
      resultsNote={`Implied absolute ceiling: ROC = 0 at DA ≈ ${Math.round(ABSOLUTE_CEILING_DA_FT / 10) * 10} ft.`}
      warnings={result.warnings}
      notes={{
        form: ["ROC = 730.7 − 0.060689·PA − 5.9218·OAT + 0.00866·OAT²   (fpm; 2440 lb)", "  ≈ 645.8 − 0.048888·DA                                  (equivalent pure-DA collapse)", "wheel fairings removed: −40 fpm"],
        fit: "Fitted at 3.9 fpm rms (1.22%); the chart's printed worked example (5000 ft, 16 °C → 340 fpm) reproduces at ≈335 fpm (−1.6%). The pure-DA form costs only 5.6 fpm rms, so both are exposed in the results panel.",
        findings: ["This chart's own implied absolute ceiling is ROC = 0 at DA ≈ 13,200 ft — the anchor the cruise and range charts are checked against.", "The curves are drawn down only to 25 fpm (DA ≈ 12,700 ft); below that the model flags 'effectively at the ceiling'.", "The unlabeled top curves are 15,000 and 16,000 ft, identified from where they cross the standard-temperature line."],
      }}
    />
  );
}
