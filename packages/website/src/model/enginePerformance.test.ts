import { describe, expect, test } from "vitest";
import { densityAltitudeFt, densityRatio, isaTempC } from "./atmosphere";
import { A_P, CHART_EXAMPLE, LEFT_FT_PER_UNIT, LEFT_INTERCEPT_U, RPM_PER_FT, aOfP, enginePerformance } from "./enginePerformance";

describe("Fig 5-15 engine performance", () => {
  test("reproduces the chart's printed worked example (fit achieved −0.01%; assert ±0.2%)", () => {
    // 5000 ft, 16 °C, 75% → printed 2625 RPM, 10.0 / 8.5 GPH
    const r = enginePerformance(CHART_EXAMPLE);
    expect(Math.abs(r.rpm - 2625)).toBeLessThan(2625 * 0.002);
    expect(Math.abs(r.densityAltitudeFt - 6263)).toBeLessThan(40);
    expect(r.fuelFlowBestPowerGph).toBe(10.0);
    expect(r.fuelFlowBestEconomyGph).toBe(8.5);
    expect(r.warnings).toEqual([]);
  });

  // Golden points copied from fig_5_15.json right-panel curves: [pct, rpm, u].
  // u (major squares) → DA via the fitted left-panel converter; the model RPM
  // must land within the right-panel fit rms (1.44 RPM) + margin ⇒ ±4.5 RPM.
  const rightGolden: [number, number, number][] = [
    [55, 2565.3, 7.962],
    [55, 2512.9, 6.814],
    [55, 2440.2, 5.2388],
    [55, 2378.7, 3.9306],
    [55, 2306.7, 2.4088],
    [55, 2266.3, 1.5011],
    [55, 2196.2, 0.0327],
    [65, 2566.3, 5.0052],
    [65, 2529.8, 4.2043],
    [65, 2477.0, 3.0295],
    [65, 2431.2, 2.015],
    [65, 2395.0, 1.2141],
    [65, 2340.2, 0.0394],
    [75, 2665.3, 4.004],
    [75, 2623.0, 3.0696],
    [75, 2597.9, 2.5356],
    [75, 2530.8, 1.0939],
    [75, 2481.7, 0.0527],
  ];
  test.each(rightGolden)("golden %i%% line: digitized (%f RPM, u=%f)", (pct, rpmSample, u) => {
    const da = (u - LEFT_INTERCEPT_U) * LEFT_FT_PER_UNIT;
    const rpmModel = aOfP(pct) + RPM_PER_FT * da;
    expect(Math.abs(rpmModel - rpmSample)).toBeLessThan(4.5);
  });

  // Golden points from the left-panel PA curves: [PA ft, OAT °C, u]. The
  // model's DA→u converter must land within the left-panel fit rms
  // (0.0196 major squares ≈ 40 ft) + margin ⇒ ±0.06 (~120 ft).
  const leftGolden: [number, number, number][] = [
    [0, 20.47, 0.3331],
    [0, 30.52, 0.9264],
    [-1000, 32.53, 0.4232],
    [2000, 10.28, 0.9449],
    [2000, 35.08, 2.3487],
    [5000, -30.2, 0.1962],
    [5000, 0.63, 2.2386],
    [5000, 30.12, 3.9166],
    [8000, -20.28, 2.7759],
    [8000, 20.47, 5.2121],
    [10000, 0.5, 5.3055],
    [12000, -30.33, 4.6681],
    [12000, 10.55, 7.0776],
    [16000, -30.33, 7.1344],
  ];
  test.each(leftGolden)("golden PA %i ft curve at %f °C (u=%f)", (pa, oat, uSample) => {
    const r = enginePerformance({ pressureAltitudeFt: pa, oatC: oat, pctPower: 65 });
    expect(Math.abs(r.u - uSample)).toBeLessThan(0.06);
  });

  test("a(p) hits the fitted intercepts exactly at 55/65/75 and interpolates between", () => {
    expect(aOfP(55)).toBe(A_P[55]);
    expect(aOfP(65)).toBe(A_P[65]);
    expect(aOfP(75)).toBe(A_P[75]);
    expect(aOfP(60)).toBeCloseTo((A_P[55] + A_P[65]) / 2, 10);
    expect(aOfP(70)).toBeCloseTo((A_P[65] + A_P[75]) / 2, 10);
  });

  test("fuel flow snaps to the nearest POH table column", () => {
    const base = { pressureAltitudeFt: 2000, oatC: 10 };
    expect(enginePerformance({ ...base, pctPower: 58 }).fuelFlowBestPowerGph).toBe(7.8);
    expect(enginePerformance({ ...base, pctPower: 62 }).fuelFlowBestPowerGph).toBe(8.8);
    expect(enginePerformance({ ...base, pctPower: 72 }).fuelFlowBestEconomyGph).toBe(8.5);
  });

  test("75% full-throttle ceiling: curve ends at DA 8008 ft / 2665 RPM (envelope.curveEndpoints)", () => {
    const rpmAtEnd = A_P[75] + RPM_PER_FT * 8008;
    expect(Math.abs(rpmAtEnd - 2665)).toBeLessThan(1);
    // 75% at ~10,000 ft DA is unreachable at full throttle → warning fires
    const r = enginePerformance({ pressureAltitudeFt: 10000, oatC: isaTempC(10000), pctPower: 75 });
    expect(r.densityAltitudeFt).toBeGreaterThan(8008);
    expect(r.fullThrottleLimited).toBe(true);
    expect(r.warnings.some((w) => w.includes("full throttle"))).toBe(true);
    // …while 55% at the same DA is still on the chart
    const r55 = enginePerformance({ pressureAltitudeFt: 10000, oatC: isaTempC(10000), pctPower: 55 });
    expect(r55.fullThrottleLimited).toBe(false);
  });

  test("envelope warnings fire outside the chart", () => {
    expect(enginePerformance({ pressureAltitudeFt: 17000, oatC: -20, pctPower: 55 }).warnings.length).toBeGreaterThan(0);
    expect(enginePerformance({ pressureAltitudeFt: 5000, oatC: 45, pctPower: 65 }).warnings.length).toBeGreaterThan(0);
    expect(enginePerformance({ pressureAltitudeFt: 2000, oatC: 10, pctPower: 80 }).warnings.length).toBeGreaterThan(0);
    // cold sea-level day → negative DA, below the chart's bottom border
    const cold = enginePerformance({ pressureAltitudeFt: 0, oatC: -20, pctPower: 65 });
    expect(cold.densityAltitudeFt).toBeLessThan(0);
    expect(cold.warnings.some((w) => w.includes("below"))).toBe(true);
  });

  test("invariants: RPM grows with DA and with %power; DA collapse uses shared ISA", () => {
    const lo = enginePerformance({ pressureAltitudeFt: 0, oatC: 15, pctPower: 65 });
    const hi = enginePerformance({ pressureAltitudeFt: 6000, oatC: 15, pctPower: 65 });
    expect(hi.rpm).toBeGreaterThan(lo.rpm);
    const p55 = enginePerformance({ pressureAltitudeFt: 3000, oatC: 10, pctPower: 55 });
    const p75 = enginePerformance({ pressureAltitudeFt: 3000, oatC: 10, pctPower: 75 });
    expect(p75.rpm).toBeGreaterThan(p55.rpm);
    // model DA must be exactly the shared atmosphere module's DA
    const sigma = densityRatio(6000, 15);
    expect(hi.densityAltitudeFt).toBeCloseTo(densityAltitudeFt(sigma), 8);
    // FINDINGS: true density-altitude collapse ⇒ temperature weight ≈ 119–121
    // ft-PA/°C (textbook 118.8), evaluated at the ISA point where dDA/dPA = 1.
    const isa = enginePerformance({ pressureAltitudeFt: 5000, oatC: isaTempC(5000), pctPower: 65 });
    const warm = enginePerformance({ pressureAltitudeFt: 5000, oatC: isaTempC(5000) + 1, pctPower: 65 });
    const ftPerC = warm.densityAltitudeFt - isa.densityAltitudeFt;
    expect(ftPerC).toBeGreaterThan(110);
    expect(ftPerC).toBeLessThan(130);
  });
});
