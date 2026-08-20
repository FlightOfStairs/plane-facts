import { fig509Anchors, fig509Meta, fig509PaAnchorPx, fig509Trace } from "../charts/fig509";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import { factoredBadge, factoredRows, useSafetyFactors } from "../lib/useSafetyFactors";
import { modelProjection } from "../lib/modelProjection";
import { isTailwind, windProjection, windToggle } from "../lib/windHandle";
import type { TakeoffOver50Flaps0Inputs } from "../model/takeoffOver50Flaps0";
import { CHART_EXAMPLE_5_09, takeoffOver50Flaps0 } from "../model/takeoffOver50Flaps0";

export const chartEntry = {
  id: "fig-5-09",
  label: "Takeoff over 50 ft — flaps 0° (Fig 5-9)",
  Component: TakeoffOver50Flaps0Page,
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

export function TakeoffOver50Flaps0Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffOver50Flaps0Inputs]: number }>(CHART_EXAMPLE_5_09);
  const result = takeoffOver50Flaps0(inputs);
  const safety = useSafetyFactors("takeoff");
  const { polylines, marker } = fig509Trace(inputs, result);

  const set = (k: keyof TakeoffOver50Flaps0Inputs) => (v: number) => setInputs({ [k]: v });

  // Sign alone cannot carry the wind direction through zero, so the choice is
  // remembered separately: wind the handle down to 0 kt and back up and it
  // still blows the way you set it.
  const [{ windTail }, setWindTail] = useUrlState({ windTail: false });
  const tailwind = isTailwind(inputs.windKt, windTail);
  const setWind = (windKt: number, tail = tailwind) => {
    setInputs({ windKt: tail ? -Math.abs(windKt) : Math.abs(windKt) });
    setWindTail({ windTail: tail });
  };

  return (
    <ChartPageLayout
      meta={fig509Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      conditionsNote="Paved level dry runway, full power before brake release, flaps 0°."
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltitudeFt} value={inputs.pressureAltitudeFt} onChange={set("pressureAltitudeFt")} />
          <InputSlider {...CONTROLS.oatC} value={inputs.oatC} onChange={set("oatC")} />
          <InputSlider {...CONTROLS.weightLb} value={inputs.weightLb} onChange={set("weightLb")} />
          <InputSlider {...CONTROLS.windKt} value={inputs.windKt} onChange={(v) => setWind(v, v === 0 ? tailwind : v < 0)} />
        </>
      }
      handles={{
        anchors: fig509Anchors,
        controls: CONTROLS,
        values: inputs,
        setters: { pressureAltitudeFt: set("pressureAltitudeFt"), oatC: set("oatC"), weightLb: set("weightLb"), windKt: (v) => setWind(v) },
        anchorPx: { pressureAltitudeFt: fig509PaAnchorPx(inputs.oatC) },
        projections: {
          windKt: windProjection(CONTROLS.windKt, tailwind),
          // No PA scale exists, so the handle rides the transfer line whose
          // height the PA sets, and the model maps between the two.
          pressureAltitudeFt: modelProjection({ toAxis: (pa) => takeoffOver50Flaps0({ ...inputs, pressureAltitudeFt: pa }).s0Ft, bounds: CONTROLS.pressureAltitudeFt }),
        },
        toggles: { windKt: windToggle(inputs.windKt, tailwind, setWind, CONTROLS.windKt) },
        outputs: [factoredBadge("distanceOver50Ft", "Distance over 50 ft", result.distanceOver50Ft, safety)],
      }}
      safety={safety}
      results={[...factoredRows("Distance over 50 ft", result.distanceOver50Ft, safety), { label: "Lift-off", value: `${result.vLofKias.toFixed(0)} KIAS / ${result.vLofKtas.toFixed(0)} KTAS`, emphasize: true }, { label: "Barrier (50 ft)", value: `${result.v50Kias.toFixed(0)} KIAS / ${result.v50Ktas.toFixed(0)} KTAS`, emphasize: true }, { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` }, { label: "S₀ @ 2440 lb, calm", value: `${Math.round(result.s0Ft)} ft` }, { label: "× weight", value: `${Math.round(result.s1Ft)} ft` }]}
      warnings={result.warnings}
      notes={{
        form: ["S₀ = 1674 + 0.261·PA + 1.13e−5·PA² + (22.9 + 0.00182·PA)·OAT", "S  = S₀ · exp((2.04 − 0.417·ln(S₀/2500))·u − 3.18·u² − 4.57·u³),  u = ln(W/2440)", "f_wind = (1 − 0.5·Vw/57)^(1.44−0.23·ln(S/2500)) HW · (1 + 1.5·Vw/57)^(1.62−0.56·ln(S/2500)) TW", "V_LOF = 17.9 + 0.0139·W KIAS,   V₅₀ = 19.3 + 0.0154·W KIAS"],
        fit: "Panel fits land at 0.7–1.1% rms. Against the chart's printed worked example (1500 ft, 27 °C, 2316 lb, 15 kt HW → 2100 ft, 50/55 KIAS) the model gives ≈2029 ft (−3.4%) and 50.1/54.9 KIAS — the printed dashed trace itself sits 1–2.5% above the chart's own guide curves, so the smooth fit reads low.",
        findings: ["The weight correction is not a power law: the local exponent drifts ≈2.0 → 2.7 toward light weight, needing a cubic in ln(W) — its siblings use constant exponents (1.85, 2.02, 2.34).", "Uniquely among the nomographs, the wind exponents depend on distance (1.44 − 0.23·ln(S/2500) headwind): longer takeoffs get proportionally less wind relief.", "The wind panel's lowest guide — the one starting at 500 ft — is drawn parallel to its neighbour rather than shallower, so it cuts 40% for 15 kt of headwind where the other seven cut ~20%. It would need a ~25 kt barrier speed to be real, so it is excluded from the fit and the model follows the rest of the family (×0.78 there, i.e. longer than the drawn ×0.60).", "Speed strips are linear in weight (not √W as on Figs 5-7/5-11) and extend past the 1700-lb axis end to a ~1600-lb position; barrier speed ≈ 1.10 × lift-off throughout.", "The topmost altitude curve is unlabeled: identified as 7000 ft via its ISA std-temp-line crossing."],
      }}
    />
  );
}
