import { Typography } from "@mui/material";
import { fig519Meta, fig519Trace } from "../charts/fig519";
import { ChartPageLayout } from "../components/ChartPageLayout";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { ClimbToInputs } from "../model/climbFuelTimeDistance";
import { CHART_EXAMPLE, climbFuelTimeDistance } from "../model/climbFuelTimeDistance";

export const chartEntry = {
  id: "fig-5-19",
  label: "Fuel, time & distance to climb (Fig 5-19)",
  Component: ClimbFuelTimeDistancePage,
};

const legValue = (leg: { timeMin: number; distNm: number; fuelGal: number }) => `${leg.timeMin.toFixed(1)} min / ${leg.distNm.toFixed(1)} nm / ${leg.fuelGal.toFixed(1)} gal`;

export function ClimbFuelTimeDistancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof ClimbToInputs]: number }>(CHART_EXAMPLE);
  const result = climbFuelTimeDistance(inputs);
  const { polylines, marker } = fig519Trace(inputs, result);

  const set = (k: keyof ClimbToInputs) => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig519Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind"]}
      sectionLabels={["entry / distance", "fuel", "time"]}
      conditionsNote="2440 lb, flaps 0°, full throttle, mixture leaned per Lycoming, 79 KIAS, no wind."
      conditions={
        <>
          <Typography variant="subtitle2" gutterBottom>
            Departure airport
          </Typography>
          <InputSlider label="Pressure altitude" unit="ft" value={inputs.departurePaFt} min={0} max={11000} step={100} onChange={set("departurePaFt")} />
          <InputSlider label="OAT" unit="°C" value={inputs.departureOatC} min={-40} max={40} step={1} onChange={set("departureOatC")} />
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
            Cruise
          </Typography>
          <InputSlider label="Pressure altitude" unit="ft" value={inputs.cruisePaFt} min={0} max={11000} step={100} onChange={set("cruisePaFt")} />
          <InputSlider label="OAT" unit="°C" value={inputs.cruiseOatC} min={-40} max={40} step={1} onChange={set("cruiseOatC")} />
        </>
      }
      results={[
        { label: "Chart lookup — departure", value: legValue(result.departure) },
        { label: "Chart lookup — cruise", value: legValue(result.cruise) },
        { label: "Time to climb", value: `${result.timeMin.toFixed(1)} min`, emphasize: true },
        { label: "Distance to climb", value: `${result.distNm.toFixed(1)} nm`, emphasize: true },
        { label: "Fuel to climb", value: `${result.fuelGal.toFixed(1)} gal`, emphasize: true },
      ]}
      resultsNote="Answers are the cruise lookup minus the departure lookup, per the chart's printed instructions."
      warnings={result.warnings}
      notes={{
        form: ["y = Σ gᵢⱼ·(PA/1000)ⁱ·(OAT/10)ʲ            (deg-4 nomograph-height surface)", "value = (P꜀ᵤᵣᵥₑ(y) − x₀)/k                 for each of time / distance / fuel", "answer = value(cruise) − value(departure)   (the chart's subtract-two-lookups rule)"],
        fit: "Surface and value-curve polynomials fitted at 1.25% rms; the chart's printed worked example (1500 ft/27 °C departure, 5000 ft/16 °C cruise → 9 min, 12 nm, 2 gal) reproduces at 8.5 min / 11.7 nm / 1.9 gal (−2…−6%).",
        findings: ["The cumulative curves carry a ~+1 min / ~+1 nm sea-level allowance that cancels in the chart's subtract-two-lookups usage — only the differences between lookups are meaningful, not the absolute readings.", "Cross-checked against integrating dh/ROC from the Fig 5-17 climb model, the differences agree to +2.7% on time and +3.3% on distance.", "The implied climb fuel flow is a constant ≈12 GPH — well above the 75% best-power cruise flow of 10 GPH, as expected at full throttle.", "The 12,000-ft curve is clipped by the chart's title box and unusable — the model (and these sliders) stop at 11,000 ft.", "The subtraction rule silently assumes departure and cruise share a similar ISA deviation; the model warns when they differ by more than 10 °C."],
      }}
    />
  );
}
