import { describe, expect, test } from "vitest";
import { isaTempC } from "./atmosphere";
import { CHART_EXAMPLE, climbFuelTimeDistance, climbLeg, climbYPx } from "./climbFuelTimeDistance";

describe("Fig 5-19 fuel, time and distance to climb", () => {
  test("reproduces the chart's printed worked example within the fit's −6…−2%", () => {
    const r = climbFuelTimeDistance(CHART_EXAMPLE);
    // printed: 9 min, 12 nm, 2 gal; fit JSON model deltas 8.47 / 11.72 / 1.94
    // (errPct −5.8 / −2.3 / −3.0) → assert within 7%
    expect(Math.abs(r.timeMin - 9) / 9).toBeLessThan(0.07);
    expect(Math.abs(r.distNm - 12) / 12).toBeLessThan(0.07);
    expect(Math.abs(r.fuelGal - 2) / 2).toBeLessThan(0.07);
    // and the composition matches the fit JSON's own model outputs
    expect(r.timeMin).toBeCloseTo(8.47, 0);
    expect(r.distNm).toBeCloseTo(11.72, 0);
    expect(r.fuelGal).toBeCloseTo(1.94, 1);
    expect(r.cruise.timeMin).toBeCloseTo(11.83, 0);
    expect(r.cruise.distNm).toBeCloseTo(15.73, 0);
    expect(r.warnings).toEqual([]);
  });

  // Golden points copied from tools/digitize/out/fits/fig_5_19.json altitude
  // family ([OAT °C, y px] per PA curve). Surface fit rms is 3.4 px; assert
  // within ±15 px (worst mid-family digitized residual).
  const goldenY: [number, number, number][] = [
    // [PA ft, OAT °C, y px]
    [1000, -38.97, 1356.6],
    [1000, 39.63, 1327.9],
    [2000, 15.44, 1262.6],
    [3000, -0.68, 1204.6],
    [3000, 47.69, 1105.6],
    [4000, 25.52, 1065.7],
    [5000, -38.97, 1131.0],
    [5000, 15.44, 1006.9],
    [5000, 39.63, 886.0],
    [6000, 1.34, 974.1],
    [7000, -6.72, 925.9],
    [7000, 29.55, 712.7],
    [8000, 15.44, 714.6],
    [9000, -22.85, 842.0],
    [10000, -0.68, 636.1],
    [11000, -20.83, 651.7],
  ];
  test.each(goldenY)("golden altitude-family point PA %d ft, OAT %d °C → y %d px", (pa, oat, y) => {
    expect(Math.abs(climbYPx(pa, oat) - y)).toBeLessThan(15);
  });

  // Golden points from the three value curves ([value, y px]). Value fit rms
  // is 1.1–1.25%; the time curve's foot carries a ~0.2 min absolute residual,
  // so assert within max(0.3 units, 3%).
  const goldenValues: { key: "timeMin" | "distNm" | "fuelGal"; y: number; value: number }[] = [
    { key: "timeMin", y: 530, value: 49.61 },
    { key: "timeMin", y: 730, value: 25.18 },
    { key: "timeMin", y: 1005, value: 11.83 },
    { key: "timeMin", y: 1255, value: 4.46 },
    { key: "timeMin", y: 1380, value: 0.98 },
    { key: "distNm", y: 530, value: 73.7 },
    { key: "distNm", y: 730, value: 35.6 },
    { key: "distNm", y: 1005, value: 15.72 },
    { key: "distNm", y: 1255, value: 5.45 },
    { key: "distNm", y: 1380, value: 1.07 },
    { key: "fuelGal", y: 530, value: 8.35 },
    { key: "fuelGal", y: 730, value: 5.38 },
    { key: "fuelGal", y: 1005, value: 2.31 },
    { key: "fuelGal", y: 1255, value: 0.55 },
    { key: "fuelGal", y: 1380, value: 0.04 },
  ];
  // Recover a (PA, OAT) whose surface height equals the tabulated y by
  // bisecting PA at fixed OAT, then read the leg values.
  function paForY(targetY: number, oatC: number): number {
    let lo = 0;
    let hi = 12500;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (climbYPx(mid, oatC) > targetY) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  test.each(goldenValues.map((g) => [g.key, g.y, g.value] as const))("golden value-curve point %s at y=%d px → %d", (key, y, value) => {
    const pa = paForY(y, -20);
    expect(Math.abs(climbYPx(pa, -20) - y)).toBeLessThan(0.01); // bisection sanity
    const got = climbLeg(pa, -20)[key];
    expect(Math.abs(got - value)).toBeLessThan(Math.max(0.3, 0.03 * value));
  });

  test("FINDINGS invariant: cumulative lookups match the digitized chart grid within 5%", () => {
    // rows from the fit JSON integralConsistency grid: [PA ft, ISA dev °C, time min, dist nm]
    const grid: [number, number, number, number][] = [
      [2000, 0, 4.12, 5.0],
      [4000, -20, 7.49, 9.58],
      [4000, 15, 9.62, 12.58],
      [6000, 0, 13.06, 17.49],
      [8000, -20, 15.41, 20.92],
      [10000, -20, 21.41, 29.86],
      [10000, 0, 30.81, 44.28],
    ];
    for (const [pa, dT, time, dist] of grid) {
      const leg = climbLeg(pa, isaTempC(pa) + dT);
      expect(Math.abs(leg.timeMin - time) / time).toBeLessThan(0.05);
      expect(Math.abs(leg.distNm - dist) / dist).toBeLessThan(0.05);
    }
  });

  test("sea level lookups are ~0 and cumulative values grow with altitude", () => {
    const sl = climbLeg(0, 15);
    expect(sl.timeMin).toBeLessThan(0.8);
    expect(sl.distNm).toBeLessThan(1.0);
    expect(sl.fuelGal).toBeLessThan(0.2);
    let prev = sl;
    for (const pa of [2000, 4000, 6000, 8000, 10000]) {
      const leg = climbLeg(pa, isaTempC(pa));
      expect(leg.timeMin).toBeGreaterThan(prev.timeMin);
      expect(leg.distNm).toBeGreaterThan(prev.distNm);
      expect(leg.fuelGal).toBeGreaterThan(prev.fuelGal);
      prev = leg;
    }
  });

  test("envelope warnings fire outside the chart", () => {
    const base = CHART_EXAMPLE;
    expect(climbFuelTimeDistance({ ...base, cruisePaFt: 12000, cruiseOatC: -20 }).warnings.length).toBeGreaterThan(0);
    expect(climbFuelTimeDistance({ ...base, departureOatC: -45 }).warnings.length).toBeGreaterThan(0);
    // hot + high: curve family not drawn there
    expect(climbFuelTimeDistance({ ...base, cruisePaFt: 11000, cruiseOatC: 30 }).warnings.some((w) => w.includes("drawn curve"))).toBe(true);
  });

  test("cruise below departure warns and clamps the deltas to zero", () => {
    const r = climbFuelTimeDistance({ departurePaFt: 5000, departureOatC: 5, cruisePaFt: 2000, cruiseOatC: 11 });
    expect(r.warnings.some((w) => w.includes("below the departure"))).toBe(true);
    expect(r.timeMin).toBe(0);
    expect(r.distNm).toBe(0);
    expect(r.fuelGal).toBe(0);
  });
});
