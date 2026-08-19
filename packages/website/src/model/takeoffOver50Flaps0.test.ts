import { describe, expect, test } from "vitest";
import { takeoffGroundRoll0 } from "./takeoffGroundRoll0";
import { CHART_EXAMPLE_5_09, MTOW_LB, barrierFlaps0Kias, liftoffOver50Flaps0Kias, takeoffOver50Flaps0, weightFactorFlaps0 } from "./takeoffOver50Flaps0";

describe("Fig 5-9 0° flap takeoff over 50 ft barrier", () => {
  test("reproduces the chart's printed worked example within 4% (fit achieved −3.4%; the printed trace itself sits 1–2.5% above the chart's guides)", () => {
    const r = takeoffOver50Flaps0(CHART_EXAMPLE_5_09);
    expect(r.distanceOver50Ft).toBeGreaterThan(2100 * 0.96);
    expect(r.distanceOver50Ft).toBeLessThan(2100 * 1.04);
    // printed speeds 50 / 55 KIAS; linear strips give 50.1 / 54.9
    expect(Math.abs(r.vLofKias - 50)).toBeLessThan(0.5);
    expect(Math.abs(r.v50Kias - 55)).toBeLessThan(0.5);
    expect(r.warnings).toEqual([]);
  });

  test("matches the chart's dashed intermediate trace within 3%", () => {
    const r = takeoffOver50Flaps0(CHART_EXAMPLE_5_09);
    expect(Math.abs(r.s0Ft - 2803)).toBeLessThan(2803 * 0.03);
    expect(Math.abs(r.s1Ft - 2553)).toBeLessThan(2553 * 0.03);
  });

  // Digitized samples from tools/digitize/out/fits/fig_5_09.json "curves"
  // (panel 1: [OAT °C, ft] at 2440 lb calm). Fit rms 0.95% → assert 3%.
  const panel1Golden: [number, number, number][] = [
    [0, 10.4, 1925],
    [0, 29.1, 2372],
    [3000, 1.2, 2555],
    [3000, 22.6, 3152],
    [5000, -13.3, 2842],
    [5000, 10.7, 3592],
    [5000, 29.2, 4235],
    [7000, -15.0, 3522],
  ];
  test.each(panel1Golden)("panel 1 golden point: PA %d ft, OAT %d °C → %d ft", (pa, oat, expected) => {
    const r = takeoffOver50Flaps0({ pressureAltitudeFt: pa, oatC: oat, weightLb: MTOW_LB, windKt: 0 });
    expect(Math.abs(r.s0Ft - expected)).toBeLessThan(expected * 0.03);
  });

  // Panel 2 weight guides: [D_ref at 2440 lb, weight, digitized ft]. rms 0.87% → assert 3%.
  const panel2Golden: [number, number, number][] = [
    [4405, 2038, 2938],
    [4405, 1708, 1875],
    [3162, 2130, 2278],
    [2575, 2145, 1875],
    [2575, 1765, 1108],
    [1958, 1846, 938],
  ];
  test.each(panel2Golden)("panel 2 golden point: D_ref %d ft @ %d lb → %d ft", (dRef, w, expected) => {
    expect(Math.abs(dRef * weightFactorFlaps0(w, dRef) - expected)).toBeLessThan(expected * 0.03);
  });

  // Panel 3 guides: [D0 at ref line, wind kt, digitized ft]. Head rms 0.67%,
  // tail rms 1.14% → assert 2.5% head / 4% tail. (The chart's bottom 500-ft
  // headwind guide is a drafting error, excluded from the fit.)
  test("panel 3 headwind guide golden points", () => {
    const f = (d0: number, vw: number) => {
      // oxlint-disable-next-line approx-constant -- fitted exponent, coincidentally ≈ log2(e)
      const m = 1.442 - 0.227 * Math.log(d0 / 2500);
      return d0 * Math.pow(1 - (0.5 * vw) / 57, m);
    };
    expect(Math.abs(f(3008, 7.34) - 2732)).toBeLessThan(2732 * 0.025);
    expect(Math.abs(f(3008, 14.88) - 2472)).toBeLessThan(2472 * 0.025);
    expect(Math.abs(f(1508, 14.88) - 1198)).toBeLessThan(1198 * 0.025);
  });
  test("panel 3 tailwind guide golden points", () => {
    const f = (d0: number, vw: number) => {
      const m = 1.618 - 0.559 * Math.log(d0 / 2500);
      return d0 * Math.pow(1 + (1.5 * vw) / 57, m);
    };
    expect(Math.abs(f(2478, 4.76) - 2955)).toBeLessThan(2955 * 0.04);
    expect(Math.abs(f(1978, 2.57) - 2208)).toBeLessThan(2208 * 0.04);
  });

  test("FINDINGS invariant: barrier speed ≈ 1.10 × lift-off across the weight range", () => {
    for (const w of [1700, 2000, 2200, 2440]) {
      const ratio = barrierFlaps0Kias(w) / liftoffOver50Flaps0Kias(w);
      expect(ratio).toBeGreaterThan(1.08);
      expect(ratio).toBeLessThan(1.12);
    }
  });

  test("distance over 50 ft exceeds the Fig 5-7 ground roll at equal conditions", () => {
    const inp = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300, windKt: 0 };
    expect(takeoffOver50Flaps0(inp).distanceOver50Ft).toBeGreaterThan(takeoffGroundRoll0(inp).groundRollFt);
  });

  test("FINDINGS invariant: relative wind effect is stronger at shorter distances", () => {
    const short = takeoffOver50Flaps0({ pressureAltitudeFt: 0, oatC: -20, weightLb: 1800, windKt: 15 });
    const long = takeoffOver50Flaps0({ pressureAltitudeFt: 7000, oatC: 30, weightLb: 2440, windKt: 15 });
    expect(short.windFactor).toBeLessThan(long.windFactor);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(takeoffOver50Flaps0({ pressureAltitudeFt: 8000, oatC: 20, weightLb: 2440, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffOver50Flaps0({ pressureAltitudeFt: 0, oatC: 15, weightLb: 1600, windKt: 0 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffOver50Flaps0({ pressureAltitudeFt: 0, oatC: 15, weightLb: 2440, windKt: 20 }).warnings.length).toBeGreaterThan(0);
    expect(takeoffOver50Flaps0({ pressureAltitudeFt: 7000, oatC: 40, weightLb: 2440, windKt: -5 }).warnings.length).toBeGreaterThan(0); // off the drawn distance scale
  });

  test("tailwind penalty dominates headwind benefit", () => {
    const base = { pressureAltitudeFt: 2000, oatC: 20, weightLb: 2300 };
    const calm = takeoffOver50Flaps0({ ...base, windKt: 0 }).distanceOver50Ft;
    const head = takeoffOver50Flaps0({ ...base, windKt: 5 }).distanceOver50Ft;
    const tail = takeoffOver50Flaps0({ ...base, windKt: -5 }).distanceOver50Ft;
    expect(head).toBeLessThan(calm);
    expect(tail).toBeGreaterThan(calm);
    expect(tail - calm).toBeGreaterThan(calm - head);
  });
});
