import { fig535Anchors, fig535Meta, fig535Trace } from "../charts/fig535";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import { factoredBadge, factoredRows, useSafetyFactors } from "../lib/useSafetyFactors";
import { windProjection, windToggle } from "../lib/windHandle";
import type { LandingDistance50Inputs } from "../model/landingDistance50";
import { CHART_EXAMPLE_5_35, landingDistance50 } from "../model/landingDistance50";

export const chartEntry = {
  id: "fig-5-35",
  label: "Landing distance over 50 ft (Fig 5-35)",
  Component: LandingDistance50Page,
};

/** One spec per input, driving both the slider and its handle on the chart. */
const CONTROLS = {
  pressureAltitudeFt: { label: "Pressure altitude", unit: "ft", min: 0, max: 7000, step: 100 },
  oatC: { label: "OAT", unit: "°C", min: -40, max: 40, step: 1 },
  // The weight scale is drawn down to 1600 lb even though its last
  // labelled tick is 1700 — 1600 lands exactly on the wind panel's reference
  // line, which is where the panel ends.
  weightLb: { label: "Weight", unit: "lb", min: 1600, max: 2440, step: 5 },
  windKt: { label: "Wind (+HW / −TW)", unit: "kt", min: -5, max: 15, step: 1 },
} satisfies Record<string, ControlSpec>;

export function LandingDistance50Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof LandingDistance50Inputs]: number }>(CHART_EXAMPLE_5_35);
  const result = landingDistance50(inputs);
  const safety = useSafetyFactors("landing");
  const { polylines, marker } = fig535Trace(inputs, result);

  const set = (k: keyof LandingDistance50Inputs) => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig535Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      conditionsNote="Power off, flaps 40°, paved level dry runway, maximum braking."
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltitudeFt} value={inputs.pressureAltitudeFt} onChange={set("pressureAltitudeFt")} />
          <InputSlider {...CONTROLS.oatC} value={inputs.oatC} onChange={set("oatC")} />
          <InputSlider {...CONTROLS.weightLb} value={inputs.weightLb} onChange={set("weightLb")} />
          <InputSlider {...CONTROLS.windKt} value={inputs.windKt} onChange={set("windKt")} />
        </>
      }
      handles={{
        anchors: fig535Anchors,
        controls: CONTROLS,
        values: inputs,
        setters: { oatC: set("oatC"), weightLb: set("weightLb"), windKt: set("windKt") },
        projections: { windKt: windProjection(CONTROLS.windKt) },
        toggles: { windKt: windToggle(inputs.windKt, set("windKt"), CONTROLS.windKt) },
        outputs: [factoredBadge("distanceOver50FtFt", "Distance over 50 ft", result.distanceOver50FtFt, safety)],
      }}
      safety={safety}
      results={[...factoredRows("Distance over 50 ft", result.distanceOver50FtFt, safety), { label: "Approach / touchdown", value: `${result.approachKias.toFixed(0)} / ${result.touchdownKias.toFixed(0)} KIAS`, emphasize: true }, { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` }, { label: "S₀ @ 2440 lb, calm", value: `${Math.round(result.s0Ft)} ft` }, { label: "× weight", value: `${Math.round(result.s1Ft)} ft` }, { label: "× wind", value: `× ${result.windFactor.toFixed(3)}` }]}
      resultsNote="Printed approach and touchdown speeds are read straight off the chart's speed strips and are never factored."
      warnings={result.warnings}
      notes={{
        form: ["S₀ = 1116 + 0.0261·PA + 2.73·OAT + 1.34e−4·PA·OAT + 1.11e−6·PA² − 8e−4·OAT²", "S  = S₀ · (W/2440)^0.96 · f_wind", "f_wind = (1 − 0.5·Vw/45)^1.47 headwind · (1 + 1.5·Vw/45)^1.70 tailwind"],
        fit: "Panel-1 quadratic surface fitted to the five altitude curves at 0.23% rms; the chain reproduces the chart's printed worked example (2500 ft, 24 °C, 2179 lb, calm → 1135 ft) at −0.4% (≈1131 ft), with intermediates matching the printed dashed trace (S₀ ≈ 1270, after-weight ≈ 1133).",
        findings: ["The printed “REF. LINE — 2400 LBS.” label is a misprint: the line's geometry sits at ≈2438 lb, the 2440 anchor all four takeoff/landing nomographs share (sibling Fig 5-37 prints it correctly).", "Panel 1 is nearly a pure σ^−0.73 power law — noticeably flatter than the sibling ground-roll chart's σ^−0.95, the airborne 50-ft segment diluting the pure TAS² roll scaling.", "Weight exponent 0.96 ≈ 1 is textbook landing physics: kinetic energy ∝ W·Vs² ∝ W² while braking force ∝ W, so distance ∝ W — a sharp contrast with the takeoff charts' 1.85–2.34.", "Wind exponents 1.47/1.70 work against the 45-kt touchdown speed, not the 65-kt approach speed the 50-ft segment is actually flown at.", "The speed strips anchor exactly to physics at 2440 lb (touchdown 45 KIAS = flaps-40 stall IAS from Fig 5-5; approach 65 KIAS = 1.3·Vs0 converted CAS→IAS), but at lighter weights the printed values sit deliberately above both rules — a conservative floor."],
      }}
    />
  );
}
