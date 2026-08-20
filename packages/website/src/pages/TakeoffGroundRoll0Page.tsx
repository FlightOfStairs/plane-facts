import { fig507Anchors, fig507Meta, fig507Trace } from "../charts/fig507";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import { factoredBadge, factoredRows, useSafetyFactors } from "../lib/useSafetyFactors";
import { windProjection, windToggle } from "../lib/windHandle";
import type { TakeoffRoll0Inputs } from "../model/takeoffGroundRoll0";
import { CHART_EXAMPLE_5_07, takeoffGroundRoll0 } from "../model/takeoffGroundRoll0";

export const chartEntry = {
  id: "fig-5-07",
  label: "Takeoff ground roll — flaps 0° (Fig 5-7)",
  Component: TakeoffGroundRoll0Page,
};

/** One spec per input, driving both the slider and its handle on the chart. */
const CONTROLS = {
  pressureAltitudeFt: { label: "Pressure altitude", unit: "ft", min: 0, max: 6000, step: 100 },
  oatC: { label: "OAT", unit: "°C", min: -40, max: 40, step: 1 },
  // The weight scale is drawn down to 1600 lb even though its last
  // labelled tick is 1700 — 1600 lands exactly on the wind panel's reference
  // line, which is where the panel ends.
  weightLb: { label: "Weight", unit: "lb", min: 1600, max: 2440, step: 5 },
  windKt: { label: "Wind (+HW / −TW)", unit: "kt", min: -5, max: 15, step: 1 },
} satisfies Record<string, ControlSpec>;

export function TakeoffGroundRoll0Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffRoll0Inputs]: number }>(CHART_EXAMPLE_5_07);
  const result = takeoffGroundRoll0(inputs);
  const safety = useSafetyFactors("takeoff");
  const { polylines, marker } = fig507Trace(inputs, result);

  const set = (k: keyof TakeoffRoll0Inputs) => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig507Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      conditionsNote="Paved level dry runway, full power before brake release, flaps 0°."
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltitudeFt} value={inputs.pressureAltitudeFt} onChange={set("pressureAltitudeFt")} />
          <InputSlider {...CONTROLS.oatC} value={inputs.oatC} onChange={set("oatC")} />
          <InputSlider {...CONTROLS.weightLb} value={inputs.weightLb} onChange={set("weightLb")} />
          <InputSlider {...CONTROLS.windKt} value={inputs.windKt} onChange={set("windKt")} />
        </>
      }
      handles={{
        anchors: fig507Anchors,
        controls: CONTROLS,
        values: inputs,
        setters: { oatC: set("oatC"), weightLb: set("weightLb"), windKt: set("windKt") },
        projections: { windKt: windProjection(CONTROLS.windKt) },
        toggles: { windKt: windToggle(inputs.windKt, set("windKt"), CONTROLS.windKt) },
        outputs: [factoredBadge("groundRollFt", "Ground roll", result.groundRollFt, safety)],
      }}
      safety={safety}
      results={[...factoredRows("Ground roll", result.groundRollFt, safety), { label: "Lift-off", value: `${result.vLofKias.toFixed(0)} KIAS / ${result.vLofKtas.toFixed(0)} KTAS`, emphasize: true }, { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` }, { label: "S₀ @ 2440 lb, calm", value: `${Math.round(result.s0Ft)} ft` }, { label: "× weight", value: `${Math.round(result.s1Ft)} ft` }]}
      warnings={result.warnings}
      notes={{
        form: ["S₀ = 865 + 0.211·PA + 17.8·OAT            (ft; at 2440 lb, calm)", "S  = S₀ · (W/2440)^2.34 · f_wind", "f_wind = (1 − Vw/93)^1.45 headwind · (1 + Vw/28)^1.4 tailwind", "V_LOF = 52·√(W/2440) KIAS"],
        fit: "Panel-1 plane fitted to the altitude curves at 1.6% rms (weight panel 1.0%); the assembled chain reproduces the chart's printed worked example (1500 ft, 27 °C, 2316 lb, 15 kt HW → 1150 ft, 50 KIAS) at −0.9% (≈1139 ft, 50.7 KIAS), with intermediates matching the printed dashed trace (S₀ ≈ 1665, after-weight ≈ 1477).",
        findings: ["Panel 1 weighs temperature at ~84 ft-PA/°C — the steepest of the takeoff family, and still well below the ~96 a density-altitude model would force.", "Weight exponent 2.34 is the largest of the four takeoff/landing nomographs; against Fig 5-11's 1.85 the two ground-roll charts nominally cross near 2000 lb, so the 0-flap penalty shrinks with weight.", "V_LOF at 2440 lb is 52 KIAS — identical to the 25°-flap chart, which is aerodynamically suspect. The printed strip labels also run 1–1.5 kt below the √W law at light weight.", "This is the one wind panel whose headwind and tailwind guides do not share a reference speed: under the 50/150 credit they imply ≈46.5 kt headwind vs ≈42 kt tailwind, so the model keeps its own two-sided form."],
      }}
    />
  );
}
