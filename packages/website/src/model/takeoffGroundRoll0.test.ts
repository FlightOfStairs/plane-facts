import { describe, expect, test } from "vitest";
import { CHART_EXAMPLE_5_07, MTOW_LB, liftoff0Kias, takeoffGroundRoll0 } from "./takeoffGroundRoll0";
import { takeoffGroundRoll25 } from "./takeoffGroundRoll25";

describe("Fig 5-7 0° flap takeoff ground roll", () => {
  test("reproduces the chart's printed worked example within 1.5% (fit achieved −0.9%)", () => {
    const r = takeoffGroundRoll0(CHART_EXAMPLE_5_07);
    expect(r.groundRollFt).toBeGreaterThan(1150 * 0.985);
    expect(r.groundRollFt).toBeLessThan(1150 * 1.015);
    // printed 50 KIAS; √W model gives 50.7 (strip labels run ~1 kt low — documented)
    expect(Math.abs(r.vLofKias - 50)).toBeLessThan(1.5);
    expect(r.warnings).toEqual([]);
  });

  test("matches the chart's dashed intermediate trace", () => {
    const r = takeoffGroundRoll0(CHART_EXAMPLE_5_07);
    expect(Math.abs(r.s0Ft - 1665)).toBeLessThan(1665 * 0.02);
    expect(Math.abs(r.s1Ft - 1477)).toBeLessThan(1477 * 0.02);
  });

  // Digitized samples from tools/digitize/out/fits/fig_5_07.json "curves"
  // (panel 1: [OAT °C, ft] at 2440 lb calm). Fit rms 1.64% → assert 3.5%.
  const panel1Golden: [number, number, number][] = [
    [0, 10.3, 1034.7],
    [0, 20.3, 1235.2],
    [0, 33.6, 1489.2],
    [2000, -9.9, 1098.2],
    [2000, 5.4, 1378.9],
    [2000, 26.8, 1784.9],
    [4000, -15.5, 1427.3],
    [4000, 0.2, 1713.1],
    [4000, 22.7, 2114.1],
    [6000, -13.1, 1886.8],
    [6000, 10.3, 2293.5],
    [6000, 25.6, 2568.6],
  ];
  test.each(panel1Golden)("panel 1 golden point: PA %d ft, OAT %d °C → %d ft", (pa, oat, expected) => {
    const r = takeoffGroundRoll0({ pressureAltitudeFt: pa, oatC: oat, weightLb: MTOW_LB, windKt: 0 });
    expect(Math.abs(r.s0Ft - expected)).toBeLessThan(expected * 0.035);
  });

  // Panel 2 weight guides: [S_ref at 2440 lb, weight, digitized ft]. rms 0.99% → assert 3%.
  const panel2Golden: [number, number, number][] = [
    [2307, 2184.0, 1781.9],
    [2307, 1897.1, 1285.3],
    [1901, 2076.4, 1292.0],
    [1478, 2052.5, 979.5],
    [1067, 1913.1, 586.9],
  ];
  test.each(panel2Golden)("panel 2 golden point: S_ref %d ft @ %d lb → %d ft", (sRef, w, expected) => {
    const factor = Math.pow(w / MTOW_LB, 2.344);
    expect(Math.abs(sRef * factor - expected)).toBeLessThan(expected * 0.03);
  });

  test("wind factors match the fit's robust table values", () => {
    const base = { pressureAltitudeFt: 0, oatC: 15, weightLb: MTOW_LB };
    expect(takeoffGroundRoll0({ ...base, windKt: 5 }).windFactor).toBeCloseTo(0.923, 2);
    expect(takeoffGroundRoll0({ ...base, windKt: 10 }).windFactor).toBeCloseTo(0.848, 2);
    expect(takeoffGroundRoll0({ ...base, windKt: 15 }).windFactor).toBeCloseTo(0.775, 2);
    expect(takeoffGroundRoll0({ ...base, windKt: -5 }).windFactor).toBeCloseTo(1.259, 2);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(takeoffGroundRoll0({ pressureAltitudeFt: 7000, oatC: 20, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffGroundRoll0({ pressureAltitudeFt: 0, oatC: 45, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffGroundRoll0({ pressureAltitudeFt: 0, oatC: 15, weightLb: 1600, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffGroundRoll0({ pressureAltitudeFt: 0, oatC: 15, weightLb: 2440, windKt: 16 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffGroundRoll0({ pressureAltitudeFt: 0, oatC: 15, weightLb: 2440, windKt: -6 }).warnings.length).toBeGreaterThan(0);
  });

  test("V_LOF ∝ √W anchored at 52 KIAS @ 2440 lb", () => {
    expect(liftoff0Kias(2440)).toBe(52);
    expect(liftoff0Kias(1700)).toBeCloseTo(43.4, 1);
  });

  test("FINDINGS invariant: 0-flap penalty ~+10% at MTOW, shrinking toward light weight", () => {
    const at = (w: number) => {
      const inp = { pressureAltitudeFt: 1500, oatC: 15, weightLb: w, windKt: 0 };
      return takeoffGroundRoll0(inp).groundRollFt / takeoffGroundRoll25(inp).groundRollFt;
    };
    expect(at(2440)).toBeGreaterThan(1.03); // 0-flap longer at MTOW
    expect(at(1750)).toBeLessThan(at(2440)); // k=2.34 vs 1.85 → penalty shrinks (charts nominally cross near 2000 lb)
  });

  test("tailwind penalty dominates headwind benefit", () => {
    const base = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300 };
    const calm = takeoffGroundRoll0({ ...base, windKt: 0 }).groundRollFt;
    const head = takeoffGroundRoll0({ ...base, windKt: 5 }).groundRollFt;
    const tail = takeoffGroundRoll0({ ...base, windKt: -5 }).groundRollFt;
    expect(head).toBeLessThan(calm);
    expect(tail).toBeGreaterThan(calm);
    expect(tail - calm).toBeGreaterThan(calm - head);
  });
});
