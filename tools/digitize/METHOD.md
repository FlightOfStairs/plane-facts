# Chart digitization method — brief for per-chart agents

You are digitizing one or more performance nomographs from a 300-dpi scan of
the PA-28-161 Warrior II POH (Report VB-1180, 1982) and fitting a mathematical
model. One chart (Fig 5-11, 25°-flap takeoff ground roll) was fully solved in
a prior session; its method, constants, and findings are in the repo root
`CLAUDE.md` — read it first. Its model lives in `takeoffGroundRoll.ts`.

## Environment

- Work from `tools/digitize/`; run everything with `uv run python …`.
- Rasters: `out/raw/page-0NN.png` (1-based PDF page numbers, 300 dpi,
  landscape pages already landscape). Page↔figure map is in the plan and
  below.
- Shared library `digitize/`:
  - `raster.prepared_page(pdf_page) -> (grayscale_img, deskew_angle)` —
    always use this (deskews via long-gridline projection).
  - `raster.binarize(img)` → boolean ink mask.
  - `calibrate.line_mask / find_lines / majors` — gridline detection;
    `calibrate.Axis` / `fit_axis` — linear px↔value maps.
  - `curves.curve_mask(ink, angles_deg, length)` — oriented morphological
    opening; erases grid + text, keeps diagonal/curved strokes.
    `curves.components` → fragments; `curves.group_curves` (agglomerative,
    combined-fit residual gate) → whole curves; `curves.centerline`,
    `fit_poly`.
  - `qa.overlay(img, curves_xy, vlines, hlines, path)` → writes
    `out/qa/<path>` for visual checks. Read the PNG back to _look_ at it.

## Method rules (hard-won, do not skip)

1. **Calibrate from thick major gridlines, never label text centers** —
   labels sit up to ~30 px off their ticks. Majors: thicker stroke AND
   longer extent than minors; verify spacing consistency (majors are evenly
   spaced in value). Baseline/border lines are usually the thickest.
2. Restrict analysis to per-panel ROIs (multi-panel nomographs share the
   y-axis; panels join at reference lines).
3. Sweep `angles_deg` over the slope range you _see_ for the target curve
   family; check the QA overlay after extraction, filter strays by extent,
   slope, and position before fitting.
4. **Resolve label↔curve attachment with the chart's dashed worked example**
   (every chart prints one) or physics — 5-11 labels curves from BELOW.
5. Fit the simplest model that reproduces the digitized points to ~1% rms;
   prefer physically-motivated forms but do not force them (5-11's panel 1 is
   a plane in (PA, OAT), _not_ any σ-power law — see CLAUDE.md for why).
   Where certification policy is involved (wind credits 50%/150%, speed
   strips V ∝ √W) expect the policy form.
6. **Validate the assembled model against the printed worked example** —
   must reproduce it within ~±3% (nomograph drafting tolerance). Report the
   chain of intermediate values, not just the final number.
7. Digitizing accuracy is ≈±3 px; quote fitted coefficients to matching
   precision and report rms residuals.

## Deliverables per chart (write under `tools/digitize/…`)

- `charts/fig_5_NN.py` — complete, re-runnable driver: load → calibrate →
  extract → fit → validate → emit. Deterministic, no interactive steps.
- `out/fits/fig_5_NN.json` — machine-readable result:
  ```jsonc
  {
    "figure": "5-7", "pdfPage": 93, "title": "...",
    "calibration": { "<axisName>": {"px0":…, "v0":…, "pxPerUnit":…}, … },
    "deskewDeg": …,
    "model": { "form": "<formula text>", "params": {…}, "rmsPct": … },
    "curves": [ {"label": "...", "points": [[x_unit, y_unit], …]}, … ],  // digitized samples in CHART UNITS
    "workedExample": { "inputs": {…}, "printed": {…}, "model": {…}, "errPct": … },
    "envelope": {…}, "notes": ["…"]
  }
  ```
- `out/qa/fig_5_NN_*.png` — overlay(s) proving calibration lines hit majors
  and fitted curves ride the printed ones. Look at them before declaring done.
- Your final report: the model form + params, fit quality, worked-example
  result, and any physics/regulatory observations (esp. parameters that
  should match other charts: weight exponents, wind credits, power lapse,
  V ∝ √W anchors, atmosphere handling).

## Page ↔ figure map

91:5-3 airspeed cal · 92:5-5 stall · 93:5-7 TO roll 0° · 94:5-9 TO 50ft 0° ·
95:5-11 TO roll 25° (done) · 96:5-13 TO 50ft 25° · 97:5-15 engine ·
98:5-17 climb · 99:5-19 climb fuel/time/dist · 100:5-21 cruise best-power ·
101:5-23 cruise best-econ · 102:5-25 range best-power · 103:5-27 range
best-econ · 104:5-29 endurance · 105:5-31 descent · 106:5-33 glide ·
107:5-35 landing 50ft · 108:5-37 landing roll

## Reference constants (Fig 5-11, current raster frame, page 95)

Distance axis: 0 ft at y=1363.1, 149.4 px per 500 ft (majors 616/766/916/1066/1214).
OAT: −40 °C at x=439.7, 7.49 px/°C. Weight ref (2440 lb): x=1083.6.
Wind: 0 kt at x=1711.5, 15.05 px/kt (15 kt border 1937.2). Deskew −0.10°.
Sibling takeoff/landing charts share this layout — expect similar geometry,
but calibrate each page yourself.
