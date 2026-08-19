import { useState } from "react";
import { Card, CardContent, Grid, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig525Meta, fig525Trace } from "../charts/fig525";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
import type { PowerPct, ReservePolicy } from "../model/rangeEndurance";
import { CHART_EXAMPLE_5_25, enduranceHr, impliedBlockTasKt, rangeNm } from "../model/rangeEndurance";

export const chartEntry = {
  id: "fig-5-25",
  label: "Range — best power mixture (Fig 5-25)",
  Component: BestPowerRangePage,
};

export function BestPowerRangePage() {
  const [pressureAltFt, setPressureAltFt] = useState(CHART_EXAMPLE_5_25.pressureAltFt);
  const [oatC, setOatC] = useState(CHART_EXAMPLE_5_25.oatC);
  const [power, setPower] = useState<PowerPct>(CHART_EXAMPLE_5_25.power);
  const [reserve, setReserve] = useState<ReservePolicy>(CHART_EXAMPLE_5_25.reserve);

  const common = { mixture: "bestPower" as const, power, pressureAltFt, oatC };
  const reserveRes = rangeNm({ ...common, reserve: "reserve45" });
  const noReserveRes = rangeNm({ ...common, reserve: "noReserve" });
  const selected = reserve === "reserve45" ? reserveRes : noReserveRes;
  const endu = enduranceHr({ power, reserve, pressureAltFt });
  const blockTas = impliedBlockTasKt(selected.baseRangeNm, endu.enduranceHr);
  const { polylines, marker } = fig525Trace(pressureAltFt, reserveRes.baseRangeNm, noReserveRes.baseRangeNm, reserve);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Cruise pressure altitude" unit="ft" value={pressureAltFt} min={0} max={12000} step={100} onChange={setPressureAltFt} />
            <InputSlider label="Cruise OAT" unit="°C" value={oatC} min={-25} max={40} step={1} onChange={setOatC} />
            <Typography variant="body2" gutterBottom>
              Cruise power (best power mixture)
            </Typography>
            <ToggleButtonGroup exclusive size="small" value={power} onChange={(_, v: PowerPct | null) => v !== null && setPower(v)} sx={{ mb: 2 }}>
              <ToggleButton value={55}>55%</ToggleButton>
              <ToggleButton value={65}>65%</ToggleButton>
              <ToggleButton value={75}>75%</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" gutterBottom>
              Reserve policy
            </Typography>
            <ToggleButtonGroup exclusive size="small" value={reserve} onChange={(_, v: ReservePolicy | null) => v !== null && setReserve(v)}>
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
                { label: "Temp correction (+0.6 / −1.0 nm per °C)", value: `${selected.tempCorrNm >= 0 ? "+" : ""}${selected.tempCorrNm.toFixed(1)} nm` },
                { label: "Range — 45-min reserve", value: `${reserveRes.rangeNm.toFixed(0)} nm`, emphasize: reserve === "reserve45" },
                { label: "Range — no reserve", value: `${noReserveRes.rangeNm.toFixed(0)} nm`, emphasize: reserve === "noReserve" },
                { label: "Implied avg block TAS (range ÷ endurance, std temp)", value: `${blockTas.toFixed(0)} kt` },
              ]}
              warnings={selected.warnings}
            />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Block TAS cross-check uses the Fig 5-29 endurance chart, which assumes best economy mixture — treat it as approximate here.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig525Meta.title}
            </Typography>
            <ChartOverlay meta={fig525Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary" component="p">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs. Drops mark the std-temperature curve reads — the temperature correction is arithmetic, per the chart's note.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Chart quirks: the range axis carries two offset 50-nm scales on one lattice — the no-reserve family reads 150 nm lower than the reserve scale at the same grid position. The temperature correction is two-sided (+0.6 nm/°C above standard, −1.0 below). 75% curves end near 9,000 ft (full-throttle limit).
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
