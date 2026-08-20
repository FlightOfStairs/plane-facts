import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig525Anchors, fig525Meta, fig525Trace } from "../charts/fig525";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { ReservePolicy } from "../model/rangeEndurance";
import { CHART_EXAMPLE_5_25, enduranceHr, impliedBlockTasKt, rangeNm } from "../model/rangeEndurance";

export const chartEntry = {
  id: "fig-5-25",
  label: "Range — best power mixture (Fig 5-25)",
  Component: BestPowerRangePage,
};

/** One spec per input, driving both the slider and its handle on the chart. */
const CONTROLS = {
  pressureAltFt: { label: "Cruise pressure altitude", unit: "ft", min: 0, max: 12000, step: 100 },
} satisfies Record<string, ControlSpec>;

export function BestPowerRangePage() {
  const [inputs, setInputs] = useUrlState<{ pressureAltFt: number; oatC: number; power: number; reserve: ReservePolicy }>({
    pressureAltFt: CHART_EXAMPLE_5_25.pressureAltFt,
    oatC: CHART_EXAMPLE_5_25.oatC,
    power: CHART_EXAMPLE_5_25.power,
    reserve: CHART_EXAMPLE_5_25.reserve,
  });
  const { pressureAltFt, oatC } = inputs;
  // Guard the discrete settings against arbitrary URL values.
  const power = Math.min(100, Math.max(55, inputs.power));
  const reserve: ReservePolicy = inputs.reserve === "noReserve" ? "noReserve" : "reserve45";

  const common = { mixture: "bestPower" as const, power, pressureAltFt, oatC };
  const reserveRes = rangeNm({ ...common, reserve: "reserve45" });
  const noReserveRes = rangeNm({ ...common, reserve: "noReserve" });
  const selected = reserve === "reserve45" ? reserveRes : noReserveRes;
  const endu = enduranceHr({ power, reserve, pressureAltFt });
  const blockTas = impliedBlockTasKt(selected.baseRangeNm, endu.enduranceHr);
  const { polylines, marker } = fig525Trace(pressureAltFt, reserveRes.baseRangeNm, noReserveRes.baseRangeNm, reserve);

  return (
    <ChartPageLayout
      meta={fig525Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      sectionLabels={["altitude entry", "45-min-reserve read", "no-reserve read", "result"]}
      conditionsNote="Fixed by the chart: 2300 lb mid-cruise weight, no wind, 48 gal usable fuel, wheel fairings (up to −7% without). Range includes the distance to climb and descend."
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltFt} value={pressureAltFt} onChange={(v) => setInputs({ pressureAltFt: v })} />
          <InputSlider label="Cruise OAT" unit="°C" value={oatC} min={-25} max={40} step={1} onChange={(v) => setInputs({ oatC: v })} />
          <Typography variant="body2" gutterBottom>
            Cruise power (best power mixture)
          </Typography>
          <InputSlider
            label="Cruise power"
            unit="%"
            value={power}
            min={0}
            max={100}
            step={1}
            softMin={55}
            marks={[
              { value: 55, label: "55" },
              { value: 65, label: "65" },
              { value: 75, label: "75" },
            ]}
            onChange={(v) => setInputs({ power: v })}
          />
          <Typography variant="body2" gutterBottom>
            Reserve policy
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={reserve} onChange={(_, v: ReservePolicy | null) => v !== null && setInputs({ reserve: v })}>
            <ToggleButton value="reserve45">45 min @ 55%</ToggleButton>
            <ToggleButton value="noReserve">No reserve</ToggleButton>
          </ToggleButtonGroup>
        </>
      }
      handles={{
        anchors: fig525Anchors,
        controls: CONTROLS,
        values: { pressureAltFt },
        setters: { pressureAltFt: (v) => setInputs({ pressureAltFt: v }) },
        outputs: [
          { anchor: "reserve45", value: reserveRes.baseRangeNm, text: `${reserveRes.baseRangeNm.toFixed(0)} nm`, label: "Range with 45-minute reserve" },
          { anchor: "noReserve", value: noReserveRes.baseRangeNm, text: `${noReserveRes.baseRangeNm.toFixed(0)} nm`, label: "Range with no reserve" },
        ],
      }}
      results={[
        { label: "Std temp @ altitude", value: `${selected.stdTempC.toFixed(1)} °C` },
        { label: "ISA deviation", value: `${selected.deltaIsaC >= 0 ? "+" : ""}${selected.deltaIsaC.toFixed(1)} °C` },
        { label: "Chart read (std temp)", value: `${selected.baseRangeNm.toFixed(0)} nm` },
        { label: "Temp correction (+0.6 / −1.0 nm per °C)", value: `${selected.tempCorrNm >= 0 ? "+" : ""}${selected.tempCorrNm.toFixed(1)} nm` },
        { label: "Range — 45-min reserve", value: `${reserveRes.rangeNm.toFixed(0)} nm`, emphasize: reserve === "reserve45" },
        { label: "Range — no reserve", value: `${noReserveRes.rangeNm.toFixed(0)} nm`, emphasize: reserve === "noReserve" },
        { label: "Implied avg block TAS (range ÷ endurance, std temp)", value: `${blockTas.toFixed(0)} kt` },
      ]}
      resultsNote="Block TAS cross-check uses the Fig 5-29 endurance chart, which assumes best economy mixture — treat it as approximate here."
      warnings={selected.warnings}
      notes={{
        form: ["range = R₀ + slope·PA + ΔT corr        (per {reserve policy} × {55/65/75%} line)", "ΔT corr = +0.6 nm/°C above std, −1.0 nm/°C below", "Tstd = 15 − 1.9812·PA/1000"],
        fit: "Six straight lines fitted at 0.084% rms overall (worst curve 0.15%). The chart's printed example (5000 ft, 16 °C, 75% → 507.6 / 567.6 nm with/without reserve) reproduces at 508.6 / 566.3 nm (+0.2%).",
        findings: ["The range axis carries two offset 50-nm scales on one lattice — the no-reserve family reads 150 nm lower than the reserve scale at the same grid position (the sibling Fig 5-27 offset is 100 nm); gridline-only calibration is essential.", "The temperature correction is two-sided and asymmetric: being cold costs 1.0 nm/°C while being warm only gains 0.6 — the drafted line is not tangent to any single physical model.", "75% curves end near 9,000 ft — the full-throttle limit; the 65% curves run on to 12–13,000 ft.", "Best economy (Fig 5-27) beats this chart by 13–16% range at equal nominal %power for only ~4 kt TAS."],
      }}
    />
  );
}
