import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig529Anchors, fig529Meta, fig529PowerAnchorPx, fig529Trace } from "../charts/fig529";
import { ChartPageLayout } from "../components/ChartPageLayout";
import type { ControlSpec } from "../components/InputSlider";
import { InputSlider } from "../components/InputSlider";
import { modelProjection } from "../lib/modelProjection";
import { useUrlState } from "../lib/urlState";
import { isaTempC } from "../model/atmosphere";
import type { ReservePolicy } from "../model/rangeEndurance";
import { CHART_EXAMPLE_5_29, enduranceHr, impliedBlockTasKt, rangeNm } from "../model/rangeEndurance";

export const chartEntry = {
  id: "fig-5-29",
  label: "Endurance (Fig 5-29)",
  Component: EndurancePage,
};

function formatHours(hr: number): string {
  const h = Math.floor(hr);
  const m = Math.round((hr - h) * 60);
  return `${hr.toFixed(2)} hr (${h}:${String(m).padStart(2, "0")})`;
}

/** One spec per input, driving both the slider and its handle on the chart. */
const CONTROLS = {
  pressureAltFt: { label: "Cruise pressure altitude", unit: "ft", min: 0, max: 12000, step: 100 },
  power: {
    label: "Cruise power",
    unit: "%",
    min: 0,
    max: 100,
    step: 1,
    // The chart publishes nothing below 55%, so the handle stops there too.
    softMin: 55,
    marks: [
      { value: 55, label: "55" },
      { value: 65, label: "65" },
      { value: 75, label: "75" },
    ],
  },
} satisfies Record<string, ControlSpec>;

export function EndurancePage() {
  const [inputs, setInputs] = useUrlState<{ pressureAltFt: number; power: number; reserve: ReservePolicy }>({
    pressureAltFt: CHART_EXAMPLE_5_29.pressureAltFt,
    power: CHART_EXAMPLE_5_29.power,
    reserve: CHART_EXAMPLE_5_29.reserve,
  });
  const { pressureAltFt } = inputs;
  // Guard the discrete settings against arbitrary URL values.
  const power = Math.min(100, Math.max(55, inputs.power));
  const reserve: ReservePolicy = inputs.reserve === "noReserve" ? "noReserve" : "reserve45";

  const reserveRes = enduranceHr({ power, reserve: "reserve45", pressureAltFt });
  const noReserveRes = enduranceHr({ power, reserve: "noReserve", pressureAltFt });
  const selected = reserve === "reserve45" ? reserveRes : noReserveRes;
  // Cross-check: Fig 5-27 range (same mixture, power, policy) at std temp ÷ endurance.
  const stdRange = rangeNm({ mixture: "bestEconomy", power, reserve, pressureAltFt, oatC: isaTempC(pressureAltFt) });
  const blockTas = impliedBlockTasKt(stdRange.baseRangeNm, selected.enduranceHr);
  const { polylines, marker } = fig529Trace(pressureAltFt, reserveRes.enduranceHr, noReserveRes.enduranceHr, reserve);

  return (
    <ChartPageLayout
      meta={fig529Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "wind", "result"]}
      sectionLabels={["altitude entry", "45-min-reserve read", "no-reserve read", "result"]}
      conditionsNote="Fixed by the chart: best economy mixture leaned per Section 4, 48 gal usable fuel. Includes time to climb and descend; no temperature axis is printed."
      conditions={
        <>
          <InputSlider {...CONTROLS.pressureAltFt} value={pressureAltFt} onChange={(v) => setInputs({ pressureAltFt: v })} />
          <Typography variant="body2" gutterBottom>
            Cruise power (best economy mixture)
          </Typography>
          <InputSlider {...CONTROLS.power} value={power} onChange={(v) => setInputs({ power: v })} />
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
        anchors: fig529Anchors,
        controls: CONTROLS,
        values: { pressureAltFt, power },
        setters: { pressureAltFt: (v) => setInputs({ pressureAltFt: v }), power: (v) => setInputs({ power: v }) },
        anchorPx: { power: fig529PowerAnchorPx(pressureAltFt) },
        // Sliding along the read-out axis picks the %power curve that meets
        // the altitude transfer there.
        projections: { power: modelProjection({ toAxis: (p) => enduranceHr({ power: p, reserve: "reserve45", pressureAltFt }).enduranceHr, bounds: CONTROLS.power }) },
        captions: { reserve45: "45-min reserve", noReserve: "no reserve" },
        outputs: [
          { anchor: "reserve45", value: reserveRes.enduranceHr, text: `${reserveRes.enduranceHr.toFixed(1)} hr`, label: "Endurance with 45-minute reserve" },
          { anchor: "noReserve", value: noReserveRes.enduranceHr, text: `${noReserveRes.enduranceHr.toFixed(1)} hr`, label: "Endurance with no reserve" },
        ],
      }}
      results={[
        { label: "Endurance — 45-min reserve", value: formatHours(reserveRes.enduranceHr), emphasize: reserve === "reserve45" },
        { label: "Endurance — no reserve", value: formatHours(noReserveRes.enduranceHr), emphasize: reserve === "noReserve" },
        { label: "Fig 5-27 range (std temp, same policy)", value: `${stdRange.baseRangeNm.toFixed(0)} nm` },
        { label: "Implied avg block TAS (range ÷ endurance)", value: `${blockTas.toFixed(0)} kt` },
      ]}
      warnings={selected.warnings}
      notes={{
        form: ["endurance = E₀ + b·PA + c·PA²        (per {reserve policy} × {55/65/75%} curve)", "no temperature term — the chart prints no OAT axis"],
        fit: "Per-curve quadratics fit the digitized curves at ≈0% rms. The chart's printed example (5000 ft, 75% → 4.85 / 5.45 hr with/without reserve) reproduces at 4.82 / 5.44 hr (−0.5%).",
        findings: ["The hours axis carries two offset 1-hr scales on one continuous lattice — the no-reserve family (drawn dashed in the original) reads 8 hr lower than the reserve scale at the same grid position.", "Endurance is nearly altitude-independent: the curves bow slightly and peak near mid altitude, unlike range, which grows steadily with altitude.", "The chart-implied fuel flows run ~3% above the cruise charts' printed tables — the climb and descent allowances are baked into the curves.", "The 45-min reserve costs 0.56–0.78 hr depending on power — not a fixed 0.75 hr, because the reserve burns at 55% while the trip burns at the selected power."],
      }}
    />
  );
}
