import { Card, CardContent, FormControlLabel, Link, MenuItem, Select, Switch, Typography } from "@mui/material";
import type { SafetyFactorsState } from "../lib/useSafetyFactors";

import { GENERAL_FACTOR, SURFACES, SURFACE_ORDER } from "../model/caaSafetyFactors";
import { InputSlider } from "./InputSlider";

const LEAFLET_URL = "https://www.caa.co.uk/data-and-publications/publications/documents/content/safety-sense-leaflet-07/";

/**
 * CAA Safety Sense factors for the conditions the POH charts don't cover:
 * runway surface, slope, and the general safety factor.
 */
export function SafetyFactorPanel(props: { safety: SafetyFactorsState }) {
  const { op, inputs, set, result } = props.safety;
  const takeoff = op === "takeoff";

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          CAA safety factors
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Weight, altitude, temperature and wind are already modelled by the POH chart, so only the factors it does not cover are applied here — see <Link href={LEAFLET_URL} target="_blank" rel="noreferrer">
            CAA Safety Sense Leaflet 07
          </Link>.
        </Typography>

        <Typography variant="body2" gutterBottom>
          Runway surface
        </Typography>
        <Select size="small" fullWidth value={inputs.surface} onChange={(e) => set({ surface: e.target.value })} sx={{ mb: 2 }}>
          {SURFACE_ORDER.map((key) => {
            const factor = takeoff ? SURFACES[key].takeoff : SURFACES[key].landing;
            return (
              <MenuItem key={key} value={key}>
                {SURFACES[key].label}
                {factor === 1 ? "" : ` — ×${factor}`}
              </MenuItem>
            );
          })}
        </Select>

        <InputSlider label={`Runway slope (+up / −down, ${takeoff ? "departure" : "landing"} direction)`} unit="%" value={inputs.slopePct} min={-4} max={4} step={0.5} onChange={(v) => set({ slopePct: v })} />

        <FormControlLabel control={<Switch checked={inputs.generalFactor} onChange={(e) => set({ generalFactor: e.target.checked })} />} label={<Typography variant="body2">General safety factor (×{GENERAL_FACTOR[op]})</Typography>} />

        <Typography variant="body2" sx={{ mt: 1 }}>
          Combined factor: <strong>×{result.total.toFixed(2)}</strong>
        </Typography>
        {result.terms.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {result.terms.map((t) => `${t.label} ×${t.factor.toFixed(2)}`).join(" · ")}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
