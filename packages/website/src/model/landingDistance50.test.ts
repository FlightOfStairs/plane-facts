import { describe, expect, test } from "vitest";
import { CHART_EXAMPLE_5_35, MLW_LB, baseDistance50Ft, landingDistance50 } from "./landingDistance50";
import { approachKias, touchdownKias } from "./landingSpeeds";

describe("Fig 5-35 landing distance over 50 ft barrier", () => {
  test("reproduces the chart's printed worked example (fit achieved −0.4%; assert ±1.5%)", () => {
    const r = landingDistance50(CHART_EXAMPLE_5_35);
    expect(r.distanceOver50FtFt).toBeGreaterThan(1135 * 0.985);
    expect(r.distanceOver50FtFt).toBeLessThan(1135 * 1.015);
    expect(r.warnings).toEqual([]);
  });

  test("matches the chart's dashed intermediate trace", () => {
    const r = landingDistance50(CHART_EXAMPLE_5_35);
    // dashed trace carries S0 ≈ 1270, after-weight ≈ 1133 (fit JSON dashedTrace)
    expect(Math.abs(r.s0Ft - 1270)).toBeLessThan(1270 * 0.02);
    expect(Math.abs(r.s1Ft - 1133)).toBeLessThan(1133 * 0.02);
  });

  // Representative digitized samples from tools/digitize/out/fits/fig_5_35.json
  // "curves" ([OAT °C, distance ft] at 2440 lb, zero wind). Fit rms 0.23%;
  // assert within 1% (rms + digitization-noise margin).
  const golden: [number, number, number][] = [
    // [paFt, oatC, distanceFt]
    [0, -39.9, 1009.0],
    [0, 0.18, 1113.8],
    [0, 20.48, 1171.0],
    [0, 39.72, 1226.8],
    [2000, -20.13, 1109.8],
    [2000, 20.48, 1234.2],
    [4000, -30.15, 1136.7],
    [4000, 0.31, 1238.9],
    [4000, 30.23, 1337.7],
    [6000, -0.09, 1310.8],
    [6000, 29.83, 1411.6],
    [7000, -39.77, 1209.3],
    [7000, 10.46, 1392.1],
    [7000, 38.78, 1497.0],
  ];
  test.each(golden)("golden point PA %d ft, OAT %f °C → %f ft (±1%%)", (pa, oat, dist) => {
    expect(Math.abs(baseDistance50Ft(pa, oat) - dist)).toBeLessThan(dist * 0.01);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(landingDistance50({ pressureAltitudeFt: 8000, oatC: 20, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(landingDistance50({ pressureAltitudeFt: 0, oatC: 45, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(landingDistance50({ pressureAltitudeFt: 0, oatC: 15, weightLb: 1600, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(landingDistance50({ pressureAltitudeFt: 0, oatC: 15, weightLb: 2440, windKt: 20 }).warnings.length).toBeGreaterThan(0);
    expect(landingDistance50({ pressureAltitudeFt: 0, oatC: 15, weightLb: 2440, windKt: -6 }).warnings.length).toBeGreaterThan(0);
  });

  test("headwind shortens, tailwind lengthens — tailwind penalty ~3× headwind benefit", () => {
    const base = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300 };
    const calm = landingDistance50({ ...base, windKt: 0 }).distanceOver50FtFt;
    const head = landingDistance50({ ...base, windKt: 5 }).distanceOver50FtFt;
    const tail = landingDistance50({ ...base, windKt: -5 }).distanceOver50FtFt;
    expect(head).toBeLessThan(calm);
    expect(tail).toBeGreaterThan(calm);
    expect(tail - calm).toBeGreaterThan(2 * (calm - head));
  });

  test("weight exponent ≈1 (landing KE physics): distance nearly proportional to W", () => {
    const base = { pressureAltitudeFt: 0, oatC: 15, windKt: 0 };
    const full = landingDistance50({ ...base, weightLb: MLW_LB }).distanceOver50FtFt;
    const half = landingDistance50({ ...base, weightLb: 2074 }).distanceOver50FtFt;
    // (2074/2440)^0.96 = 0.855; ratio must sit near W-ratio 0.85, far from the takeoff k≈1.85 (0.74)
    expect(half / full).toBeGreaterThan(0.84);
    expect(half / full).toBeLessThan(0.87);
  });

  test("speed strips reproduce every printed label on rounding", () => {
    const weights = [2440, 2200, 2000, 1800, 1600];
    const printedApproach = [65, 63, 60, 55, 49];
    const printedTouchdown = [45, 42, 40, 39, 37];
    weights.forEach((w, i) => {
      expect(Math.round(approachKias(w))).toBe(printedApproach[i]!);
      expect(Math.round(touchdownKias(w))).toBe(printedTouchdown[i]!);
    });
  });
});
