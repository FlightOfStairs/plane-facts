import { describe, expect, test } from "vitest";
import { densityAltitudeFt, densityRatio } from "./atmosphere";
import type { Mixture, PowerSetting } from "./cruisePerformance";
import { CHART_EXAMPLE, cruisePerformance, latticeU } from "./cruisePerformance";

const run = (mixture: Mixture, pa: number, oat: number, pct: PowerSetting, fairings = true) => cruisePerformance({ pressureAltitudeFt: pa, oatC: oat, powerPct: pct, mixture, wheelFairings: fairings });

describe("Fig 5-21 / 5-23 cruise performance", () => {
  test("Fig 5-21 printed worked example within 1% (fit achieved −0.5%)", () => {
    const r = cruisePerformance({ ...CHART_EXAMPLE, mixture: "bestPower" });
    // POH prints 122.5 KTAS; its own dashed trace is ~1 kt off the curves,
    // the fit reproduces the curves at 121.9 (errPct −0.5 in fig_5_21.json).
    expect(Math.abs(r.tasKt - 122.5)).toBeLessThan(122.5 * 0.01);
    expect(r.tasKt).toBeCloseTo(121.9, 1);
    expect(r.densityAltitudeFt).toBeCloseTo(6272, 0);
    expect(r.fullThrottleLimited).toBe(false);
    expect(r.fuelGph).toBe(10.0);
    expect(r.warnings).toEqual([]);
  });

  test("Fig 5-23 printed worked example within 0.5% (fit achieved +0.05%)", () => {
    const r = cruisePerformance({ ...CHART_EXAMPLE, mixture: "bestEconomy" });
    expect(Math.abs(r.tasKt - 118)).toBeLessThan(118 * 0.005);
    expect(r.densityAltitudeFt).toBeCloseTo(6235, 0);
    expect(r.fullThrottleLimited).toBe(false);
    expect(r.fuelGph).toBe(8.5);
    expect(r.warnings).toEqual([]);
  });

  // Golden points: representative digitized samples from the fits' "curves"
  // arrays. TAS curves are (TAS_kt, DA_ft) → assert TAS(u = DA/2000) within
  // the per-curve fit rms (0.07–0.15 kt) + digitization margin.
  const tasGolden: [Mixture, PowerSetting | "FT", number, number][] = [
    // fig_5_21.json
    ["bestPower", 55, 299, 95.69],
    ["bestPower", 55, 3195, 98.54],
    ["bestPower", 55, 7217, 102.41],
    ["bestPower", 55, 13008, 107.86],
    ["bestPower", 65, 58, 105.07],
    ["bestPower", 65, 7458, 112.52],
    ["bestPower", 65, 12606, 117.74],
    ["bestPower", 75, 58, 112.59],
    ["bestPower", 75, 5206, 120.32],
    ["bestPower", 75, 8665, 125.46],
    // FT points only above the 75% intersection (below it the boundary caps nothing)
    ["bestPower", "FT", 10595, 123.93],
    ["bestPower", "FT", 12204, 120.41],
    // fig_5_23.json
    ["bestEconomy", 55, 313, 92.34],
    ["bestEconomy", 55, 7273, 99.47],
    ["bestEconomy", 55, 12773, 104.97],
    ["bestEconomy", 65, 227, 102.25],
    ["bestEconomy", 65, 6929, 110.48],
    ["bestEconomy", 65, 11741, 116.53],
    ["bestEconomy", 75, 55, 108.6],
    ["bestEconomy", 75, 4523, 115.42],
    ["bestEconomy", 75, 8906, 121.93],
    ["bestEconomy", "FT", 9579, 122.87],
    ["bestEconomy", "FT", 11985, 116.76],
  ];

  test.each(tasGolden)("golden TAS: %s %s%% curve at DA %d ft → %f kt", (mixture, curve, daFt, tasKt) => {
    // Reconstruct the curve polynomial through the public API: pick PA/OAT
    // that land on this DA is awkward, so evaluate via a PA=DA-on-std-day
    // equivalent — instead we invert directly: the model exposes u through
    // its result; feed inputs whose lattice-u equals DA/2000.
    const u = daFt / 2000;
    // Find (PA, OAT) on the lattice giving this u: PA near the target DA,
    // then bisect OAT (latticeU is monotone increasing in OAT throughout).
    const pa = Math.min(16000, Math.max(0, Math.round(daFt / 1000) * 1000));
    let lo = -40;
    let hi = 40;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (latticeU(mixture, pa, mid) < u) lo = mid;
      else hi = mid;
    }
    const oat = (lo + hi) / 2;
    expect(latticeU(mixture, pa, oat) * 2000).toBeCloseTo(daFt, 0);
    const tol = curve === "FT" ? 0.5 : 0.4; // fit rms 0.07–0.15 kt + margin
    const r = run(mixture, pa, oat, curve === "FT" ? 75 : curve);
    const got = curve === "FT" ? r.tasChartKt : r.tasPowerCurveKt;
    expect(r.fullThrottleLimited).toBe(curve === "FT");
    expect(Math.abs(got - tasKt)).toBeLessThan(tol);
  });

  // Golden lattice points: digitized (OAT, DA) samples from the PA guide
  // lines assert the fitted u-surface (tolerance = digitized scatter).
  const latticeGolden: [Mixture, number, number, number, number][] = [
    // fig_5_21.json: PA line, OAT, DA, tolerance ft
    ["bestPower", 0, 16.31, 150, 80],
    ["bestPower", 2000, 0.33, 626, 80],
    ["bestPower", 8000, 1.2, 8192, 80],
    ["bestPower", 12000, -15.08, 11201, 80],
    // fig_5_23.json
    ["bestEconomy", 1000, 15.92, 1382, 100],
    ["bestEconomy", 6000, -2.0, 5429, 100],
    ["bestEconomy", 11000, -0.12, 11745, 100],
  ];

  test.each(latticeGolden)("golden lattice: %s PA %d ft, OAT %f °C → DA %d ft", (mixture, pa, oat, da, tol) => {
    expect(Math.abs(latticeU(mixture, pa, oat) * 2000 - da)).toBeLessThan(tol);
  });

  test("full-throttle cap: 75% best power at DA ~11700 is limited to the FT boundary", () => {
    const r = run("bestPower", 10000, 10, 75);
    expect(r.densityAltitudeFt).toBeGreaterThan(11600);
    expect(r.densityAltitudeFt).toBeLessThan(11800);
    expect(r.fullThrottleLimited).toBe(true);
    expect(r.tasChartKt).toBeCloseTo(121.5, 0);
    expect(r.tasChartKt).toBeLessThan(r.tasPowerCurveKt);
    // achievable %power tracks the fit's implied full-throttle lapse (~68.9%)
    expect(r.achievablePowerPct).toBeGreaterThan(67.5);
    expect(r.achievablePowerPct).toBeLessThan(70);
    // fuel interpolated toward the achievable power, below the 75% table value
    expect(r.fuelGph).toBeLessThan(10.0);
    expect(r.fuelGph).toBeGreaterThan(8.8);
  });

  test("5-23 FT boundary is NOT extrapolated below its drawn range", () => {
    // At DA ~3100 the 5-23 FT cubic would (nonsensically) dip below the 75%
    // curve if extrapolated; the u-range guard must prevent capping.
    const r = run("bestEconomy", 3000, 10, 75);
    expect(r.densityAltitudeFt).toBeGreaterThan(2900);
    expect(r.densityAltitudeFt).toBeLessThan(3300);
    expect(r.fullThrottleLimited).toBe(false);
    expect(r.tasChartKt).toBeCloseTo(113.3, 0);
  });

  test("wheel-fairing toggle subtracts exactly 7 kt", () => {
    const withF = run("bestPower", 4000, 5, 65, true);
    const without = run("bestPower", 4000, 5, 65, false);
    expect(withF.tasKt - without.tasKt).toBeCloseTo(7, 9);
    expect(withF.tasChartKt).toBeCloseTo(without.tasChartKt, 9);
  });

  test("envelope warnings fire outside the chart", () => {
    expect(run("bestPower", 17000, 0, 55).warnings.length).toBeGreaterThan(0);
    expect(run("bestPower", 5000, 45, 65).warnings.length).toBeGreaterThan(0);
    expect(run("bestEconomy", 0, -20, 55).warnings.join(" ")).toContain("below 0 ft");
    // beyond the top of a drawn curve (75% ends at u≈4.33 on 5-21 → capped
    // region instead reports the FT boundary when past ITS top)
    const high = run("bestPower", 14000, 20, 65);
    expect(high.warnings.join(" ")).toContain("full-throttle");
  });

  // Invariant from docs/FINDINGS.md: the cruise charts' PA/OAT lattice is a
  // true density-altitude collapse — the fitted surfaces must agree with the
  // shared ISA atmosphere DA to ~30 ft (assert 100 ft).
  const daCollapse: [number, number][] = [
    [0, 15],
    [2000, -10],
    [5000, 16],
    [8000, 30],
    [10000, -5],
    [14000, -13.1],
  ];
  test.each(daCollapse)("lattice DA ≈ ISA DA at PA %d ft, OAT %f °C", (pa, oat) => {
    const isaDa = densityAltitudeFt(densityRatio(pa, oat));
    for (const mixture of ["bestPower", "bestEconomy"] as const) {
      expect(Math.abs(latticeU(mixture, pa, oat) * 2000 - isaDa)).toBeLessThan(100);
    }
  });

  test("best power is faster than best economy at equal settings (FINDINGS: ~4 kt)", () => {
    for (const pct of [55, 65, 75] as const) {
      const bp = run("bestPower", 4000, 10, pct).tasChartKt;
      const be = run("bestEconomy", 4000, 10, pct).tasChartKt;
      expect(bp).toBeGreaterThan(be + 1.5);
      expect(bp).toBeLessThan(be + 7);
    }
  });

  test("fuel table matches the printed FUEL CONSUMPTION boxes", () => {
    expect(run("bestPower", 2000, 10, 55).fuelGph).toBe(7.8);
    expect(run("bestPower", 2000, 10, 65).fuelGph).toBe(8.8);
    expect(run("bestEconomy", 2000, 10, 55).fuelGph).toBe(6.6);
    expect(run("bestEconomy", 2000, 10, 65).fuelGph).toBe(7.5);
  });
});
