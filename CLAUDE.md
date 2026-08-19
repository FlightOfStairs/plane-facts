# PA-28-161 Performance Model — Project Context

## Status: all 17 POH Section-5 charts digitized, modeled, and shipped

React app implementing reverse-engineered performance models from the Piper
PA-28-161 Warrior II POH (Report VB-1180, Aug 13 1982; scan at
`PA-28-161-POH.pdf`, Section 5 = PDF pages 90–108). Every chart (Figs 5-3 …
5-37) has: a Python digitization driver, a fitted model validated against the
chart's printed worked example (±3.4% worst, most ≤1%), a TypeScript model
module with vitest coverage (371 tests), and a React page that outputs model
numbers and draws the model-derived trace over the original scan.

## Where things live

- `docs/FINDINGS.md` — **read this first**: cross-chart consolidation
  (atmosphere regimes, weight exponents, wind-credit policy, engine lapse,
  drag polar, POH errata).
- `tools/digitize/` — Python pipeline (uv; `uv run python …`):
  - `METHOD.md` — the digitization method + per-agent brief.
  - `digitize/` — shared raster/calibrate/curves/qa library.
  - `charts/fig_5_NN.py` — re-runnable per-chart drivers;
    `charts/gate_5_11.py` is the calibration regression gate.
  - `out/fits/fig_5_NN.json` — authoritative fitted params + digitized samples
    (committed). `out/raw`, `out/qa` are gitignored intermediates;
    regenerate rasters with
    `pdftoppm -png -r 300 -gray -f 90 -l 108 PA-28-161-POH.pdf tools/digitize/out/raw/page`.
  - `assets/fig-5-NN.json` + `export_asset.py` — web asset/calibration export.
- `packages/website/src/model/` — TS models (shared `atmosphere.ts`,
  `airspeed.ts`, `shared.ts` for the wind-credit policy and envelope
  warnings; one module per chart; constants comment their source fit).
  `caaSafetyFactors.ts` layers CAA Safety Sense factors (surface, slope,
  general factor) on the takeoff/landing distances — the POH already covers
  weight/altitude/temperature/wind, so those leaflet rows are not applied.
- `packages/website/src/charts/` — asset calibration metas + trace builders;
  `SECTION_COLORS` in `types.ts` colors each nomogram section of a trace.
- `packages/website/src/pages/` — one page per chart, all built on
  `components/ChartPageLayout.tsx`; registry in `index.ts`. `AboutModelsPage`
  holds the cross-chart documentation, so per-chart `ModelNotes` carry only
  what is unique to that chart.
- Page state (chart selection + all inputs) is URL-persisted via
  `lib/urlState.ts`, so a refresh or a shared link restores the scenario.
- `tools/screenshot.mjs` — serves the built `dist` and screenshots every
  registered page to `tools/digitize/out/qa/ui-*.png` (playwright).

## Method (for any future chart/POH work)

300-dpi pdftoppm raster → deskew → calibrate axes from **thick major
gridlines** (never label text — labels sit up to 40 px off) → oriented
morphological opening for curve extraction → agglomerative fragment grouping
(combined-fit residual gate) → least-squares model fit → **validate against
the chart's printed worked example** and eyeball a QA overlay. Unlabeled
curves are identified via their STANDARD TEMPERATURE (ISA) line crossings.
Digitizing accuracy ≈ ±3 px; fitted coefficients good to ~1–3%.

## Conventions and cautions

- All speeds KIAS unless suffixed (KCAS/KTAS); weights lb; distances ft/nm;
  temps °C. Single ISA implementation in `model/atmosphere.ts` — never
  re-derive.
- Takeoff/landing charts encode certification policy (50%/150% wind credits,
  conservatism), not pure physics; takeoff charts are anisotropic in
  (PA, OAT) — do NOT model them as f(density altitude). Engine/climb/cruise
  charts ARE clean DA collapses. See FINDINGS.md before assuming either.
- Chart overlays are demonstration-only; all displayed numbers come from the
  models. UI carries a permanent disclaimer — keep it.
- Toolchain: lint = oxlint, format = prettier, typecheck = per-package `tsc`
  (TS 7 native), tests = vitest. `npm run <x>` from repo root fans out.

## Verification commands

```sh
npm run lint && npm run typecheck && npm test
npm run build -w packages/website && node tools/screenshot.mjs   # visual QA
cd tools/digitize && uv run python charts/gate_5_11.py           # calibration gate
```

## Possible next steps

- Deploy (CDK stack in `packages/infrastructure` is ready; needs the org
  account + NS delegation — see README).
- Composite planning page (takeoff + climb + cruise + descent + landing for a
  whole flight), density-altitude quick card, weight-and-balance (POH §6).
- Lowry bootstrap refinement: extract a clean drag polar from the 5-33 anchor
  (subtract windmilling-prop drag) and re-derive climb/cruise from physics to
  compare against the certification-policy charts.
