# PA-28-161 Performance Model — Project Context

## Goal

React app implementing reverse-engineered performance models from the Piper
PA-28-161 Warrior II POH (Report VB-1180, issued Aug 13 1982). One chart done
(25° flap takeoff ground roll); more to come (0° flap takeoff, takeoff over
50 ft, landing, climb, cruise, glide).

## Method (established, reuse for new charts)

POH nomographs were digitized from a 300-dpi scan of the POH PDF:

1. Rasterize page with `pdftoppm -png -r 300`.
2. Calibrate axes from **thick major gridlines** (morphological open with long
   1-D kernels, classify by stroke width) — NOT from label text centers, which
   sit offset from their ticks by up to 30 px (~4 °C on the OAT axis).
3. Extract performance curves with morphological opening using oriented
   diagonal kernels (31 px, slope swept over the expected range), which erases
   the rectangular grid and label text; cluster connected components; least-
   squares fit each curve; merge collinear fragments broken by labels.
4. Use the chart's dashed worked-example trace as ground truth to resolve
   ambiguities (e.g. label-above vs label-below curve attachment) and to
   validate the assembled model end to end.

Digitizing accuracy ≈ ±3 px ≈ ±10 ft; fitted coefficients good to ~2–3%.

## Model: 25° flap takeoff ground roll (Figure 5-11, POH p. 95 / 5-16)

Associated conditions: paved level dry runway, full power before brake
release, flaps 25°.

S_gr [ft] = S0 × (W/2440)^1.85 × f_wind

S0 = 812 + 0.188·PA_ft + 15.1·OAT_°C (at 2440 lb, zero wind)
V_LOF = 52·sqrt(W/2440) KCAS; V_TAS = V_LOF/sqrt(σ)
σ = δ/θ; δ = (1 − 6.87559e-6·PA)^5.2559; θ = (OAT+273.15)/288.15
headwind: f = (1 − 0.5·Vw/V_TAS)^1.55 (50% wind credit)
tailwind: f = (1 + 1.5·Vw/V_TAS)^1.55 (150% wind credit)

Validity envelope (chart extent): PA 0–7000 ft, OAT −40…+40 °C (curves
truncated bottom-left; SL curve only drawn OAT ≥ ~10 °C), W 1700–2440 lb,
headwind 0–15 kt, tailwind 0–5 kt. Flag extrapolation beyond this.

### Key findings (surprising, keep in mind for other charts)

- Panel 1 is a **plane in (PA, OAT)**, rms 1.1% — NOT a σ^-n power law
  (effective n varies 4.3→2.0 with altitude) and NOT a density-altitude
  collapse (temp coefficient 15.1 ft/°C ≡ ~80 ft PA/°C vs the ~96 ft/°C any
  f(DA) would force). The under-weighting of temperature matches carbureted
  power lapse P ∝ δ/√θ: with S ∝ σ^-1.5·P^-1, predicted ratio 0.80 vs
  observed 0.83. Expect similar anisotropy on other takeoff/landing charts.
- Altitude sensitivity exceeds σ^-2.4 physics (×2.05 at 7000 ISA vs ×1.67)
  — conservatism and/or full-rich carburetted losses baked in at altitude.
- Weight exponent 1.85 is constant along all guide curves (k = 1.73–1.94,
  no trend) — clean power law, slightly below the theoretical ≥2.
- Wind panel matches AFM certification policy: 50% headwind / 150% tailwind
  credit, exponent m ≈ 1.5–1.6 against V_LOF in TAS. Empirically −1.2 to
  −1.7%/kt headwind, +5–6%/kt tailwind.
- Liftoff speed strip: V ∝ √W exactly (52 KIAS @2440 → 43 @1700),
  C_L,LOF ≈ 1.57 (S = 170 ft²).

### Chart axis calibration (300 dpi raster of POH p.95, for re-checks)

- Ground roll: 0 ft at y=1364.4, 500 ft per 149.4 px (linear, majors at
  y = 617/766/916/1066.5/1215 = 2500…500 ft)
- OAT: 0 °C at x=739, 7.47 px/°C (majors at 439=−40, 1038=+40)
- Weight: 2300 lb at x=1189.5, 0.747 px/lb; ref line 2440 at x≈1085
- Wind: 0 kt at x=1712, 14.94 px/kt (15 kt at right border x=1937)

### Validation vs the chart's worked example

1500 ft PA, 27 °C, 2175 lb, 15 kt HW → printed answer 975 ft, 48 KIAS.
Model chain: S0 = 1501 (dashed trace ≈1495 ✓) → ×weight = 1213 (trace
≈1220 ✓, confirmed by arrowhead at W=2175) → ×wind = ~950 vs printed 975
(−2.6%, within drafting/interpolation tolerance).

## Code

- `src/model/takeoffGroundRoll.ts` — implemented, mirrors the equations above,
  includes envelope warnings. Treat as the reference implementation.
- Existing prototype UI: single-page calculator with sliders (PA/OAT/W/wind),
  correction-chain readout (S0 → ×weight → ×wind), V_LOF in KIAS + KTAS + σ,
  and a ground-roll-vs-PA line chart with the operating point marked. Rebuild
  in React; Chart.js or Recharts both fine.

## Conventions and cautions

- All speeds KIAS unless suffixed TAS; weights lb; distances ft; temps °C.
- Always validate a reconstructed chart against its own dashed worked example
  before trusting fitted parameters.
- Label text centers are unreliable for calibration; label-to-curve
  attachment is unreliable (this chart labels curves from BELOW) — resolve
  with the example trace or physics.
- Takeoff/landing charts encode certification policy (wind credits,
  conservatism), not pure airframe physics. Cruise/climb/glide charts should
  be closer to physical models (parabolic polar + Gagg–Ferrar lapse) — see
  Lowry, _Performance of Light Aircraft_ (AIAA 1999), "Bootstrap Approach".
- This is a study/planning tool. UI must carry a visible disclaimer: not a
  substitute for the POH; verify against the actual aircraft's AFM.

## Next steps

1. Digitize 0° flap takeoff ground roll chart (same POH section) — compare
   coefficients; ratio to 25° chart isolates the flap effect.
2. Takeoff over 50 ft obstacle — air-distance increment vs ground roll gives
   the assumed climb gradient; completes the takeoff model.
3. Landing charts (ground roll, over 50 ft).
4. Climb/cruise/glide via Lowry bootstrap (drag polar from glide data first,
   then prop efficiency from cruise, validate on climb).
5. React app: chart picker, shared atmosphere module, per-chart envelope
   warnings, side-by-side model-vs-digitized-chart residual view.
