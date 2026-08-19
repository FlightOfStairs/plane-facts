import { describe, expect, test } from "vitest";
import { cruisePerformance } from "./cruisePerformance";
import { enduranceHr, rangeNm } from "./rangeEndurance";
import { interpolateByPower } from "./shared";

describe("interpolateByPower", () => {
  test("is exact at the three printed power settings", () => {
    expect(interpolateByPower(55, 10, 20, 45)).toBe(10);
    expect(interpolateByPower(65, 10, 20, 45)).toBe(20);
    expect(interpolateByPower(75, 10, 20, 45)).toBe(45);
  });

  test("clamps below 55% — the charts publish nothing lower", () => {
    expect(interpolateByPower(40, 10, 20, 45)).toBe(10);
    expect(interpolateByPower(0, 10, 20, 45)).toBe(10);
  });

  test("above 75% continues on the power law the printed values imply", () => {
    // increasing quantity (e.g. TAS) keeps rising, smoothly past the last node
    const v80 = interpolateByPower(80, 95, 105, 113);
    expect(v80).toBeGreaterThan(113);
    expect(v80).toBeLessThan(113 * 1.1);
    // decreasing quantity (e.g. range) keeps falling
    expect(interpolateByPower(85, 514, 500, 474)).toBeLessThan(474);
  });

  test("stays monotonic and bracketed between neighbouring settings", () => {
    for (let pct = 55; pct <= 75; pct += 0.5) {
      const v = interpolateByPower(pct, 10, 20, 45);
      const [lo, hi] = pct <= 65 ? [10, 20] : [20, 45];
      expect(v).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(v).toBeLessThanOrEqual(hi + 1e-9);
    }
  });

  test("reproduces a straight line exactly (no spurious curvature)", () => {
    expect(interpolateByPower(60, 0, 10, 20)).toBeCloseTo(5, 12);
    expect(interpolateByPower(70, 0, 10, 20)).toBeCloseTo(15, 12);
  });
});

describe("continuous power across the chart models", () => {
  const cruise = (powerPct: number) => cruisePerformance({ pressureAltitudeFt: 5000, oatC: 16, powerPct, mixture: "bestPower", wheelFairings: true });

  test("cruise TAS at 60% and 70% lies between the printed curves", () => {
    const [t55, t60, t65, t70, t75] = [55, 60, 65, 70, 75].map((p) => cruise(p).tasPowerCurveKt);
    expect(t60).toBeGreaterThan(t55!);
    expect(t60).toBeLessThan(t65!);
    expect(t70).toBeGreaterThan(t65!);
    expect(t70).toBeLessThan(t75!);
  });

  test("cruise fuel flow interpolates through the printed GPH table", () => {
    expect(cruise(55).fuelGph).toBeCloseTo(7.8, 6);
    expect(cruise(65).fuelGph).toBeCloseTo(8.8, 6);
    expect(cruise(75).fuelGph).toBeCloseTo(10.0, 6);
    expect(cruise(60).fuelGph).toBeGreaterThan(7.8);
    expect(cruise(60).fuelGph).toBeLessThan(8.8);
  });

  test("range and endurance move the right way between printed settings", () => {
    const r = (power: number) => rangeNm({ mixture: "bestPower", power, reserve: "reserve45", pressureAltFt: 5000, oatC: 16 }).rangeNm;
    const e = (power: number) => enduranceHr({ power, reserve: "reserve45", pressureAltFt: 5000 }).enduranceHr;
    // more power ⇒ shorter range and less endurance
    expect(r(60)).toBeLessThan(r(55));
    expect(r(60)).toBeGreaterThan(r(65));
    expect(e(70)).toBeLessThan(e(65));
    expect(e(70)).toBeGreaterThan(e(75));
  });
});
