import { Alert, Box, Card, CardContent, FormControlLabel, Grid, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { fig615Meta, fig615Trace } from "../charts/fig615";
import { ChartOverlay } from "../components/ChartOverlay";
import { ModelNotes } from "../components/ModelNotes";
import { NumberUnitInput } from "../components/NumberUnitInput";
import { useUrlState } from "../lib/urlState";
import type { Unit } from "../model/units";
import { toPounds } from "../model/units";
import type { Category } from "../model/weightBalance";
import { FUEL_ALLOWANCE_ARM_IN, FUEL_ALLOWANCE_LB, LIMITS, MAX_USABLE_FUEL_USGAL, PLACEHOLDER_BEW_ARM_IN, PLACEHOLDER_BEW_LB, STATIONS, weightAndBalance } from "../model/weightBalance";

export const chartEntry = {
  id: "fig-6-15",
  label: "Weight & balance (Fig 6-15)",
  Component: WeightBalancePage,
};

const WEIGHT_UNITS = ["lb", "kg"] as const;
const FUEL_UNITS = ["usgal", "l", "lb", "kg"] as const;
const isUnit = (v: string): v is Unit => v === "lb" || v === "kg" || v === "usgal" || v === "l";
const unitOr = (v: string, fallback: Unit): Unit => (isUnit(v) ? v : fallback);

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const fmt = (n: number, dp = 0) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function WeightBalancePage() {
  const [s, set] = useUrlState({
    bewW: "",
    bewU: "lb",
    bewArm: "",
    frontW: "",
    frontU: "lb",
    rearW: "",
    rearU: "lb",
    fuelW: "",
    fuelU: "usgal",
    bagW: "",
    bagU: "lb",
    taxi: true,
  });

  const parse = (text: string, unit: Unit): number | null => {
    const n = num(text);
    return n === null ? null : toPounds(n, unit);
  };

  // Basic empty weight falls back to the POH sample figures when left blank,
  // so clearing a box restores the placeholder rather than blocking.
  const bewUnit = unitOr(s.bewU, "lb");
  const bewLb = parse(s.bewW, bewUnit) ?? PLACEHOLDER_BEW_LB;
  const bewArmIn = num(s.bewArm) ?? PLACEHOLDER_BEW_ARM_IN;
  const usingPlaceholderBew = num(s.bewW) === null || num(s.bewArm) === null;

  interface Row {
    key: string;
    label: string;
    text: string;
    unit: Unit;
    units: readonly Unit[];
    armIn: number;
    lb: number | null;
    placeholder?: string;
  }
  const rows: Row[] = [
    {
      key: "bew",
      label: "Basic empty weight",
      text: s.bewW,
      unit: bewUnit,
      units: WEIGHT_UNITS,
      armIn: bewArmIn,
      lb: bewLb,
      placeholder: String(PLACEHOLDER_BEW_LB),
    },
    { key: "front", label: "Pilot & front passenger", text: s.frontW, unit: unitOr(s.frontU, "lb"), units: WEIGHT_UNITS, armIn: STATIONS.frontSeats, lb: parse(s.frontW, unitOr(s.frontU, "lb")) },
    { key: "rear", label: "Rear passengers", text: s.rearW, unit: unitOr(s.rearU, "lb"), units: WEIGHT_UNITS, armIn: STATIONS.rearSeats, lb: parse(s.rearW, unitOr(s.rearU, "lb")) },
    { key: "fuel", label: "Fuel", text: s.fuelW, unit: unitOr(s.fuelU, "usgal"), units: FUEL_UNITS, armIn: STATIONS.fuel, lb: parse(s.fuelW, unitOr(s.fuelU, "usgal")) },
    { key: "bag", label: "Baggage", text: s.bagW, unit: unitOr(s.bagU, "lb"), units: WEIGHT_UNITS, armIn: STATIONS.baggage, lb: parse(s.bagW, unitOr(s.bagU, "lb")) },
  ];

  const missing = rows.filter((r) => r.lb === null).map((r) => r.label);
  const complete = missing.length === 0;
  const byKey = (k: string) => rows.find((r) => r.key === k)?.lb ?? 0;

  const forCategory = (category: Category) =>
    weightAndBalance({
      basicEmptyWeightLb: bewLb,
      basicEmptyArmIn: bewArmIn,
      frontSeatsLb: byKey("front"),
      rearSeatsLb: byKey("rear"),
      fuelLb: byKey("fuel"),
      baggageLb: byKey("bag"),
      category,
      includeTaxiAllowance: s.taxi,
    });

  const normal = complete ? forCategory("normal") : null;
  const utility = complete ? forCategory("utility") : null;
  const trace = normal ? fig615Trace(normal) : null;

  const fuelLb = rows.find((r) => r.key === "fuel")?.lb ?? null;
  const fuelGal = fuelLb === null ? null : fuelLb / toPounds(1, "usgal");
  const categories =
    normal && utility
      ? ([
          { name: "Normal", result: normal, maxLb: LIMITS.normal.maxTakeoffLb, severityWhenDenied: "error" },
          // Failing utility alone is only a caution; failing it when normal is
          // out too leaves the loading unflyable, so both go red.
          { name: "Utility", result: utility, maxLb: LIMITS.utility.maxTakeoffLb, severityWhenDenied: normal.withinLimits ? "warning" : "error" },
        ] as const)
      : [];

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loading
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              Arms are the POH stations (Fig 6-11); only the basic empty weight and its arm come from your aircraft.
            </Typography>

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 168, px: 1 }}>Item</TableCell>
                    <TableCell align="right" sx={{ px: 1 }}>
                      Arm (in)
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1 }}>
                      Moment (in-lb)
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell sx={{ py: 1.2, px: 1 }}>
                        <NumberUnitInput label={f.label} value={f.text} unit={f.unit} units={f.units} required={f.key !== "bew"} placeholder={f.placeholder} onChange={(value, unit) => set({ [`${f.key}W`]: value, [`${f.key}U`]: unit })} helperText={f.lb !== null && f.unit !== "lb" ? `${fmt(f.lb, 1)} lb` : undefined} />
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1 }}>
                        {f.key === "bew" ? (
                          // Only four characters ever go in here, so cap it —
                          // left free it stretches the whole Arm column.
                          <Box sx={{ width: 84, ml: "auto" }}>
                            <NumberUnitInput label="Arm" value={s.bewArm} unit="lb" placeholder={String(PLACEHOLDER_BEW_ARM_IN)} onChange={(value) => set({ bewArm: value })} />
                          </Box>
                        ) : (
                          f.armIn.toFixed(1)
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1 }}>
                        {f.lb === null ? "—" : fmt(f.lb * f.armIn)}
                      </TableCell>
                    </TableRow>
                  ))}

                  <TableRow>
                    <TableCell sx={{ px: 1 }}>
                      <FormControlLabel control={<Switch size="small" checked={s.taxi} onChange={(e) => set({ taxi: e.target.checked })} />} label={`Start, taxi & run-up allowance (−${Math.abs(FUEL_ALLOWANCE_LB)} lb at ${FUEL_ALLOWANCE_ARM_IN.toFixed(1)} in)`} slotProps={{ typography: { variant: "body2" } }} />
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1 }}>
                      {s.taxi ? FUEL_ALLOWANCE_ARM_IN.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1 }}>
                      {s.taxi ? fmt(FUEL_ALLOWANCE_LB * FUEL_ALLOWANCE_ARM_IN) : "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>

        {usingPlaceholderBew && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Basic empty weight is the POH sample figure ({PLACEHOLDER_BEW_LB} lb at {PLACEHOLDER_BEW_ARM_IN} in), not your aircraft. Enter the actual figures from its Weight and Balance Record before relying on any of this.
          </Alert>
        )}

        {normal && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Results
              </Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ px: 1 }} />
                      <TableCell align="right" sx={{ px: 1 }}>
                        Weight (lb)
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1 }}>
                        Balance (in aft of datum)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { label: "Ramp", p: normal.ramp },
                      { label: "Take-off", p: normal.takeoff, lead: true },
                      { label: "Zero fuel", p: normal.zeroFuel },
                    ].map(({ label, p, lead }) => (
                      <TableRow key={label}>
                        <TableCell sx={{ px: 1 }}>{lead ? <strong>{label}</strong> : label}</TableCell>
                        <TableCell align="right" sx={{ px: 1, color: p.overWeight ? "error.main" : undefined, fontWeight: lead || p.overWeight ? 600 : undefined }}>
                          {fmt(p.weightLb, 1)}
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1, color: p.withinEnvelope ? undefined : "error.main", fontWeight: lead || !p.withinEnvelope ? 600 : undefined }}>
                          {p.cgIn.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Reported per category, because failing utility is unremarkable — it
            forbids baggage and rear seats, so most real loads exceed it. Only
            normal is an error when it fails. */}
        {categories.map(({ name, result, maxLb, severityWhenDenied }) => (
          <Alert key={name} severity={result.withinLimits ? "success" : severityWhenDenied} sx={{ mt: 2 }}>
            <strong>
              {name} category — {result.withinLimits ? "permitted" : "not permitted"}
            </strong>
            <Box sx={{ mt: 0.25 }}>{result.withinLimits ? `C.G. ${result.takeoff.cgIn.toFixed(1)} in against limits ${result.takeoff.fwdLimitIn.toFixed(1)}–${result.takeoff.aftLimitIn.toFixed(1)} in at ${fmt(result.takeoff.weightLb, 1)} lb (max ${maxLb} lb)` : result.warnings.join("; ")}</Box>
          </Alert>
        ))}
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        {!complete && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter every item to get a result — missing: {missing.join(", ")}. Type 0 for anything you are not carrying, so nothing is left out by accident.
          </Alert>
        )}

        {fuelGal !== null && fuelGal > MAX_USABLE_FUEL_USGAL + 0.5 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {fuelGal.toFixed(1)} US gal exceeds the {MAX_USABLE_FUEL_USGAL} gal usable capacity.
          </Alert>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {fig615Meta.title}
            </Typography>
            <ChartOverlay meta={fig615Meta} polylines={trace?.polylines ?? []} markers={trace?.markers ?? []} />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              The line joins the take-off and zero-fuel points — the two ends of the C.G. travel as fuel burns off. Either dot turns red if that point is outside limits.
            </Typography>
          </CardContent>
        </Card>

        <ModelNotes form={["moment = weight x arm       (arms: front 80.5, rear 118.1, fuel 95.0, baggage 142.8 in)", "C.G.   = total moment / total weight", "take-off = ramp - 7 lb at 95.0 in      (start, taxi and run-up; optional — off leaves take-off = ramp)", "fwd limit = 83.0 in to 1950 lb, then straight-line to 88.3 in at 2440 lb (normal)", "                                    or to 83.8 in at 2020 lb (utility);  aft limit 93.0 in"]} fit="Arithmetic from quoted figures, so it reproduces the POH exactly rather than to a fitted tolerance: the printed sample problem (Fig 6-9) returns ramp 2447 lb at 90.6 in and take-off 2440 lb at 90.6 in, matching every printed moment. Limits are from POH 2.13 and 2.11; fuel uses SG 0.72 (6.009 lb/US gal), within 0.15% of the loading graph's 6 lb per gallon." />
      </Grid>
    </Grid>
  );
}
