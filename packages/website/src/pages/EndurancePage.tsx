import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig529Meta, fig529Trace } from "../charts/fig529";
import { ChartPageLayout } from "../components/ChartPageLayout";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import { isaTempC } from "../model/atmosphere";
import type { PowerPct, ReservePolicy } from "../model/rangeEndurance";
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

export function EndurancePage() {
  const [inputs, setInputs] = useUrlState<{ pressureAltFt: number; power: PowerPct; reserve: ReservePolicy }>({
    pressureAltFt: CHART_EXAMPLE_5_29.pressureAltFt,
    power: CHART_EXAMPLE_5_29.power,
    reserve: CHART_EXAMPLE_5_29.reserve,
  });
  const { pressureAltFt } = inputs;
  // Guard the discrete settings against arbitrary URL values.
  const power: PowerPct = inputs.power === 55 || inputs.power === 65 ? inputs.power : 75;
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
          <InputSlider label="Cruise pressure altitude" unit="ft" value={pressureAltFt} min={0} max={12000} step={100} onChange={(v) => setInputs({ pressureAltFt: v })} />
          <Typography variant="body2" gutterBottom>
            Cruise power (best economy mixture)
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={power} onChange={(_, v: PowerPct | null) => v !== null && setInputs({ power: v })} sx={{ mb: 2 }}>
            <ToggleButton value={55}>55%</ToggleButton>
            <ToggleButton value={65}>65%</ToggleButton>
            <ToggleButton value={75}>75%</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" gutterBottom>
            Reserve policy
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={reserve} onChange={(_, v: ReservePolicy | null) => v !== null && setInputs({ reserve: v })}>
            <ToggleButton value="reserve45">45 min @ 55%</ToggleButton>
            <ToggleButton value="noReserve">No reserve</ToggleButton>
          </ToggleButtonGroup>
        </>
      }
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
