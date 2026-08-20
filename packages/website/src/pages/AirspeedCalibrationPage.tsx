import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { fig503Anchors, fig503Meta, fig503Trace } from "../charts/fig503";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { FlapSetting } from "../model/airspeed";
import { airspeedCalibration } from "../model/airspeedCalibration";

export const chartEntry = {
  id: "fig-5-03",
  label: "Airspeed calibration (Fig 5-3)",
  Component: AirspeedCalibrationPage,
};

/** IAS is the single stored value; CAS is derived and converted back on edit. */
const DEFAULTS: { flaps: FlapSetting; iasKt: number } = { flaps: "up", iasKt: 100 };

/** The drawn IAS scale; the CAS slider spans whatever this maps to. */
const IAS_MIN = 43;
const IAS_MAX = 160;

export function AirspeedCalibrationPage() {
  const [inputs, setInputs] = useUrlState(DEFAULTS);
  const { flaps, iasKt } = inputs;

  const toCas = (ias: number) => airspeedCalibration({ speedKt: ias, direction: "iasToCas", flaps });
  const toIas = (cas: number) => airspeedCalibration({ speedKt: cas, direction: "casToIas", flaps }).iasKt;

  const result = toCas(iasKt);
  const { polylines, marker } = fig503Trace(result);
  const setCas = (cas: number) => setInputs({ iasKt: Number(toIas(cas).toFixed(1)) });

  /**
   * Two views of one speed, not two independent inputs: moving either slider
   * (or either chart handle) writes the same stored IAS, so the pair can never
   * disagree and the trace never jumps.
   */
  const CONTROLS = {
    iasKt: { label: "Indicated airspeed", unit: "kt", min: IAS_MIN, max: IAS_MAX, step: 1 },
    casKt: { label: "Calibrated airspeed", unit: "kt", min: Math.round(toCas(IAS_MIN).casKt), max: Math.round(toCas(IAS_MAX).casKt), step: 1 },
  } satisfies Record<string, ControlSpec>;

  const err = result.positionErrorKt;

  return (
    <ChartPageLayout
      meta={fig503Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "result"]}
      sectionLabels={["IAS entry", "CAS read-out"]}
      conditionsNote="Pure IAS ↔ CAS geometry — no atmosphere, weight or power enters this chart."
      conditions={
        <>
          <ToggleButtonGroup exclusive size="small" fullWidth sx={{ mb: 2 }} value={flaps} onChange={(_, v: FlapSetting | null) => v && setInputs({ flaps: v })}>
            <ToggleButton value="up">Flaps up</ToggleButton>
            <ToggleButton value="deg40">Flaps 40°</ToggleButton>
          </ToggleButtonGroup>
          <InputSlider {...CONTROLS.iasKt} value={Math.round(iasKt)} onChange={(v) => setInputs({ iasKt: v })} />
          <InputSlider {...CONTROLS.casKt} value={Math.round(result.casKt)} onChange={setCas} />
        </>
      }
      handles={{
        anchors: fig503Anchors,
        controls: CONTROLS,
        values: { iasKt: Math.round(iasKt), casKt: Math.round(result.casKt) },
        setters: { iasKt: (v) => setInputs({ iasKt: v }), casKt: setCas },
      }}
      results={[
        { label: "Indicated airspeed", value: `${result.iasKt.toFixed(1)} KIAS` },
        { label: "Calibrated airspeed", value: `${result.casKt.toFixed(1)} KCAS` },
        { label: "Position error (CAS − IAS)", value: `${err >= 0 ? "+" : ""}${err.toFixed(1)} kt` },
      ]}
      warnings={result.warnings}
      notes={{
        form: ["CAS = a₀ + a₁·IAS + a₂·IAS²                (per flap setting)", "flaps up:  a = (16.577, 0.7544,  0.0006344)   56–159 KIAS", "flaps 40°: a = (23.196, 0.52737, 0.0020457)   43–103 KIAS (Vfe)", "below ~43 KIAS: CAS ≈ IAS + 6.6 kt          (stall-range offset from Fig 5-5)"],
        fit: "Quadratics fitted to the printed lines at 0.23 kt rms. The POH prints no worked example on this chart, so the fit is validated against Fig 5-5's independently digitized stall anchors: 44.1 KIAS flaps 40 → 50.4 KCAS vs 50.2 printed (+0.5%), and 50.2 KIAS flaps up → 56.1 KCAS vs 56.1 (−0.1%).",
        findings: ["CAS = IAS at ~87 KIAS flaps up / ~71 KIAS flaps 40; below the crossover the indicator under-reads (CAS > IAS), which is why the stall speeds in Fig 5-5 look optimistic in KIAS.", "The flaps-40 line ends at Vfe (103 KIAS), where it merges into the flaps-up line — the model falls back to the flaps-up quadratic above it.", "Below ~43 KIAS nothing is drawn; Fig 5-5's paired CAS/IAS stall curves imply a near-constant CAS ≈ IAS + 6.6 kt offset, which the model uses in the stall range.", "The landing charts anchor to this one exactly: the 65-KIAS approach speed of Figs 5-35/5-37 is 1.3×Vs0 in CAS converted back through this calibration (64.7 KIAS)."],
      }}
    />
  );
}
