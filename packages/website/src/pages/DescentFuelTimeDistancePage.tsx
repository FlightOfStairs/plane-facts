import { fig531Meta, fig531Trace } from "../charts/fig531";
import { ChartPageLayout } from "../components/ChartPageLayout";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { DescentInputs } from "../model/descentFuelTimeDistance";
import { CHART_EXAMPLE, FUEL_TOLERANCE_GAL, descentFuelTimeDistance } from "../model/descentFuelTimeDistance";

export const chartEntry = {
  id: "fig-5-31",
  label: "Descent fuel/time/distance (Fig 5-31)",
  Component: DescentFuelTimeDistancePage,
};

export function DescentFuelTimeDistancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof DescentInputs]: number }>(CHART_EXAMPLE);
  const result = descentFuelTimeDistance(inputs);
  const { polylines, marker } = fig531Trace(inputs, result);

  const set = (k: keyof DescentInputs) => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig531Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      sectionLabels={["entry / distance read", "fuel read", "time read", "result"]}
      conditionsNote="2500 RPM, 126 KIAS, no wind."
      conditions={
        <>
          <InputSlider label="Cruise pressure altitude" unit="ft" value={inputs.cruisePressureAltitudeFt} min={0} max={12000} step={100} onChange={set("cruisePressureAltitudeFt")} />
          <InputSlider label="Cruise OAT" unit="°C" value={inputs.cruiseOatC} min={-40} max={40} step={1} onChange={set("cruiseOatC")} />
          <InputSlider label="Destination pressure altitude" unit="ft" value={inputs.destPressureAltitudeFt} min={0} max={12000} step={100} onChange={set("destPressureAltitudeFt")} />
          <InputSlider label="Destination OAT" unit="°C" value={inputs.destOatC} min={-40} max={40} step={1} onChange={set("destOatC")} />
        </>
      }
      results={[
        { label: "Cruise effective altitude", value: `${Math.round(result.cruise.effectiveAltitudeFt)} ft` },
        { label: "Destination effective altitude", value: `${Math.round(result.destination.effectiveAltitudeFt)} ft` },
        { label: "Time readings (cruise − dest)", value: `${result.cruise.timeMin.toFixed(1)} − ${result.destination.timeMin.toFixed(1)} min` },
        { label: "Distance readings", value: `${result.cruise.distNm.toFixed(1)} − ${result.destination.distNm.toFixed(1)} nm` },
        { label: "Fuel readings", value: `${result.cruise.fuelGal.toFixed(2)} − ${result.destination.fuelGal.toFixed(2)} gal` },
        { label: "Time to descend", value: `${result.timeMin.toFixed(1)} min`, emphasize: true },
        { label: "Distance to descend", value: `${result.distNm.toFixed(1)} nm`, emphasize: true },
        { label: "Fuel to descend", value: `${result.fuelGal.toFixed(1)} ±${FUEL_TOLERANCE_GAL} gal`, emphasize: true },
      ]}
      resultsNote="A difference nomograph: the individual readings carry drafting offsets, so only cruise-minus-destination differences are meaningful."
      warnings={result.warnings}
      notes={{
        form: ["h_e = PA + a₁·ΔT + a₂·ΔT·PA/1000 + b₁·ΔT² + b₂·ΔT²·PA/1000 + c₃·ΔT³", "ΔT = OAT − (15 − 1.9812·PA/1000)", "time, dist, fuel = cubic(h_e)                  (cumulative curves)", "answer = reading(cruise PA, OAT) − reading(dest PA, OAT)"],
        fit: "Overall fit 1.37% rms (effective-altitude surface 164 ft rms; per-curve 0.18 min / 0.16 nm / 0.08 gal). The chart's printed example (cruise 5000 ft / 16 °C, destination 2500 ft / 24 °C → 3.0 min, 5.5 nm, 0.5 gal) reproduces at 2.91 min (−3.1%), 5.56 nm (+1.0%) and 0.33 gal — the printed 0.5 is a rounded read of a drawn ≈0.62 gal.",
        findings: ["The temperature sign is inverted vs density physics — warmer than ISA means less time, fuel and distance to descend, worth ≈−8 ft of effective altitude per °C at sea level rising to ≈−60 ft/°C at 10,000 ft.", "The implied rate of descent grows strongly with altitude — ~500 fpm near sea level to 1400+ fpm above 10,000 ft — at the fixed 2500 RPM / 126 KIAS schedule.", "The near-vertical fuel curve on the 0.5-gal grid limits fuel answers to roughly ±0.2 gal; the POH's own example prints 0.5 gal for a drawn ≈0.6.", "A hidden 6000-ft curve lies under the worked example's dashed transfer line — easy to mistake for the trace itself."],
      }}
    />
  );
}
