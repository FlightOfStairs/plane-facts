import { Card, CardContent, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

export const chartEntry = {
  id: "about",
  label: "About the models & method",
  Component: AboutModelsPage,
};

const Section = (props: { title: string; children: React.ReactNode }) => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        {props.title}
      </Typography>
      {props.children}
    </CardContent>
  </Card>
);

/**
 * The shared story behind every chart page: how the models were built, the
 * conventions they all follow, and the cross-chart findings. Per-chart pages
 * document only what is unique to their chart.
 */
export function AboutModelsPage() {
  return (
    <>
      <Section title="How these models were built">
        <Typography variant="body2" component="div">
          Every performance chart in Section 5 of the 1982 POH (Report VB-1180, Figs 5-3 … 5-37) was digitized from a 300-dpi scan: axes calibrated from the thick major gridlines (label text sits up to 40 px off its ticks), curves extracted by oriented morphological filtering, and a mathematical model least-squares fitted to the digitized points. Each model is validated against the worked example printed on its own chart — all reproduce it within ±3.4%, most within 1% — plus a few hundred digitized golden points in the test suite. The overlay traces are drawn <em>from the models</em> through the same calibration, so the red-to-green line you see is the model showing its work, never the source of the numbers.
        </Typography>
      </Section>

      <Section title="One atmosphere, four regimes">
        <Typography variant="body2" sx={{ mb: 1 }}>
          A single ISA implementation underlies everything, but the charts consume it in four distinct ways — respecting this is what makes the models fit:
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Charts</TableCell>
              <TableCell>Regime</TableCell>
              <TableCell>Why</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Takeoff (5-7 … 5-13)</TableCell>
              <TableCell>Anisotropic (PA, OAT) surface — only ~80–84 ft-PA per °C</TableCell>
              <TableCell>Carburetted full-rich power lapse (P ∝ δ/√θ) under-weights temperature vs any density-altitude model (~96)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Engine, climb, cruise (5-15 … 5-23)</TableCell>
              <TableCell>True density-altitude collapse (119–121 ft/°C ≈ textbook 118.8)</TableCell>
              <TableCell>Leaned performance is a clean function of DA</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Landing (5-35, 5-37)</TableCell>
              <TableCell>Pure σ power law (σ^−0.95 roll)</TableCell>
              <TableCell>Power off — touchdown-TAS² physics, no engine effects</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Glide (5-33); descent (5-31)</TableCell>
              <TableCell>None; inverted temperature sign</TableCell>
              <TableCell>IAS-schedule glide cancels density; descent encodes certification smoothing</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="Certification policy, common to all wind panels">
        <Typography variant="body2">
          Every wind panel (four takeoff/landing nomographs plus both landing charts) encodes the same AFM policy:
          <strong> credit 50% of reported headwind, penalize 150% of tailwind</strong>, applied as (1 ∓ credit·Vw/Vref)^m with m ≈ 1.4–2.1 depending on the reference speed. Net effect: roughly −2% per knot of headwind and +6–8% per knot of tailwind — the tailwind penalty is ~3× the headwind benefit everywhere.
        </Typography>
      </Section>

      <Section title="CAA safety factors (takeoff and landing pages)">
        <Typography variant="body2" component="div">
          The POH charts are drawn for a <em>paved, level, dry runway</em>, and they already model weight, pressure altitude, temperature and wind properly — so the rule-of-thumb rows in the CAA leaflet&apos;s &ldquo;performance changes&rdquo; table are not applied here. What the charts say nothing about is applied instead, from <Link href="https://www.caa.co.uk/data-and-publications/publications/documents/content/safety-sense-leaflet-09/" target="_blank" rel="noreferrer">
            CAA Safety Sense Leaflet 09
          </Link>:<ul>
            <li>Surface: dry grass ×1.2 takeoff / ×1.15 landing; wet grass ×1.3 / ×1.35; wet paved — / ×1.15; soft ground or snow ×1.25 / ×1.25.</li>
            <li>Slope: ×1.1 for the leaflet&apos;s single tabulated 2% step — uphill for takeoff, downhill for landing. It is a toggle, not a slider: neither the leaflet nor the POH gives a rule for intermediate gradients, so nothing is interpolated. No credit is taken for a favourable slope.</li>
            <li>General safety factor ×1.33 takeoff / ×1.43 landing, applied after the others.</li>
          </ul>
          Factors multiply together. Both numbers are shown on each page: the factored distance is the one to plan with, and the raw POH chart figure sits beneath it. The CAA advises against operating when the factored distance exceeds what is available.
        </Typography>
      </Section>

      <Section title="Cruise power between the printed settings">
        <Typography variant="body2" component="div">
          The POH draws curves at 55%, 65% and 75% only, but the power sliders are continuous. That is checked, not assumed: fitting a smooth law to the 55% and 75% curves <em>alone</em> reproduces the printed 65% curve to within 1.3 kt (≤1.25%) on cruise TAS and 1.0% on endurance — so interpolation informed by all three settings sits inside the charts&apos; own ~1 kt drafting tolerance. Values are exact at 55/65/75, and the sliders will not go below 55% because nothing is published there.
          <ul>
            <li>
              <strong>Above 75%</strong> the cruise charts still have an anchor: the drawn FULL THROTTLE boundary. Reading its power label two independent ways agrees to 0.1–0.7 points, putting full throttle at ~92% at sea level, ~85% at 4,000 ft, and back down to 75% by ~8,800 ft — so the region between the 75% curve and that boundary is charted, not invented. TAS is capped there and the page says so.
            </li>
            <li>The range and endurance charts have no such anchor and no fuel-flow figures above 75%, so values there are flagged as extrapolated.</li>
          </ul>
        </Typography>
      </Section>

      <Section title="Where the charts disagree with each other">
        <Typography variant="body2" component="div">
          Faithfully reproduced, not smoothed over:
          <ul>
            <li>Weight exponents differ by chart: takeoff roll W^1.85 (25° flap) vs W^2.34 (0° flap) — so the 0°-flap penalty shrinks with weight and the charts nominally cross near 2000 lb (drafting artifact); over-50-ft charts sit near W^2.0; landing is W^0.96 (textbook kinetic-energy physics).</li>
            <li>Speed strips use three different drafting rules: √W (5-11), linear in W (5-9, 5-13), quadratic (landing — anchored to stall and 1.3·Vs at max weight, deliberately high at light weight).</li>
            <li>The cruise charts&apos; full-throttle boundary is 2–3 points more optimistic aloft than the engine chart&apos;s Gagg–Ferrar-like lapse (they agree near 7000 ft DA).</li>
            <li>Reserve vs no-reserve range/endurance families are internally consistent only to ~5% — the models use each family absolutely rather than composing differences across them.</li>
          </ul>
          Consistency checks that <em>pass</em>: three independent chart families agree on an absolute ceiling of DA ≈ 13,000 ft; the climb-integral chart matches ∫dh/ROC of the climb chart to ~3% in its intended difference mode; glide slope (L/D 11.45) anchors a drag polar consistent with cruise speed scaling.
        </Typography>
      </Section>

      <Section title="Errata found in the POH itself">
        <Typography variant="body2" component="div">
          <ul>
            <li>Fig 5-35&apos;s &ldquo;REF. LINE — 2400 LBS.&rdquo; label is a misprint: the line&apos;s geometry sits at 2440 lb, the anchor all four takeoff/landing nomographs share.</li>
            <li>Fig 5-9&apos;s wind panel draws eight guide lines, one per starting distance, each showing how much a headwind shortens the takeoff. The lowest — anchored at 500 ft — is drawn parallel to the line above it instead of shallower, so it subtracts the same 210 ft despite starting from half the distance: a 40% cut at 15 kt where its seven neighbours cut ~20%. Reproducing it would need a 50-ft barrier speed near 25 kt, against a real 44–57 KIAS, so it is treated as a drawing slip and excluded from the fit.</li>
            <li>Several charts draw unlabeled curves beyond their labels (7000 ft on 5-9; 15–16,000 ft on 5-15/5-17; 11–12,000 ft on 5-31) — identified via their standard-temperature-line crossings.</li>
            <li>Some printed worked examples are imperfect against their own charts (5-21 ~1 kt off its curves; 5-9 prints 1–2.5% above its guides; 5-31&apos;s fuel answer is a 0.5-gal rounding).</li>
          </ul>
        </Typography>
      </Section>

      <Typography variant="body2" color="text.secondary">
        Full consolidation notes live in the repo: <Link href="https://github.com/FlightOfStairs/plane-facts/blob/main/docs/FINDINGS.md">docs/FINDINGS.md</Link>; the digitization pipeline and per-chart fits are under <code>tools/digitize/</code>.
      </Typography>
    </>
  );
}
