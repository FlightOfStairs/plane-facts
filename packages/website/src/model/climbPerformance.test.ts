import { describe, expect, test } from "vitest";
import { ABSOLUTE_CEILING_DA_FT, CHART_EXAMPLE, climbPerformance, rocChartFitFpm } from "./climbPerformance";

describe("Fig 5-17 climb performance", () => {
  test("reproduces the chart's printed worked example (340 fpm) within the fit's −1.6%", () => {
    const r = climbPerformance(CHART_EXAMPLE);
    // fit JSON: model 334.7 fpm vs printed 340 (errPct −1.6) → assert within 2.5%
    expect(r.rocChartFpm).toBeCloseTo(334.7, 0);
    expect(Math.abs(r.rocFpm - 340) / 340).toBeLessThan(0.025);
    // the DA-collapse form with the shared-ISA density altitude lands even closer
    expect(Math.abs(r.rocDaModelFpm - 340)).toBeLessThan(5);
    expect(r.warnings).toEqual([]);
  });

  // Golden points copied from tools/digitize/out/fits/fig_5_17.json "curves"
  // ([OAT °C, ROC fpm] on each labeled PA line). Fit rms is 3.9 fpm; the
  // worst single digitized-point residual is ~15 fpm (cold extremes), so
  // assert within ±16 fpm.
  const golden: [number, number, number][] = [
    // [PA ft, OAT °C, ROC fpm]
    [0, 17.05, 629.2],
    [0, 39.21, 503.5],
    [1000, 7.38, 628.1],
    [1000, 39.61, 441.8],
    [2000, -2.56, 628.6],
    [2000, 19.6, 495.4],
    [4000, -21.63, 628.7],
    [4000, 10.61, 422.7],
    [4000, 38.81, 269.7],
    [5000, 16.25, 330.7],
    [6000, -39.22, 627.2],
    [6000, 39.35, 154.8],
    [8000, 1.07, 239.6],
    [10000, -11.02, 188.0],
    [12000, -27.13, 166.8],
    [14000, -31.16, 69.1],
    [15000, -39.22, 62.2],
  ];
  test.each(golden)("golden digitized point PA %d ft, OAT %d °C → %d fpm", (pa, oat, roc) => {
    expect(Math.abs(rocChartFitFpm(pa, oat) - roc)).toBeLessThan(16);
  });

  test("wheel fairings removed subtracts exactly 40 fpm", () => {
    const on = climbPerformance({ pressureAltitudeFt: 3000, oatC: 10, wheelFairingsRemoved: false });
    const off = climbPerformance({ pressureAltitudeFt: 3000, oatC: 10, wheelFairingsRemoved: true });
    expect(on.rocFpm - off.rocFpm).toBeCloseTo(40, 10);
    expect(on.rocDaModelFpm - off.rocDaModelFpm).toBeCloseTo(40, 10);
  });

  test("warns when climb is marginal (< 100 fpm)", () => {
    const r = climbPerformance({ pressureAltitudeFt: 12000, oatC: -5, wheelFairingsRemoved: false });
    expect(r.rocFpm).toBeLessThan(100);
    expect(r.warnings.some((w) => w.includes("marginal") || w.includes("ceiling"))).toBe(true);
  });

  test("envelope warnings fire outside the chart", () => {
    expect(climbPerformance({ pressureAltitudeFt: 17000, oatC: -30, wheelFairingsRemoved: false }).warnings.length).toBeGreaterThan(0);
    expect(climbPerformance({ pressureAltitudeFt: 2000, oatC: 45, wheelFairingsRemoved: false }).warnings.length).toBeGreaterThan(0);
    expect(climbPerformance({ pressureAltitudeFt: -500, oatC: 10, wheelFairingsRemoved: false }).warnings.length).toBeGreaterThan(0);
  });

  test("FINDINGS invariant: absolute ceiling at DA ≈ 13,200 ft, coherent across charts", () => {
    expect(ABSOLUTE_CEILING_DA_FT).toBeGreaterThan(13100);
    expect(ABSOLUTE_CEILING_DA_FT).toBeLessThan(13300);
  });

  test("ROC decreases monotonically with both PA and OAT", () => {
    expect(rocChartFitFpm(4000, 10)).toBeLessThan(rocChartFitFpm(2000, 10));
    expect(rocChartFitFpm(4000, 30)).toBeLessThan(rocChartFitFpm(4000, 10));
  });
});
