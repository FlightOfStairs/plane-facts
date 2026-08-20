import { fig511Anchors, fig511Meta, fig511Trace } from "../charts/fig511";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import { factoredBadge, factoredRows, useSafetyFactors } from "../lib/useSafetyFactors";
import { isTailwind, windProjection, windToggle } from "../lib/windHandle";
import type { TakeoffInputs } from "../model/takeoffGroundRoll25";
import { CHART_EXAMPLE, takeoffGroundRoll25 } from "../model/takeoffGroundRoll25";

export const chartEntry = {
  id: "fig-5-11",
  label: "Takeoff ground roll — flaps 25° (Fig 5-11)",
  Component: TakeoffGroundRoll25Page,
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

export function TakeoffGroundRoll25Page() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof TakeoffInputs]: number }>(CHART_EXAMPLE);
  const result = takeoffGroundRoll25(inputs);
  const safety = useSafetyFactors("takeoff");
  const { polylines, marker } = fig511Trace(inputs, result);

  const set = (k: keyof TakeoffInputs) => (v: number) => setInputs({ [k]: v });

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
      meta={fig511Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      conditionsNote="Paved level dry runway, full power before brake release, flaps 25°."
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltitudeFt} value={inputs.pressureAltitudeFt} onChange={set("pressureAltitudeFt")} />
          <InputSlider {...CONTROLS.oatC} value={inputs.oatC} onChange={set("oatC")} />
          <InputSlider {...CONTROLS.weightLb} value={inputs.weightLb} onChange={set("weightLb")} />
          <InputSlider {...CONTROLS.windKt} value={inputs.windKt} onChange={(v) => setWind(v, v === 0 ? tailwind : v < 0)} />
        </>
      }
      handles={{
        anchors: fig511Anchors,
        controls: CONTROLS,
        values: inputs,
        setters: { oatC: set("oatC"), weightLb: set("weightLb"), windKt: (v) => setWind(v) },
        projections: { windKt: windProjection(CONTROLS.windKt, tailwind) },
        toggles: { windKt: windToggle(inputs.windKt, tailwind, setWind, CONTROLS.windKt) },
        outputs: [factoredBadge("groundRollFt", "Ground roll", result.groundRollFt, safety)],
      }}
      safety={safety}
      results={[...factoredRows("Ground roll", result.groundRollFt, safety), { label: "Lift-off", value: `${result.vLofKcas.toFixed(0)} KIAS / ${result.vLofKtas.toFixed(0)} KTAS`, emphasize: true }, { label: "Density altitude", value: `${Math.round(result.densityAltitudeFt)} ft` }, { label: "S₀ @ 2440 lb, calm", value: `${Math.round(result.s0Ft)} ft` }, { label: "× weight", value: `${Math.round(result.s1Ft)} ft` }]}
      warnings={result.warnings}
      notes={{
        form: ["S₀ = 812 + 0.188·PA + 15.1·OAT            (ft; at 2440 lb, calm)", "S  = S₀ · (W/2440)^1.85 · f_wind(V_TAS, m=1.55)", "V_LOF = 52·√(W/2440) KIAS"],
        fit: "Panel-1 plane fitted to the eight altitude curves at 1.1% rms; the chain reproduces the printed worked example (1500 ft, 27 °C, 2175 lb, 15 kt HW → 975 ft, 48 KIAS) at −2.6% with every intermediate matching the printed dashed trace.",
        findings: ["Panel 1 weighs temperature at only ~80 ft-PA/°C — the carburetted power-lapse anisotropy, strongest evidence of it in the POH.", "Altitude sensitivity (×2.05 at 7000 ft ISA) exceeds σ-physics (×1.67) — conservatism baked in aloft.", "Weight exponent 1.85 is constant along all guide curves; the sibling 0°-flap chart uses 2.34, making the charts nominally cross near 2000 lb.", "V_LOF follows √W exactly and sits only 3.6% above the flaps-40 calibrated stall speed."],
      }}
    />
  );
}
