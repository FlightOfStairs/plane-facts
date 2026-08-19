# PA-28-161 POH chart models — cross-chart consolidation

All 17 performance charts of POH VB-1180 Section 5 digitized from the 300-dpi
scan and fitted (Figs 5-3 … 5-37; Fig 5-1 is pure °F↔°C arithmetic). Every
model reproduces its chart's printed worked example within ±3.4% (most ≤1%);
fit residuals vs the digitized curves are 0.05–1.6% rms. Machine-readable fits:
`tools/digitize/out/fits/fig_5_NN.json`; drivers: `tools/digitize/charts/`.

## The one atmosphere, four ways

A single ISA implementation (δ=(1−6.87559e-6·PA)^5.2559, θ=(OAT+273.15)/288.15,
σ=δ/θ, DA=145442·(1−σ^(1/4.2559)), lapse 1.9812 °C/1000 ft) underlies every
chart — but the charts _consume_ it in four distinct regimes:

| Regime                         | Charts                                       | Temperature weight (ft-PA per °C)                     | Interpretation                                                                                                |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Anisotropic (PA, OAT) surface  | 5-7, 5-9, 5-11, 5-13 (takeoff)               | **80–84** — well below the ~96 any f(DA) forces       | Carburetted full-rich power lapse P ∝ δ/√θ under-weights temperature                                          |
| True density-altitude collapse | 5-15, 5-17, 5-21, 5-23 (engine/climb/cruise) | **119–121** ≈ textbook 118.8                          | Leaned cruise/climb performance is a clean function of DA (Piper's std-temp lines use a 2.0 °C/1000 ft lapse) |
| Pure σ power law               | 5-35, 5-37 (landing)                         | σ^−0.95 (roll), σ^−0.73 (over 50 ft)                  | Power off → no engine anisotropy; touchdown-TAS² physics                                                      |
| No atmosphere at all           | 5-33 (glide), 5-3/5-5 (speeds)               | —                                                     | IAS-schedule glide: TAS and sink scale together, range = alt × L/D                                            |
| Inverted sign                  | 5-31 (descent)                               | **−57 at 5000 ft** (warm ⇒ _less_ time/fuel/distance) | Certification-policy smoothing, not density physics                                                           |

5-11's celebrated anisotropy (CLAUDE.md) is therefore a _takeoff-family_ trait,
confirmed independently on 5-7 (84 ft/°C), not a POH-wide convention.

## Weight exponents are NOT universal (biggest inconsistency found)

S ∝ (W/2440)^k, each confirmed by its own chart's dashed worked-example trace:

| Chart                        | k                                                        |
| ---------------------------- | -------------------------------------------------------- |
| 5-11 takeoff roll, 25° flap  | **1.85** (constant, clean)                               |
| 5-7 takeoff roll, 0° flap    | **2.34** (2.27–2.41)                                     |
| 5-9 takeoff over 50 ft, 0°   | **2.0→2.7** (grows toward light weight; not a power law) |
| 5-13 takeoff over 50 ft, 25° | **2.02**                                                 |
| 5-35 landing over 50 ft      | **0.96**                                                 |
| 5-37 landing roll            | **0.96**                                                 |

Landing k≈1 is textbook (KE ∝ W·Vs² ∝ W², braking force ∝ W ⇒ S ∝ W).
Takeoff k varies by 0.5 between flap settings — real chart content, not
digitization error. Consequence: the 0-flap distance penalty (~+10% at 2440 lb)
shrinks with weight and the two ground-roll charts nominally cross near
2000 lb — a drafting artifact to warn about in the UI, not physics.

## Wind credits: one certification policy everywhere

All six wind panels encode the same AFM policy: **credit 50% of headwind,
150% of tailwind**, applied as f = (1 ∓ credit·Vw/Vref)^m:

| Chart | Vref           | m (headwind)                                  | m (tailwind)              |
| ----- | -------------- | --------------------------------------------- | ------------------------- |
| 5-11  | V_LOF 52 (TAS) | 1.55                                          | 1.55                      |
| 5-7   | V_TAS          | ~1.69 (f15=0.775)                             | ~1.4                      |
| 5-9   | 57 KIAS        | 1.44−0.23·ln(D/2500)                          | 1.62−0.56·ln(D/2500)      |
| 5-13  | 52 KIAS        | 1.49 (TAS-refit: 1.55 — matches 5-11 exactly) | ~1.4 (weakly constrained) |
| 5-35  | 45 KIAS        | 1.47                                          | 1.70                      |
| 5-37  | 45 KIAS        | 1.90                                          | 2.08                      |

5-37's larger m is the same physics seen from a lower reference speed: rescaled
to the 65-KIAS approach speed it matches 5-35. Ground roll ≈ −2%/kt headwind,
+6–8%/kt tailwind; the tailwind penalty is ~3× the headwind benefit everywhere.

## Speed strips: three different drafting conventions

- 5-11: V_LOF = 52·√(W/2440) exactly.
- 5-7: √W shape but printed labels run 1–1.5 kt low at light weight (0-flap
  IAS position error baked in). 0-flap V_LOF@2440 = 52 — _identical_ to
  25-flap, which is aerodynamically suspect (publication artifact).
- 5-9, 5-13: strips are **linear in W** (V_LOF = 17.9+0.0139·W;
  V_50 = 19.3+0.0154·W; barrier = 1.10×lift-off), extending past the 1700-lb
  axis to a ~1600-lb position at the no-wind ref line.
- 5-35/5-37: quadratic in W; at 2440 lb they anchor exactly to physics:
  touchdown 45 KIAS = flaps-40 stall IAS (Fig 5-5: 44.1–45.2), approach
  65 KIAS = 1.3×Vs0_CAS converted CAS→IAS via Fig 5-3 (64.7). At lighter
  weights printed values sit deliberately above both rules (conservative floor).

Anchors from 5-5: Vs0 flaps-0 = 50.4 KIAS / 56.1 KCAS; flaps-40 = 44.1 / 50.1.
Bank scaling is _exactly_ load-factor physics: V ∝ cos(φ)^−0.499 (rms 0.21 kt).
5-11's V_LOF 52 KCAS = 1.036 × Vs_CAS(flaps 40) — a thin margin over stall.

## Engine model (5-15) and its agreement with cruise (5-21/5-23)

- Partial-throttle: RPM = a_p + 0.02306·DA with a_55/65/75 = 2196.6/2336.8/2480.3
  (rms 1.4 RPM) ≈ 2751·(p/100)^0.370·σ_DA^−0.306 — the fixed-pitch prop cube
  law N ∝ (P/σ)^⅓, slightly softened. Extrapolates to 2751 RPM at 100%/SL —
  above the 2700 redline: rated power is not reachable static, as expected.
- Full-throttle ceiling: the 75% curve ends at DA 8008 where
  (N/2700)·δ/√θ = 0.754 — a 0.5% match to the Gagg–Ferrar-like lapse.
- Cruise charts independently imply the same lapse near σ≈0.8 (78.8% at DA
  7000 vs GF 78.6%) but run **shallower (more optimistic) aloft**: 75% ceiling
  drawn at DA 8825–9078 vs GF's ~7550; +2.7 pt at DA 12000. Possible leaning
  credit; the two charts disagree by ~6% on the 65% ceiling.
- Fuel flows (both tables + endurance-implied): best power 7.8/8.8/10.0 GPH at
  55/65/75%, best economy 6.6/7.5/8.5 → BSFC ≈ 0.50 / 0.425 lb/hp/hr constant
  across power. Endurance-chart-implied flows run ~3% higher (climb/descent
  allowances baked in).

## Ceiling consistency (three independent charts agree)

ROC = 645.8 − 0.048888·DA (5-17) ⇒ ROC = 0 at **DA ≈ 13,200 ft** (2440 lb).
Cruise 65% full-throttle intersections: DA 12,767/11,913. Range/endurance
curves terminate 11,800–13,000. Climb chart drawn to 25 fpm at DA ~12,700.
A coherent absolute-ceiling picture across four independently drafted charts.

## Bootstrap drag polar

Glide (5-33): dead straight (0.17% rms), **L/D 11.45 at 73 KIAS** windmilling,
2440 lb ⇒ CL 0.796, CD 0.0695 ⇒ CD0_eff ≈ 0.032 with e=0.75, A=7.24 —
_including_ windmilling-prop drag (subtract ~0.005–0.008 before reuse as a
clean polar). Cruise TAS at fixed %power scales as σ^−0.31 ≈ ρV³ = const —
parasite-dominated, consistent with a parabolic polar at cruise CL. Climb:
79/√σ KTAS reproduces the 5-19 distance integral to +3%.

## Integral & composition cross-checks

- **5-19 vs ∫dh/ROC(5-17)**: cumulative curves carry ~+1 min/+1 nm sea-level
  offset (drafted allowance) that cancels in the chart's subtract-two-lookups
  usage; difference-mode agreement +2.7% time, +3.3% distance. Consistent.
- **Range vs endurance × TAS**: implied block TAS from range/endurance matches
  the cruise charts' altitude trends; best-economy range is 13–16% longer at
  equal nominal %power for ~4 kt TAS cost.
- **Reserve arithmetic**: 45-min-reserve vs no-reserve deltas are internally
  consistent only to ~5% (the 65% delta slightly exceeds its theoretical
  bound) — don't compose cross-family differences; use each family absolutely.

## Errata & curiosities found in the POH itself

1. **5-35's "REF. LINE – 2400 LBS." label is a misprint** — geometry places it
   at 2438 lb; all four takeoff/landing nomographs share the 2440 anchor.
2. 5-9's bottom (500-ft) headwind guide implies a ~25-kt reference speed —
   physically absurd, drafting error, excluded from its fit.
3. Unlabeled drawn curves everywhere: 7000 ft (5-9), 15–16,000 ft and negative
   altitudes (5-15, 5-17), 11–12,000 ft (5-31), a clipped 12,000 (5-19).
   Identified via ISA std-temp-line crossings — a free self-check on any chart
   that draws the STD TEMP diagonal.
4. Printed worked examples are themselves imperfect: 5-21's dashed trace is
   ~1 kt off its own curves; 5-5's answer is 0.5–1 kt generous; 5-31's "0.5
   gal" is a rounded read of a drawn ≈0.62 gal; 5-9's printed 2100 ft sits
   1–2.5% above the chart's own guide curves.
5. Axis-label offsets up to 40 px from their gridlines (5-9, 5-25/27/29 dual
   offset scales on one lattice) — gridline-only calibration is essential.

## What is shared in the TypeScript implementation

- `model/atmosphere.ts` — single ISA implementation (already matches all fits).
- `model/airspeed.ts` — Fig 5-3 quadratics + inverse; below 43 KIAS use the
  stall-range offset CAS ≈ IAS + 6.6 kt (from 5-5).
- Wind policy constants (0.5 / 1.5) shared by all six wind models.
- DA conversion shared by engine/climb/cruise/descent pages.
- Everything else stays per-chart: unifying weight exponents or panel-1
  surfaces would cost 1.5–4% rms against charts that themselves disagree —
  the divergences above are POH content, faithfully reproduced.
