import { fig515Meta, fig515Trace } from "../charts/fig515";
import { ChartPageLayout } from "../components/ChartPageLayout";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { EnginePerformanceInputs } from "../model/enginePerformance";
import { CHART_EXAMPLE, enginePerformance } from "../model/enginePerformance";

export const chartEntry = {
  id: "fig-5-15",
  label: "Engine performance (Fig 5-15)",
  Component: EnginePerformancePage,
};

export function EnginePerformancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof EnginePerformanceInputs]: number }>(CHART_EXAMPLE);
  const result = enginePerformance(inputs);
  const { polylines, marker } = fig515Trace(inputs, result);

  const set = (k: keyof EnginePerformanceInputs) => (v: number) => setInputs({ [k]: v });

  const atTableColumn = inputs.pctPower === result.snappedPctPower;

  return (
    <ChartPageLayout
      meta={fig515Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "result"]}
      sectionLabels={["OAT / altitude entry", "constant-DA transfer", "RPM read-out"]}
      conditionsNote="Best power mixture per Section 4, wheel fairings installed."
      conditions={
        <>
          <InputSlider label="Pressure altitude" unit="ft" value={inputs.pressureAltitudeFt} min={-2000} max={16000} step={100} onChange={set("pressureAltitudeFt")} />
          <InputSlider label="OAT" unit="°C" value={inputs.oatC} min={-40} max={40} step={1} onChange={set("oatC")} />
          <InputSlider label="Rated power" unit="%" value={inputs.pctPower} min={55} max={75} step={1} onChange={set("pctPower")} />
        </>
      }
      results={[
        { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` },
        { label: "Sea-level intercept a(p)", value: `${Math.round(result.aP)} RPM` },
        { label: "Engine speed", value: `${Math.round(result.rpm)} RPM`, emphasize: true },
        { label: `Fuel flow @ ${result.snappedPctPower}% (best power)`, value: `${result.fuelFlowBestPowerGph.toFixed(1)} GPH`, emphasize: true },
        { label: `Fuel flow @ ${result.snappedPctPower}% (best economy)`, value: `${result.fuelFlowBestEconomyGph.toFixed(1)} GPH` },
        { label: "Full-throttle ceiling for this power", value: `≈${Math.round(result.fullThrottleCeilingDaFt / 10) * 10} ft DA` },
      ]}
      resultsNote={atTableColumn ? undefined : `The POH fuel-flow table lists only 55 / 65 / 75%; flows shown are the nearest table column (${result.snappedPctPower}%). RPM is interpolated continuously between the printed lines.`}
      warnings={result.warnings}
      notes={{
        form: ["u = 0.013 + DA/2007                       (left panel: pure DA converter, chart major squares)", "RPM = a_p + 0.02306·DA,  a₅₅/₆₅/₇₅ = 2196.6 / 2336.8 / 2480.3", "  ≈ 2751·(p/100)^0.370·σ^−0.306           (fixed-pitch prop law N ∝ (P/σ)^⅓, softened)", "fuel flow: POH table at 55/65/75%          (best power / best economy)"],
        fit: "Right-panel %power lines fitted at 1.4 RPM rms (0.06%); the chart's printed worked example (5000 ft, 16 °C, 75% → 2625 RPM, 10.0/8.5 GPH) reproduces at DA 6263 ft, 2624.7 RPM (−0.01%) with the printed fuel flows read directly from the table.",
        findings: ["The left panel is exactly a density-altitude converter — one major chart square ≈ 2000 ft of DA.", "The %power lines end where full throttle runs out: 75% is unavailable above ≈8000 ft DA (65% above ≈13,500). The 75% endpoint matches a Gagg–Ferrar-like lapse (N/2700)·δ/√θ = 0.754 to 0.5%.", "Extrapolated to 100% power at sea level the line law gives 2751 RPM — above the 2700 redline: rated power is not reachable static, as expected for a fixed-pitch prop.", "The fuel-flow tables imply a BSFC of ≈0.50 lb/hp/hr at best power and ≈0.425 at best economy, essentially constant across the 55–75% range."],
      }}
    />
  );
}
