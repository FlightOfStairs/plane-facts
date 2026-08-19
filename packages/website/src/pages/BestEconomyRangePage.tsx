import { Card, CardContent, Grid, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig527Meta, fig527Trace } from "../charts/fig527";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ModelNotes } from "../components/ModelNotes";
import { ResultsPanel } from "../components/ResultsPanel";
import { TraceCaption } from "../components/TraceCaption";
import { useUrlState } from "../lib/urlState";
import type { PowerPct, ReservePolicy } from "../model/rangeEndurance";
import { CHART_EXAMPLE_5_27, enduranceHr, impliedBlockTasKt, rangeNm } from "../model/rangeEndurance";

export const chartEntry = {
  id: "fig-5-27",
  label: "Range — best economy mixture (Fig 5-27)",
  Component: BestEconomyRangePage,
};

export function BestEconomyRangePage() {
  const [inputs, setInputs] = useUrlState<{ pressureAltFt: number; oatC: number; power: PowerPct; reserve: ReservePolicy }>({
    pressureAltFt: CHART_EXAMPLE_5_27.pressureAltFt,
    oatC: CHART_EXAMPLE_5_27.oatC,
    power: CHART_EXAMPLE_5_27.power,
    reserve: CHART_EXAMPLE_5_27.reserve,
  });
  const { pressureAltFt, oatC } = inputs;
  // Guard the discrete settings against arbitrary URL values.
  const power: PowerPct = inputs.power === 55 || inputs.power === 65 ? inputs.power : 75;
  const reserve: ReservePolicy = inputs.reserve === "noReserve" ? "noReserve" : "reserve45";

  const common = { mixture: "bestEconomy" as const, power, pressureAltFt, oatC };
  const reserveRes = rangeNm({ ...common, reserve: "reserve45" });
  const noReserveRes = rangeNm({ ...common, reserve: "noReserve" });
  const selected = reserve === "reserve45" ? reserveRes : noReserveRes;
  const endu = enduranceHr({ power, reserve, pressureAltFt });
  const blockTas = impliedBlockTasKt(selected.baseRangeNm, endu.enduranceHr);
  const { polylines, marker } = fig527Trace(pressureAltFt, reserveRes.baseRangeNm, noReserveRes.baseRangeNm, reserve);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Cruise pressure altitude" unit="ft" value={pressureAltFt} min={0} max={12000} step={100} onChange={(v) => setInputs({ pressureAltFt: v })} />
            <InputSlider label="Cruise OAT" unit="°C" value={oatC} min={-25} max={40} step={1} onChange={(v) => setInputs({ oatC: v })} />
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
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Fixed by the chart: 2300 lb mid-cruise weight, no wind, 48 gal usable fuel, wheel fairings (up to −7% without).
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Std temp @ altitude", value: `${selected.stdTempC.toFixed(1)} °C` },
                { label: "ISA deviation", value: `${selected.deltaIsaC >= 0 ? "+" : ""}${selected.deltaIsaC.toFixed(1)} °C` },
                { label: "Chart read (std temp)", value: `${selected.baseRangeNm.toFixed(0)} nm` },
                { label: "Temp correction (+0.7 / −1.1 nm per °C)", value: `${selected.tempCorrNm >= 0 ? "+" : ""}${selected.tempCorrNm.toFixed(1)} nm` },
                { label: "Range — 45-min reserve", value: `${reserveRes.rangeNm.toFixed(0)} nm`, emphasize: reserve === "reserve45" },
                { label: "Range — no reserve", value: `${noReserveRes.rangeNm.toFixed(0)} nm`, emphasize: reserve === "noReserve" },
                { label: "Implied avg block TAS (range ÷ endurance, std temp)", value: `${blockTas.toFixed(0)} kt` },
              ]}
              warnings={selected.warnings}
            />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Block TAS cross-check divides the std-temp chart read by the Fig 5-29 endurance (same power and reserve policy, also best economy mixture).
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig527Meta.title}
            </Typography>
            <ChartOverlay meta={fig527Meta} polylines={polylines} marker={marker} />
            <TraceCaption sections={["entry", "weight", "wind", "result"]} labels={["altitude entry", "45-min-reserve read", "no-reserve read", "result"]} />
          </CardContent>
        </Card>
        <ModelNotes form={["range = R₀ + slope·PA + ΔT corr        (per {reserve policy} × {55/65/75%} line)", "ΔT corr = +0.7 nm/°C above std, −1.1 nm/°C below", "Tstd = 15 − 1.9812·PA/1000"]} fit="Six straight lines fitted at 0.046% rms overall (worst curve 0.11%). The chart's printed example (5000 ft, 16 °C, 75% → 574.7 / 642.7 nm with/without reserve) reproduces at 575.2 / 642.2 nm (+0.09%)." findings={["The range axis carries two offset 50-nm scales on one lattice — the no-reserve family reads 100 nm lower than the reserve scale at the same grid position (150 nm on the best-power sibling); the POH's own dashed arrows land at both scale positions, confirming the calibration.", "The temperature correction is two-sided and asymmetric (+0.7 nm/°C above standard, −1.1 below) — slightly stronger in both directions than Fig 5-25's ±0.6/−1.0.", "Best economy delivers 13–16% more range than best power at equal nominal %power for only ~4 kt TAS — the BSFC drops from ≈0.50 to ≈0.425 lb/hp/hr.", "75% curves end near 10,000 ft (vs 9,000 on the best-power chart) — the two charts disagree by ~6% on the full-throttle ceiling.", "Reserve vs no-reserve deltas are only ~5% self-consistent across chart families (the 65% delta slightly exceeds its theoretical bound) — read each family absolutely."]} />
      </Grid>
    </Grid>
  );
}
