import { Alert, Box, Card, CardContent, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { fig615Meta, fig615Trace } from "../charts/fig615";
import { ChartOverlay } from "../components/ChartOverlay";
import { ModelNotes } from "../components/ModelNotes";
import { NumberUnitInput } from "../components/NumberUnitInput";
import { useUrlState } from "../lib/urlState";
import type { Unit } from "../model/units";
import { toPounds } from "../model/units";
import type { Category } from "../model/weightBalance";
import { LIMITS, MAX_USABLE_FUEL_USGAL, PLACEHOLDER_BEW_ARM_IN, PLACEHOLDER_BEW_LB, STATIONS, weightAndBalance } from "../model/weightBalance";

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
    });

  const normal = complete ? forCategory("normal") : null;
  const utility = complete ? forCategory("utility") : null;
  const trace = normal ? fig615Trace(normal) : null;

  const fuelLb = rows.find((r) => r.key === "fuel")?.lb ?? null;
  const fuelGal = fuelLb === null ? null : fuelLb / toPounds(1, "usgal");
  const permittedNames = [
    { name: "normal", r: normal },
    { name: "utility", r: utility },
  ]
    .filter((c) => c.r?.withinLimits)
    .map((c) => c.name);

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
                      <TableCell align="right" sx={{ px: 1, minWidth: f.key === "bew" ? 104 : undefined }}>
                        {f.key === "bew" ? <NumberUnitInput label="Arm" value={s.bewArm} unit="lb" placeholder={String(PLACEHOLDER_BEW_ARM_IN)} onChange={(value) => set({ bewArm: value })} /> : f.armIn.toFixed(1)}
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1 }}>
                        {f.lb === null ? "—" : fmt(f.lb * f.armIn)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {normal && (
                    <>
                      <TableRow>
                        <TableCell sx={{ px: 1 }}>
                          <strong>Ramp</strong> — {fmt(normal.ramp.weightLb, 1)} lb
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          {normal.ramp.cgIn.toFixed(1)}
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          {fmt(normal.ramp.momentInLb)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ px: 1 }}>Start, taxi &amp; run-up allowance</TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          {STATIONS.fuel.toFixed(1)}
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          −665
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ px: 1 }}>
                          <strong>Take-off</strong> — {fmt(normal.takeoff.weightLb, 1)} lb
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          <strong>{normal.takeoff.cgIn.toFixed(1)}</strong>
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          {fmt(normal.takeoff.momentInLb)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ px: 1 }}>Zero fuel — {fmt(normal.zeroFuel.weightLb, 1)} lb</TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          {normal.zeroFuel.cgIn.toFixed(1)}
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1 }}>
                          {fmt(normal.zeroFuel.momentInLb)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        {!complete && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter every item to get a result — missing: {missing.join(", ")}. Type 0 for anything you are not carrying, so nothing is left out by accident.
          </Alert>
        )}

        {normal && utility && (
          <Alert severity={permittedNames.length > 0 ? "success" : "error"} sx={{ mb: 2 }}>
            <strong>{permittedNames.length === 0 ? "This loading is not permitted in either category." : `Permitted in the ${permittedNames.join(" and ")} categor${permittedNames.length > 1 ? "ies" : "y"}.`}</strong>
            <Box component="table" sx={{ mt: 1, borderSpacing: 0, "& td": { pr: 1.5, py: 0.25, verticalAlign: "top" } }}>
              <tbody>
                {[
                  { name: "Normal", r: normal, max: LIMITS.normal.maxTakeoffLb },
                  { name: "Utility", r: utility, max: LIMITS.utility.maxTakeoffLb },
                ].map(({ name, r, max }) => (
                  <tr key={name}>
                    <td>
                      <strong>{name}</strong>
                    </td>
                    <td>{r.withinLimits ? "permitted" : "not permitted"}</td>
                    <td>{r.withinLimits ? `C.G. ${r.takeoff.cgIn.toFixed(1)} in against limits ${r.takeoff.fwdLimitIn.toFixed(1)}–${r.takeoff.aftLimitIn.toFixed(1)} in at ${fmt(r.takeoff.weightLb, 1)} lb (max ${max} lb)` : r.warnings.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Alert>
        )}

        {usingPlaceholderBew && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Basic empty weight is the POH sample figure ({PLACEHOLDER_BEW_LB} lb at {PLACEHOLDER_BEW_ARM_IN} in), not your aircraft. Enter the actual figures from its Weight and Balance Record before relying on any of this.
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
              The hairlines are the Section 2.13 limits drawn over the POH&apos;s own figure — red for normal, blue dashed for the utility cap — as a check that the model lines up with the chart. They follow the printed cutout except at the very top, where 2.13 puts the forward limit at 88.3 in and the figure draws 88.0. The path steps through each load in turn; the dots are the take-off and zero-fuel points, red if outside.
            </Typography>
          </CardContent>
        </Card>

        <ModelNotes form={["moment = weight x arm       (arms: front 80.5, rear 118.1, fuel 95.0, baggage 142.8 in)", "C.G.   = total moment / total weight", "take-off = ramp - 7 lb at 95.0 in      (start, taxi and run-up)", "fwd limit = 83.0 in to 1950 lb, then straight-line to 88.3 in at 2440 lb (normal)", "                                    or to 83.8 in at 2020 lb (utility);  aft limit 93.0 in"]} fit="Arithmetic from quoted figures, so it reproduces the POH exactly rather than to a fitted tolerance: the printed sample problem (Fig 6-9) returns ramp 2447 lb at 90.6 in and take-off 2440 lb at 90.6 in, matching every printed moment. Limits are from POH 2.13 and 2.11; fuel uses SG 0.72 (6.009 lb/US gal), within 0.15% of the loading graph's 6 lb per gallon." />
      </Grid>
    </Grid>
  );
}
