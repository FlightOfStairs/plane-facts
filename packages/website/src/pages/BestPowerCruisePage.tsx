import { fig521Meta, fig521Trace } from "../charts/fig521";
import { CruisePageBase } from "./CruisePageBase";

export const chartEntry = {
  id: "fig-5-21",
  label: "Cruise — best power (Fig 5-21)",
  Component: BestPowerCruisePage,
};

export function BestPowerCruisePage() {
  return (
    <CruisePageBase
      mixture="bestPower"
      meta={fig521Meta}
      trace={fig521Trace}
      notes={{
        form: ["u = DA/2000 = c₀ + c₁·PA + c₂·OAT + c₃·PA·OAT + c₄·PA² + c₅·OAT²", "TAS = q_p(u)                 (quadratic per 55/65/75% curve)", "TAS ≤ TAS_FT(u)              (cubic full-throttle boundary)", "fuel = 7.8 / 8.8 / 10.0 GPH at 55/65/75%   (printed table)", "−7 kt without wheel fairings"],
        fit: "Curve fits at 0.22% rms (≤0.15 kt per curve). The chart's printed example (5000 ft, 16 °C, 75% → 122.5 KTAS) reproduces at 121.9 KTAS (−0.5%) — the POH's own dashed trace sits ~1 kt above its drawn curves, and the model follows the curves.",
        findings: ["The PA/OAT lattice is a true density-altitude collapse: temperature weight ≈119–121 ft-PA/°C ≈ the textbook 118.8 — unlike the takeoff charts' anisotropic 80–84 ft/°C (leaned cruise power really is a clean function of DA).", "TAS at fixed %power scales as σ^−0.31 ≈ ρV³ = const — parasite-drag-dominated cruise, consistent with a parabolic polar at cruise CL.", "The full-throttle boundary agrees with the engine chart (Fig 5-15) Gagg–Ferrar-like lapse near σ≈0.8, but runs 2–3 points more optimistic aloft: the 75% ceiling is drawn at DA ≈ 8800–9100 vs the engine chart's ~8000 (possible leaning credit).", "Guide lines above 14,000 ft are drawn but unlabeled in the original; identities were resolved via the STD TEMP diagonal's crossings.", "The printed fuel table implies a constant BSFC ≈ 0.50 lb/hp/hr across 55–75% at best power (0.425 on the best-economy sibling)."],
      }}
    />
  );
}
