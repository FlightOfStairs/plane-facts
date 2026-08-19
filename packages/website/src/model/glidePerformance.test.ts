import { describe, expect, test } from "vitest";
import { BEST_GLIDE_KIAS, CHART_EXAMPLE, GLIDE_RATIO, glidePerformance, glideRangeNm } from "./glidePerformance";

describe("Fig 5-33 glide performance", () => {
  test("reproduces the chart's printed worked example within 1% (fit errPct 0.99)", () => {
    const r = glidePerformance(CHART_EXAMPLE);
    // printed 9.5 − 3.9 = 5.6 nm; fit JSON model: 9.59 − 3.93 = 5.66
    expect(Math.abs(r.rangeCruiseNm - 9.5)).toBeLessThan(0.15);
    expect(Math.abs(r.rangeTerrainNm - 3.9)).toBeLessThan(0.1);
    expect(Math.abs(r.glideNm - 5.6)).toBeLessThan(5.6 * 0.015);
    expect(r.warnings).toEqual([]);
  });

  // Digitized samples copied from tools/digitize/out/fits/fig_5_33.json
  // "curves": [rangeNm, pressureAltFt]. Line rms 19.8 ft ≈ 0.037 nm;
  // assert within 0.1 nm (~2.7σ).
  const golden: [number, number][] = [
    [1.935, 933.6],
    [3.786, 1917.0],
    [5.267, 2723.3],
    [7.488, 3930.5],
    [10.08, 5288.9],
    [12.301, 6420.1],
    [14.892, 7801.7],
    [16.743, 8789.5],
    [18.965, 9991.0],
    [20.815, 10965.4],
    [22.666, 11951.7],
  ];
  test.each(golden)("glide-line golden point: %f nm at %f ft", (rangeNm, altFt) => {
    expect(Math.abs(glideRangeNm(altFt) - rangeNm)).toBeLessThan(0.1);
  });

  test("L/D is the line slope: 6076.115 ft/nm ÷ 530.47 ft/nm ≈ 11.45 at 73 KIAS", () => {
    expect(GLIDE_RATIO).toBeCloseTo(11.454, 2);
    expect(BEST_GLIDE_KIAS).toBe(73);
    // slope check: 1000 ft of altitude buys 1000/530.47 ≈ 1.885 nm
    expect(glideRangeNm(6000) - glideRangeNm(5000)).toBeCloseTo(1000 / 530.47, 6);
  });

  test("still-air range is linear: equal altitude losses give equal distances", () => {
    const high = glidePerformance({ cruisePressureAltitudeFt: 8000, terrainPressureAltitudeFt: 4000 });
    const low = glidePerformance({ cruisePressureAltitudeFt: 4000, terrainPressureAltitudeFt: 0 });
    expect(high.glideNm).toBeCloseTo(low.glideNm, 10);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(glidePerformance({ cruisePressureAltitudeFt: 13000, terrainPressureAltitudeFt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(glidePerformance({ cruisePressureAltitudeFt: 5000, terrainPressureAltitudeFt: -500 }).warnings.length).toBeGreaterThan(0);
    expect(glidePerformance({ cruisePressureAltitudeFt: 2000, terrainPressureAltitudeFt: 3000 }).warnings.length).toBeGreaterThan(0);
  });
});
