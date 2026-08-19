import { fig523Meta, fig523Trace } from "../charts/fig523";
import { CruisePageBase } from "./CruisePageBase";

export const chartEntry = {
  id: "fig-5-23",
  label: "Cruise — best economy (Fig 5-23)",
  Component: BestEconomyCruisePage,
};

export function BestEconomyCruisePage() {
  return (
    <CruisePageBase
      mixture="bestEconomy"
      meta={fig523Meta}
      trace={fig523Trace}
      notes={{
        form: ["u = DA/2000 = c₀ + c₁·PA + c₂·OAT + c₃·PA·OAT + c₄·PA² + c₅·OAT²", "TAS = q_p(u)                 (quadratic per 55/65/75% curve)", "TAS ≤ TAS_FT(u)              (cubic full-throttle boundary, drawn DA ≈ 9300–12,000 only)", "fuel = 6.6 / 7.5 / 8.5 GPH at 55/65/75%   (printed table)", "−7 kt without wheel fairings"],
        fit: "Curve fits at 0.22% rms (≤0.12 kt per curve). The chart's printed example (5000 ft, 16 °C, 75% → 118 KTAS) reproduces at 118.1 KTAS (+0.05%).",
        findings: ["The full-throttle boundary is drawn only between DA ≈ 9300 and ≈12,000 ft — the model never extrapolates it lower, where the cubic would falsely cap the %power curves.", "Best economy gives up ~4 kt vs best power at equal nominal %power for ~15% less fuel: the tables imply BSFC ≈ 0.425 lb/hp/hr here vs 0.50 on Fig 5-21, both constant across 55–75%.", "The two cruise charts disagree by ~6% on where full throttle can still hold 65% (DA 12,767 vs 11,913) — yet both bracket the climb chart's DA ≈ 13,200 absolute-ceiling picture.", "Like its sibling, the PA/OAT lattice is an exact density-altitude collapse (~119–121 ft-PA/°C ≈ textbook 118.8), unlike the takeoff family's 80–84 ft/°C anisotropy."],
      }}
    />
  );
}
