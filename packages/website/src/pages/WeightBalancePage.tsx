import { Alert, Box, Card, CardContent, Grid, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
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
    bewW: String(PLACEHOLDER_BEW_LB),
    bewU: "lb",
    bewArm: String(PLACEHOLDER_BEW_ARM_IN),
    frontW: "",
    frontU: "lb",
    rearW: "",
    rearU: "lb",
    fuelW: "",
    fuelU: "usgal",
    bagW: "",
    bagU: "lb",
    cat: "normal",
  });

  const category: Category = s.cat === "utility" ? "utility" : "normal";
  const parse = (text: string, unit: Unit): number | null => {
    const n = num(text);
    return n === null ? null : toPounds(n, unit);
  };
  const bewArmIn = num(s.bewArm);

  interface Row {
    key: string;
    label: string;
    text: string;
    unit: Unit;
    units: readonly Unit[];
    armIn: number | null;
    lb: number | null;
  }
  const rows: Row[] = [
    { key: "bew", label: "Basic empty weight", text: s.bewW, unit: unitOr(s.bewU, "lb"), units: WEIGHT_UNITS, armIn: bewArmIn, lb: parse(s.bewW, unitOr(s.bewU, "lb")) },
    { key: "front", label: "Pilot & front passenger", text: s.frontW, unit: unitOr(s.frontU, "lb"), units: WEIGHT_UNITS, armIn: STATIONS.frontSeats, lb: parse(s.frontW, unitOr(s.frontU, "lb")) },
    { key: "rear", label: "Rear passengers", text: s.rearW, unit: unitOr(s.rearU, "lb"), units: WEIGHT_UNITS, armIn: STATIONS.rearSeats, lb: parse(s.rearW, unitOr(s.rearU, "lb")) },
    { key: "fuel", label: "Fuel", text: s.fuelW, unit: unitOr(s.fuelU, "usgal"), units: FUEL_UNITS, armIn: STATIONS.fuel, lb: parse(s.fuelW, unitOr(s.fuelU, "usgal")) },
    { key: "bag", label: "Baggage", text: s.bagW, unit: unitOr(s.bagU, "lb"), units: WEIGHT_UNITS, armIn: STATIONS.baggage, lb: parse(s.bagW, unitOr(s.bagU, "lb")) },
  ];

  const missing: string[] = rows.filter((r) => r.lb === null).map((r) => r.label);
  if (bewArmIn === null) missing.push("Basic empty weight arm");
  const complete = missing.length === 0;
  const byKey = (k: string) => rows.find((r) => r.key === k)?.lb ?? 0;

  const result = complete
    ? weightAndBalance({
        basicEmptyWeightLb: byKey("bew"),
        basicEmptyArmIn: bewArmIn ?? 0,
        frontSeatsLb: byKey("front"),
        rearSeatsLb: byKey("rear"),
        fuelLb: byKey("fuel"),
        baggageLb: byKey("bag"),
        category,
      })
    : null;

  const bewLb = rows[0]?.lb ?? null;
  const usingPlaceholderBew = bewLb !== null && Math.abs(bewLb - PLACEHOLDER_BEW_LB) < 0.5 && bewArmIn !== null && Math.abs(bewArmIn - PLACEHOLDER_BEW_ARM_IN) < 0.05;

  const trace = result ? fig615Trace(result, category) : null;
  const fuelLb = rows.find((r) => r.key === "fuel")?.lb ?? null;
  const fuelGal = fuelLb === null ? null : fuelLb / toPounds(1, "usgal");

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

            <ToggleButtonGroup exclusive size="small" value={category} onChange={(_, v: string | null) => v && set({ cat: v })} sx={{ mb: 2 }}>
              <ToggleButton value="normal">Normal</ToggleButton>
              <ToggleButton value="utility">Utility</ToggleButton>
            </ToggleButtonGroup>

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
                  {rows.map((f) => {
                    const w = f.lb;
                    const arm = f.armIn;
                    return (
                      <TableRow key={f.key}>
                        <TableCell sx={{ py: 1.2, px: 1 }}>
                          <NumberUnitInput label={f.label} value={f.text} unit={f.unit} units={f.units} required onChange={(value, unit) => set({ [`${f.key}W`]: value, [`${f.key}U`]: unit })} helperText={w !== null && f.unit !== "lb" ? `${fmt(w, 1)} lb` : undefined} />
                          {f.key === "bew" && <NumberUnitInput label="Arm" value={s.bewArm} unit="lb" required onChange={(value) => set({ bewArm: value })} helperText="inches aft of datum" />}
                        </TableCell>
                        <TableCell align="right">{arm === null ? "—" : arm.toFixed(1)}</TableCell>
                        <TableCell align="right">{w === null || arm === null ? "—" : fmt(w * arm)}</TableCell>
                      </TableRow>
                    );
                  })}

                  {result && (
                    <>
                      <TableRow>
                        <TableCell>
                          <strong>Ramp</strong> (max {LIMITS[category].maxRampLb} lb)
                        </TableCell>
                        <TableCell align="right">{result.ramp.cgIn.toFixed(1)}</TableCell>
                        <TableCell align="right">{fmt(result.ramp.momentInLb)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Start, taxi &amp; run-up allowance</TableCell>
                        <TableCell align="right">{STATIONS.fuel.toFixed(1)}</TableCell>
                        <TableCell align="right">−665</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>Take-off</strong> (max {LIMITS[category].maxTakeoffLb} lb)
                        </TableCell>
                        <TableCell align="right">
                          <strong>{result.takeoff.cgIn.toFixed(1)}</strong>
                        </TableCell>
                        <TableCell align="right">{fmt(result.takeoff.momentInLb)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Zero fuel</TableCell>
                        <TableCell align="right">{result.zeroFuel.cgIn.toFixed(1)}</TableCell>
                        <TableCell align="right">{fmt(result.zeroFuel.momentInLb)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </Box>

            {result && (
              <Box sx={{ overflowX: "auto", mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Check</TableCell>
                      <TableCell align="right">Weight (lb)</TableCell>
                      <TableCell align="right">C.G. (in)</TableCell>
                      <TableCell align="right">Limits at that weight</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { label: "Take-off", pt: result.takeoff },
                      { label: "Zero fuel", pt: result.zeroFuel },
                    ].map(({ label, pt }) => {
                      return (
                        <TableRow key={label}>
                          <TableCell>{label}</TableCell>
                          <TableCell align="right" sx={{ color: pt.overWeight ? "error.main" : undefined, fontWeight: pt.overWeight ? 600 : undefined }}>
                            {fmt(pt.weightLb, 1)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: pt.withinEnvelope ? undefined : "error.main", fontWeight: 600 }}>
                            {pt.cgIn.toFixed(1)}
                          </TableCell>
                          <TableCell align="right">
                            {pt.fwdLimitIn.toFixed(1)} – {pt.aftLimitIn.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        {result && (
          <Alert severity={result.withinLimits ? "success" : "error"} sx={{ mb: 2 }}>
            <strong>{result.withinLimits ? "Within weight and balance limits." : "OUTSIDE LIMITS — do not fly this loading."}</strong>
            {result.warnings.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        {!complete && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter every item to get a result — missing: {missing.join(", ")}. Type 0 for anything you are not carrying, so nothing is left out by accident.
          </Alert>
        )}
        {usingPlaceholderBew && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Basic empty weight is still the POH sample figure ({PLACEHOLDER_BEW_LB} lb at {PLACEHOLDER_BEW_ARM_IN} in). Replace it with your aircraft&apos;s actual weighing data from its Weight and Balance Record before relying on any of this.
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
              The heavy outline is the Section 2.13 envelope drawn from the limits, over the POH&apos;s own figure. The path steps through each load in turn; the two dots are the take-off and zero-fuel points, red if outside.
            </Typography>
          </CardContent>
        </Card>

        <ModelNotes form={["moment = weight x arm            (arms: front 80.5, rear 118.1, fuel 95.0, baggage 142.8 in)", "C.G.   = total moment / total weight", "take-off = ramp - 7 lb at 95.0 in   (start, taxi and run-up)", "fwd limit = 83.0 in to 1950 lb, then straight-line to 88.3 in at 2440 lb"]} fit={`Arithmetic from quoted figures, so it reproduces the POH exactly rather than to a fitted tolerance: the printed sample problem (Fig 6-9) returns ramp 2447 lb at 90.6 in and take-off 2440 lb at 90.6 in, matching every printed moment. Fuel uses SG 0.72 (6.009 lb/US gal), within 0.15% of the loading graph's "6 lb. to gal".`} findings={["The chart's horizontal axis is not C.G. despite its caption — the C.G. scale stretches with weight (60 px/in at 1400 lb, 108 at 2440) because the abscissa encodes moment about an 88-inch reference. That is why constant-C.G. lines are only vertical at 88.", "The forward limit is a cutout, not a constant: 83.0 in up to 1950 lb, rising to 88.3 in at max gross. A load can sit well aft of 83 and still be illegally nose-heavy, which is why the limits at the actual weight are shown alongside the C.G.", "The cutout starts at 1950 lb, which is not where the utility ceiling sits (2020 lb) — the two are unrelated limits that happen to be near each other.", "The printed envelope reaches only C.G. 87.93 at max gross where 2.13 tabulates 88.3, so the drawing is about 0.35 in more permissive than the table. The table governs here; the drawn outline also bows by up to 0.16 in from a straight line.", "Zero fuel is plotted as well as take-off: the fuel station at 95.0 in is aft of a typical loaded C.G., so burning it off walks the C.G. forward, toward the limit that is itself rising with weight."]} />
      </Grid>
    </Grid>
  );
}
