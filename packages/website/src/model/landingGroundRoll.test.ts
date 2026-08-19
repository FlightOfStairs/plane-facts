import { describe, expect, test } from "vitest";
import { landingDistance50 } from "./landingDistance50";
import { CHART_EXAMPLE_5_37, MLW_LB, baseGroundRollFt, landingGroundRoll } from "./landingGroundRoll";

describe("Fig 5-37 landing ground roll", () => {
  test("reproduces the chart's printed worked example (fit achieved +0.9%; assert ±2%)", () => {
    const r = landingGroundRoll(CHART_EXAMPLE_5_37);
    expect(r.groundRollFt).toBeGreaterThan(625 * 0.98);
    expect(r.groundRollFt).toBeLessThan(625 * 1.02);
    expect(r.warnings).toEqual([]);
  });

  test("matches the chart's dashed intermediate trace", () => {
    const r = landingGroundRoll(CHART_EXAMPLE_5_37);
    // dashed trace carries S0 ≈ 698, after-weight ≈ 625 (fit JSON dashedTrace)
    expect(Math.abs(r.s0Ft - 698)).toBeLessThan(698 * 0.02);
    expect(Math.abs(r.s1Ft - 625)).toBeLessThan(625 * 0.02);
  });

  // Representative digitized samples from tools/digitize/out/fits/fig_5_37.json
  // "curves" ([OAT °C, distance ft] at 2440 lb, zero wind). Fit rms 0.25%;
  // assert within 1% (rms + digitization-noise margin).
  const golden: [number, number, number][] = [
    // [paFt, oatC, distanceFt]
    [0, -39.84, 516.2],
    [0, 0.41, 596.4],
    [0, 20.54, 636.3],
    [0, 39.6, 675.9],
    [2000, -20.25, 592.7],
    [2000, 20.54, 681.3],
    [4000, 0.41, 687.0],
    [4000, 30.07, 756.8],
    [6000, -0.12, 731.0],
    [6000, 29.54, 809.1],
    [7000, -39.84, 662.5],
    [7000, 0.41, 764.5],
    [7000, 20.54, 814.8],
    [7000, 40.13, 868.5],
  ];
  test.each(golden)("golden point PA %d ft, OAT %f °C → %f ft (±1%%)", (pa, oat, dist) => {
    expect(Math.abs(baseGroundRollFt(pa, oat) - dist)).toBeLessThan(dist * 0.01);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(landingGroundRoll({ pressureAltitudeFt: 8000, oatC: 20, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(landingGroundRoll({ pressureAltitudeFt: 0, oatC: -45, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(landingGroundRoll({ pressureAltitudeFt: 0, oatC: 15, weightLb: 2500, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(landingGroundRoll({ pressureAltitudeFt: 0, oatC: 15, weightLb: 2440, windKt: -6 }).warnings.length).toBeGreaterThan(0);
  });

  test("headwind shortens, tailwind lengthens — tailwind penalty ~3× headwind benefit", () => {
    const base = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300 };
    const calm = landingGroundRoll({ ...base, windKt: 0 }).groundRollFt;
    const head = landingGroundRoll({ ...base, windKt: 5 }).groundRollFt;
    const tail = landingGroundRoll({ ...base, windKt: -5 }).groundRollFt;
    expect(head).toBeLessThan(calm);
    expect(tail).toBeGreaterThan(calm);
    expect(tail - calm).toBeGreaterThan(2 * (calm - head));
  });

  test("weight exponent ≈1 (landing KE physics): roll nearly proportional to W", () => {
    const base = { pressureAltitudeFt: 0, oatC: 15, windKt: 0 };
    const full = landingGroundRoll({ ...base, weightLb: MLW_LB }).groundRollFt;
    const light = landingGroundRoll({ ...base, weightLb: 2074 }).groundRollFt;
    expect(light / full).toBeGreaterThan(0.84);
    expect(light / full).toBeLessThan(0.87);
  });

  test("ground roll is always shorter than the sibling chart's distance over 50 ft", () => {
    const cases = [
      { pressureAltitudeFt: 0, oatC: 15, weightLb: 2440, windKt: 0 },
      { pressureAltitudeFt: 7000, oatC: 40, weightLb: 1700, windKt: 0 },
      { pressureAltitudeFt: 2500, oatC: 24, weightLb: 2179, windKt: 15 },
      { pressureAltitudeFt: 4000, oatC: -20, weightLb: 2000, windKt: -5 },
    ];
    for (const c of cases) {
      expect(landingGroundRoll(c).groundRollFt).toBeLessThan(landingDistance50(c).distanceOver50FtFt);
    }
  });
});
