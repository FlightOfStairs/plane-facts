import { useState } from "react";
import { Card, CardContent, Grid, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fig529Meta, fig529Trace } from "../charts/fig529";
import { ChartOverlay } from "../components/ChartOverlay";
import { InputSlider } from "../components/InputSlider";
import { ResultsPanel } from "../components/ResultsPanel";
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
  const [pressureAltFt, setPressureAltFt] = useState(CHART_EXAMPLE_5_29.pressureAltFt);
  const [power, setPower] = useState<PowerPct>(CHART_EXAMPLE_5_29.power);
  const [reserve, setReserve] = useState<ReservePolicy>(CHART_EXAMPLE_5_29.reserve);

  const reserveRes = enduranceHr({ power, reserve: "reserve45", pressureAltFt });
  const noReserveRes = enduranceHr({ power, reserve: "noReserve", pressureAltFt });
  const selected = reserve === "reserve45" ? reserveRes : noReserveRes;
  // Cross-check: Fig 5-27 range (same mixture, power, policy) at std temp ÷ endurance.
  const stdRange = rangeNm({ mixture: "bestEconomy", power, reserve, pressureAltFt, oatC: isaTempC(pressureAltFt) });
  const blockTas = impliedBlockTasKt(stdRange.baseRangeNm, selected.enduranceHr);
  const { polylines, marker } = fig529Trace(pressureAltFt, reserveRes.enduranceHr, noReserveRes.enduranceHr, reserve);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            <InputSlider label="Cruise pressure altitude" unit="ft" value={pressureAltFt} min={0} max={12000} step={100} onChange={setPressureAltFt} />
            <Typography variant="body2" gutterBottom>
              Cruise power (best economy mixture)
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
              Fixed by the chart: best economy mixture leaned per Section 4, 48 gal usable fuel. Includes time to climb and descend; no temperature axis is printed.
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
                { label: "Endurance — 45-min reserve", value: formatHours(reserveRes.enduranceHr), emphasize: reserve === "reserve45" },
                { label: "Endurance — no reserve", value: formatHours(noReserveRes.enduranceHr), emphasize: reserve === "noReserve" },
                { label: "Fig 5-27 range (std temp, same policy)", value: `${stdRange.baseRangeNm.toFixed(0)} nm` },
                { label: "Implied avg block TAS (range ÷ endurance)", value: `${blockTas.toFixed(0)} kt` },
              ]}
              warnings={selected.warnings}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig529Meta.title}
            </Typography>
            <ChartOverlay meta={fig529Meta} polylines={polylines} marker={marker} />
            <Typography variant="caption" color="text.secondary" component="p">
              Red trace is drawn from the model for illustration; the printed numbers above are the model outputs.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Chart quirks: the hours axis carries two offset 1-hr scales on one continuous lattice — the no-reserve family (drawn dashed in the original) reads 8 hr lower than the reserve scale at the same grid position. Endurance is nearly altitude-independent; the 75% reserve curve ends near 9,000 ft.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
