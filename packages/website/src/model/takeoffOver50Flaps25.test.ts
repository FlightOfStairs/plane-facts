import { describe, expect, test } from "vitest";
import { takeoffGroundRoll25 } from "./takeoffGroundRoll25";
import { CHART_EXAMPLE_5_13, MTOW_LB, barrierFlaps25Kias, liftoffOver50Flaps25Kias, takeoffOver50Flaps25 } from "./takeoffOver50Flaps25";

describe("Fig 5-13 25° flap takeoff over 50 ft barrier", () => {
  test("reproduces the chart's printed worked example within 2.5% (fit achieved −1.9%)", () => {
    const r = takeoffOver50Flaps25(CHART_EXAMPLE_5_13);
    expect(r.distanceOver50Ft).toBeGreaterThan(1500 * 0.975);
    expect(r.distanceOver50Ft).toBeLessThan(1500 * 1.025);
    // printed speeds 48 / 53 KIAS; strip interpolation gives 47.8 / 52.6
    expect(Math.abs(r.vLofKias - 48)).toBeLessThan(0.5);
    expect(Math.abs(r.v50Kias - 53)).toBeLessThan(0.5);
    expect(r.warnings).toEqual([]);
  });

  test("matches the chart's dashed intermediate trace within 1.5%", () => {
    const r = takeoffOver50Flaps25(CHART_EXAMPLE_5_13);
    expect(Math.abs(r.s0Ft - 2345)).toBeLessThan(2345 * 0.015);
    expect(Math.abs(r.s1Ft - 1873)).toBeLessThan(1873 * 0.015);
  });

  // Digitized samples from tools/digitize/out/fits/fig_5_13.json "curves"
  // (panel 1: [OAT °C, ft] at 2440 lb calm). Fit rms 1.06% → assert 3.5%.
  const panel1Golden: [number, number, number][] = [
    [0, 10.32, 1537.9],
    [0, 30.98, 2043.8],
    [1000, 0.51, 1547.9],
    [1000, 20.12, 2033.7],
    [3000, -15.65, 1668.5],
    [3000, 10.32, 2368.8],
    [3000, 28.33, 2861.3],
    [5000, -9.69, 2365.4],
    [5000, 15.75, 3159.5],
    [5000, 35.36, 3839.7],
    [7000, -20.29, 2700.5],
    [7000, -0.15, 3387.4],
  ];
  test.each(panel1Golden)("panel 1 golden point: PA %d ft, OAT %d °C → %d ft", (pa, oat, expected) => {
    const r = takeoffOver50Flaps25({ pressureAltitudeFt: pa, oatC: oat, weightLb: MTOW_LB, windKt: 0 });
    expect(Math.abs(r.s0Ft - expected)).toBeLessThan(expected * 0.035);
  });

  test("weight exponent 2.02 matches the chart's dashed trace (1873/2345 ≈ (2175/2440)^k)", () => {
    const impliedK = Math.log(1873 / 2345) / Math.log(2175 / 2440);
    expect(Math.abs(2.02 - impliedK)).toBeLessThan(0.1);
  });

  test("speed strips reproduce every printed label exactly", () => {
    const weights = [2440, 2200, 2000, 1800, 1600];
    const lof = [52, 48, 46, 43, 40];
    const bar = [57, 53, 50, 47, 44];
    weights.forEach((w, i) => {
      expect(liftoffOver50Flaps25Kias(w)).toBe(lof[i]!);
      expect(barrierFlaps25Kias(w)).toBe(bar[i]!);
    });
  });

  test("FINDINGS invariant: barrier speed ≈ 1.10 × lift-off across the weight range", () => {
    for (const w of [1700, 2000, 2200, 2440]) {
      const ratio = barrierFlaps25Kias(w) / liftoffOver50Flaps25Kias(w);
      expect(ratio).toBeGreaterThan(1.08);
      expect(ratio).toBeLessThan(1.12);
    }
  });

  test("distance over 50 ft exceeds the Fig 5-11 ground roll at equal conditions", () => {
    const inp = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300, windKt: 0 };
    expect(takeoffOver50Flaps25(inp).distanceOver50Ft).toBeGreaterThan(takeoffGroundRoll25(inp).groundRollFt);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(takeoffOver50Flaps25({ pressureAltitudeFt: 8000, oatC: 20, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffOver50Flaps25({ pressureAltitudeFt: 0, oatC: -45, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffOver50Flaps25({ pressureAltitudeFt: 0, oatC: 15, weightLb: 1650, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffOver50Flaps25({ pressureAltitudeFt: 7000, oatC: 40, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0); // beyond the 4000-ft drawn scale
  });

  test("tailwind penalty dominates headwind benefit", () => {
    const base = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300 };
    const calm = takeoffOver50Flaps25({ ...base, windKt: 0 }).distanceOver50Ft;
    const head = takeoffOver50Flaps25({ ...base, windKt: 5 }).distanceOver50Ft;
    const tail = takeoffOver50Flaps25({ ...base, windKt: -5 }).distanceOver50Ft;
    expect(head).toBeLessThan(calm);
    expect(tail).toBeGreaterThan(calm);
    expect(tail - calm).toBeGreaterThan(calm - head);
  });
});
