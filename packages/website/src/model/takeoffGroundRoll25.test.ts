import { describe, expect, test } from "vitest";
import { densityRatio, isaTempC } from "./atmosphere";
import { CHART_EXAMPLE, MTOW_LB, liftoffKcas, takeoffGroundRoll25 } from "./takeoffGroundRoll25";

describe("Fig 5-11 25° flap takeoff ground roll", () => {
  test("reproduces the chart's printed worked example within 3%", () => {
    const r = takeoffGroundRoll25(CHART_EXAMPLE);
    expect(r.groundRollFt).toBeGreaterThan(975 * 0.97);
    expect(r.groundRollFt).toBeLessThan(975 * 1.03);
    // printed 48 KIAS; the √W model gives 49.1 (documented +1.1 kt drafting tolerance)
    expect(Math.abs(r.vLofKcas - 48)).toBeLessThan(1.5);
    expect(r.warnings).toEqual([]);
  });

  test("matches the chart's dashed intermediate trace", () => {
    const r = takeoffGroundRoll25(CHART_EXAMPLE);
    expect(Math.abs(r.s0Ft - 1495)).toBeLessThan(1495 * 0.02);
    expect(Math.abs(r.s1Ft - 1220)).toBeLessThan(1220 * 0.02);
  });

  test("sea-level ISA MTOW baseline", () => {
    const r = takeoffGroundRoll25({
      pressureAltitudeFt: 0,
      oatC: isaTempC(0),
      weightLb: MTOW_LB,
      windKt: 0,
    });
    expect(r.groundRollFt).toBeGreaterThan(950);
    expect(r.groundRollFt).toBeLessThan(1150);
    expect(r.vLofKcas).toBe(52);
  });

  test("headwind shortens, tailwind lengthens — tailwind penalty dominates", () => {
    const base = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300 };
    const calm = takeoffGroundRoll25({ ...base, windKt: 0 }).groundRollFt;
    const head = takeoffGroundRoll25({ ...base, windKt: 5 }).groundRollFt;
    const tail = takeoffGroundRoll25({ ...base, windKt: -5 }).groundRollFt;
    expect(head).toBeLessThan(calm);
    expect(tail).toBeGreaterThan(calm);
    expect(tail - calm).toBeGreaterThan(calm - head);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(takeoffGroundRoll25({ pressureAltitudeFt: 8000, oatC: 20, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    // 1600 lb is on the chart — the curves run a division past their last
    // labelled tick — so only below that should warn.
    expect(takeoffGroundRoll25({ pressureAltitudeFt: 0, oatC: 15, weightLb: 1600, windKt: 0 }).warnings).toEqual([]);
    expect(takeoffGroundRoll25({ pressureAltitudeFt: 0, oatC: 15, weightLb: 1550, windKt: 0 }).warnings.length).toBeGreaterThan(0);
  });

  test("V_LOF ∝ √W anchors", () => {
    expect(liftoffKcas(2440)).toBe(52);
    expect(liftoffKcas(1700)).toBeCloseTo(43.4, 1);
  });
});

describe("atmosphere", () => {
  test("σ = 1 at sea level ISA", () => {
    expect(densityRatio(0, 15)).toBeCloseTo(1, 6);
  });
  test("σ ≈ 0.8106 at 7000 ft ISA", () => {
    expect(densityRatio(7000, isaTempC(7000))).toBeCloseTo(0.811, 2);
  });
});
