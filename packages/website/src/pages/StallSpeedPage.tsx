import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { fig505Anchors, fig505Meta, fig505Trace } from "../charts/fig505";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { StallFlaps, StallInputs } from "../model/stallSpeed";
import { CHART_EXAMPLE, stallSpeed } from "../model/stallSpeed";

export const chartEntry = {
  id: "fig-5-05",
  label: "Stall speeds (Fig 5-5)",
  Component: StallSpeedPage,
};

/** One spec per input, driving both the slider and its handle on the chart. */
const CONTROLS = {
  weightLb: { label: "Gross weight", unit: "lb", min: 1600, max: 2440, step: 10 },
  bankDeg: { label: "Angle of bank", unit: "°", min: 0, max: 60, step: 1 },
} satisfies Record<string, ControlSpec>;

export function StallSpeedPage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof StallInputs]: StallInputs[K] }>(CHART_EXAMPLE);
  const result = stallSpeed(inputs);
  const { polylines, marker } = fig505Trace(inputs, result);

  const set = (k: "weightLb" | "bankDeg") => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig505Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "result", "wind"]}
      sectionLabels={["weight entry", "indicated", "calibrated"]}
      conditionsNote="The chart draws only the 0° and 40° flap families; results are given in both KIAS and KCAS."
      conditions={
        <>
          <ToggleButtonGroup exclusive size="small" fullWidth value={inputs.flaps} onChange={(_, v: StallFlaps | null) => v !== null && setInputs({ flaps: v })} sx={{ mb: 2 }}>
            <ToggleButton value={0}>Flaps 0°</ToggleButton>
            <ToggleButton value={40}>Flaps 40°</ToggleButton>
          </ToggleButtonGroup>
          <InputSlider {...CONTROLS.weightLb} value={inputs.weightLb} onChange={set("weightLb")} />
          <InputSlider {...CONTROLS.bankDeg} value={inputs.bankDeg} onChange={set("bankDeg")} />
        </>
      }
      handles={{
        anchors: fig505Anchors,
        controls: CONTROLS,
        values: { weightLb: inputs.weightLb, bankDeg: inputs.bankDeg },
        setters: { weightLb: set("weightLb"), bankDeg: set("bankDeg") },
        // The chart draws two line families against its one speed scale —
        // solid indicated, dash-dot calibrated — so both are read out.
        outputs: [
          { anchor: "stallIasKt", value: result.stallIasKt, text: `${result.stallIasKt.toFixed(0)} KIAS`, label: "Indicated stall speed read-out" },
          { anchor: "stallCasKt", value: result.stallCasKt, text: `${result.stallCasKt.toFixed(0)} KCAS`, label: "Calibrated stall speed read-out" },
        ],
      }}
      results={[
        { label: "Wings-level stall", value: `${result.wingsLevelIasKt.toFixed(1)} KIAS / ${result.wingsLevelCasKt.toFixed(1)} KCAS` },
        { label: "Load factor n", value: `${result.loadFactor.toFixed(2)} g` },
        { label: "Bank multiplier", value: `× ${result.bankFactorApplied.toFixed(3)}` },
        { label: "Stall speed", value: `${result.stallIasKt.toFixed(1)} KIAS`, emphasize: true },
        { label: "Stall speed", value: `${result.stallCasKt.toFixed(1)} KCAS`, emphasize: true },
      ]}
      warnings={result.warnings}
      notes={{
        form: ["Vs₀ = c₂·w² + c₁·w + c₀,  w = W/2440     (per flap; CAS and IAS curves fitted separately)", "Vs(φ) = Vs₀ / cos(φ)^0.499", "n = 1/cos φ,  V ∝ √n                      (exact load-factor physics)"],
        fit: "Curves fitted at 0.08–0.21 kt rms each (0.47% overall). The chart's printed example (2170 lb, 20° bank, flaps 40 → 44 KIAS) reproduces at 43.5 KIAS (−1.1%) — the printed answer is itself 0.5–1 kt generous against the chart's own drawn curves.",
        findings: ["The right-panel bank fan is one universal curve family V = V₀/cos(φ)^0.499 — the fitted exponent is indistinguishable from the physical 0.5, applied multiplicatively to any entry speed.", "The weight curves are drawn shallower than √W near gross weight, steepening to ~√W below ~2000 lb — a drafting choice, not load-factor physics.", "Anchors read from this chart: Vs0 flaps-0 = 50.4 KIAS / 56.1 KCAS; flaps-40 = 44.1 KIAS / 50.1 KCAS. The landing charts' 45-KIAS touchdown and 65-KIAS approach (1.3×Vs0 CAS) anchor to these exactly at 2440 lb.", "The paired solid (IAS) and dash-dot (CAS) families imply a near-constant CAS ≈ IAS + 6.6 kt at stall AoA — used to extend the Fig 5-3 calibration below its drawn 43-KIAS floor."],
      }}
    />
  );
}
