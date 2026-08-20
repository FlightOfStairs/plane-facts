import { fig537Anchors, fig537Meta, fig537Trace } from "../charts/fig537";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import { factoredBadge, factoredRows, useSafetyFactors } from "../lib/useSafetyFactors";
import { windProjection, windToggle } from "../lib/windHandle";
import type { LandingGroundRollInputs } from "../model/landingGroundRoll";
import { CHART_EXAMPLE_5_37, landingGroundRoll } from "../model/landingGroundRoll";

export const chartEntry = {
  id: "fig-5-37",
  label: "Landing ground roll (Fig 5-37)",
  Component: LandingGroundRollPage,
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

export function LandingGroundRollPage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof LandingGroundRollInputs]: number }>(CHART_EXAMPLE_5_37);
  const result = landingGroundRoll(inputs);
  const safety = useSafetyFactors("landing");
  const { polylines, marker } = fig537Trace(inputs, result);

  const set = (k: keyof LandingGroundRollInputs) => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig537Meta}
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
        anchors: fig537Anchors,
        controls: CONTROLS,
        values: inputs,
        setters: { oatC: set("oatC"), weightLb: set("weightLb"), windKt: set("windKt") },
        projections: { windKt: windProjection(CONTROLS.windKt) },
        toggles: { windKt: windToggle(inputs.windKt, set("windKt"), CONTROLS.windKt) },
        outputs: [factoredBadge("groundRollFt", "Ground roll", result.groundRollFt, safety)],
      }}
      safety={safety}
      results={[...factoredRows("Ground roll", result.groundRollFt, safety), { label: "Touchdown", value: `${result.touchdownKias.toFixed(0)} KIAS`, emphasize: true }, { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` }, { label: "S₀ @ 2440 lb, calm", value: `${Math.round(result.s0Ft)} ft` }, { label: "× weight", value: `${Math.round(result.s1Ft)} ft` }, { label: "× wind", value: `× ${result.windFactor.toFixed(3)}` }]}
      resultsNote="Ground roll only — for a landing over an obstacle use Fig 5-35. The printed touchdown speed is read off the chart's speed strip and is never factored."
      warnings={result.warnings}
      notes={{
        form: ["S₀ = 594 + 0.0198·PA + 2.02·OAT + 9e−5·PA·OAT + 5.7e−7·PA² + 0.0015·OAT²", "S  = S₀ · (W/2440)^0.96 · f_wind", "f_wind = (1 − 0.5·Vw/45)^1.90 headwind · (1 + 1.5·Vw/45)^2.08 tailwind"],
        fit: "Panel-1 quadratic surface fitted to the five altitude curves at 0.25% rms; the chain reproduces the chart's printed worked example (2500 ft, 24 °C, 2179 lb, calm → 625 ft) at +0.9% (≈630 ft), with intermediates matching the printed dashed trace (S₀ ≈ 698, after-weight ≈ 625).",
        findings: ["This chart's “REF. LINE 2440 LBS.” is printed correctly — its sibling Fig 5-35 mislabels the same shared reference line “2400 LBS.” (geometry: ≈2438 lb).", "Panel 1 is nearly a pure σ^−0.95 power law: power-off ground roll scales ~1/σ, straight from touchdown TAS².", "Weight exponent 0.96 ≈ 1 is textbook landing physics (KE ∝ W·Vs² ∝ W², braking force ∝ W ⇒ S ∝ W).", "Wind exponents 1.90/2.08 are the largest of all six wind panels, but it is the same physics seen from a lower 45-kt reference speed — rescaled to the 65-KIAS approach speed they match Fig 5-35's 1.47/1.70."],
      }}
    />
  );
}
