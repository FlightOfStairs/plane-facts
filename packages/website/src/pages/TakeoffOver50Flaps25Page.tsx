import { fig513Anchors, fig513Meta, fig513Trace } from "../charts/fig513";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import { factoredBadge, factoredRows, useSafetyFactors } from "../lib/useSafetyFactors";
import { windProjection, windToggle } from "../lib/windHandle";
import type { TakeoffOver50Flaps25Inputs } from "../model/takeoffOver50Flaps25";
import { CHART_EXAMPLE_5_13, takeoffOver50Flaps25 } from "../model/takeoffOver50Flaps25";

export const chartEntry = {
  id: "fig-5-13",
  label: "Takeoff over 50 ft — flaps 25° (Fig 5-13)",
  Component: TakeoffOver50Flaps25Page,
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

export function TakeoffOver50Flaps25Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffOver50Flaps25Inputs]: number }>(CHART_EXAMPLE_5_13);
  const result = takeoffOver50Flaps25(inputs);
  const safety = useSafetyFactors("takeoff");
  const { polylines, marker } = fig513Trace(inputs, result);

  const set = (k: keyof TakeoffOver50Flaps25Inputs) => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig513Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      conditionsNote="Paved level dry runway, full power before brake release, flaps 25°."
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltitudeFt} value={inputs.pressureAltitudeFt} onChange={set("pressureAltitudeFt")} />
          <InputSlider {...CONTROLS.oatC} value={inputs.oatC} onChange={set("oatC")} />
          <InputSlider {...CONTROLS.weightLb} value={inputs.weightLb} onChange={set("weightLb")} />
          <InputSlider {...CONTROLS.windKt} value={inputs.windKt} onChange={set("windKt")} />
        </>
      }
      handles={{
        anchors: fig513Anchors,
        controls: CONTROLS,
        values: inputs,
        setters: { oatC: set("oatC"), weightLb: set("weightLb"), windKt: set("windKt") },
        projections: { windKt: windProjection(CONTROLS.windKt) },
        toggles: { windKt: windToggle(inputs.windKt, set("windKt"), CONTROLS.windKt) },
        outputs: [factoredBadge("distanceOver50Ft", "Distance over 50 ft", result.distanceOver50Ft, safety)],
      }}
      safety={safety}
      results={[...factoredRows("Distance over 50 ft", result.distanceOver50Ft, safety), { label: "Lift-off", value: `${result.vLofKias.toFixed(0)} KIAS / ${result.vLofKtas.toFixed(0)} KTAS`, emphasize: true }, { label: "Barrier (50 ft)", value: `${result.v50Kias.toFixed(0)} KIAS / ${result.v50Ktas.toFixed(0)} KTAS`, emphasize: true }, { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` }, { label: "S₀ @ 2440 lb, calm", value: `${Math.round(result.s0Ft)} ft` }, { label: "× weight", value: `${Math.round(result.s1Ft)} ft` }]}
      warnings={result.warnings}
      notes={{
        form: ["S₀ = 1313 + 0.206·PA + 21.5·OAT + 0.00187·PA·OAT + 1.29e−5·PA² + 0.0445·OAT²", "S  = S₀ · (W/2440)^2.02 · f_wind", "f_wind = (1 − 0.5·Vw/52)^1.49 headwind · (1 + 1.5·Vw/52)^1.42 tailwind", "V_LOF, V₅₀ = printed strip anchors, piecewise-linear in W  (V₅₀ ≈ 1.10·V_LOF)"],
        fit: "Panel-1 quadratic fitted at 1.06% rms; the assembled chain reproduces the chart's printed worked example (1500 ft, 27 °C, 2175 lb, 15 kt HW → 1500 ft, 48/53 KIAS) at −1.9% (≈1470 ft, 47.8/52.6 KIAS), with intermediates matching the printed dashed trace (S₀ ≈ 2345, after-weight ≈ 1873) to <1%.",
        findings: ["Unlike Fig 5-11, the altitude fan is not a plane in (PA, OAT): a full quadratic is needed for ~1% rms — a plane alone leaves 3.8%.", "Weight exponent 2.02 sits between its siblings' 1.85 (Fig 5-11) and 2.34 (Fig 5-7).", "Refit in TAS terms, the headwind exponent becomes 1.55 — matching Fig 5-11's wind panel exactly, the closest agreement between any two of the nomographs.", "The lift-off/barrier speed strips are linear in weight (not ∝ √W) and extend past the 1700-lb axis end; the barrier speed is ≈1.10 × lift-off throughout.", "The tailwind exponent (1.42) is weakly constrained — the chart draws only two short usable tailwind guides."],
      }}
    />
  );
}
