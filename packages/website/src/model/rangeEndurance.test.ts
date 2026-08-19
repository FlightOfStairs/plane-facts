import { describe, expect, test } from "vitest";
import { isaTempC } from "./atmosphere";
import type { Mixture, PowerPct, ReservePolicy } from "./rangeEndurance";
import { CHART_EXAMPLE_5_25, CHART_EXAMPLE_5_27, CHART_EXAMPLE_5_29, enduranceHr, impliedBlockTasKt, rangeNm } from "./rangeEndurance";

/** Range at standard temperature (pure curve read, no temp correction). */
function stdRange(mixture: Mixture, reserve: ReservePolicy, power: PowerPct, pa: number) {
  return rangeNm({ mixture, power, reserve, pressureAltFt: pa, oatC: isaTempC(pa) });
}

describe("Fig 5-25 best power mixture range", () => {
  test("reproduces the printed worked example within 0.5% (fit achieved 0.23%)", () => {
    // 5000 ft, 16 °C (11 above std), 75%: printed 501 + 6.6 = 507.6 nm reserve,
    // 561 + 6.6 = 567.6 nm no reserve.
    const res = rangeNm(CHART_EXAMPLE_5_25);
    expect(Math.abs(res.rangeNm - 507.6) / 507.6).toBeLessThan(0.005);
    expect(Math.abs(res.baseRangeNm - 501) / 501).toBeLessThan(0.005);
    const noRes = rangeNm({ ...CHART_EXAMPLE_5_25, reserve: "noReserve" });
    expect(Math.abs(noRes.rangeNm - 567.6) / 567.6).toBeLessThan(0.005);
    expect(res.deltaIsaC).toBeCloseTo(10.9, 1);
    expect(res.warnings).toEqual([]);
  });

  // Digitized samples from fig_5_25.json "curves" (chart units, std temp).
  // Curve rms ≤ 0.149%; assert within 0.5%.
  const golden: [ReservePolicy, PowerPct, number, number][] = [
    ["reserve45", 75, 500, 476.8],
    ["reserve45", 75, 5000, 501.6],
    ["reserve45", 75, 9000, 524.6],
    ["reserve45", 65, 6000, 524.4],
    ["reserve45", 65, 12000, 549.7],
    ["reserve45", 55, 500, 515.5],
    ["reserve45", 55, 12000, 561.6],
    ["noReserve", 75, 5000, 559.5],
    ["noReserve", 75, 9000, 588.4],
    ["noReserve", 65, 500, 561.0],
    ["noReserve", 65, 13000, 615.9],
    ["noReserve", 55, 6500, 604.3],
    ["noReserve", 55, 13000, 630.8],
  ];
  test.each(golden)("golden point %s %i%% @ %i ft → %f nm", (reserve, power, pa, nm) => {
    const r = stdRange("bestPower", reserve, power, pa);
    expect(Math.abs(r.baseRangeNm - nm) / nm).toBeLessThan(0.005);
  });

  test("temperature correction is two-sided: −1.0 nm/°C below std, +0.6 above", () => {
    const base = stdRange("bestPower", "reserve45", 65, 4000);
    const warm = rangeNm({ mixture: "bestPower", power: 65, reserve: "reserve45", pressureAltFt: 4000, oatC: isaTempC(4000) + 10 });
    const cold = rangeNm({ mixture: "bestPower", power: 65, reserve: "reserve45", pressureAltFt: 4000, oatC: isaTempC(4000) - 10 });
    expect(warm.rangeNm - base.rangeNm).toBeCloseTo(6, 5);
    expect(cold.rangeNm - base.rangeNm).toBeCloseTo(-10, 5);
  });
});

describe("Fig 5-27 best economy mixture range", () => {
  test("reproduces the printed worked example within 0.5% (fit achieved 0.09%)", () => {
    // 5000 ft, 16 °C, 75%: printed 567 + 7.7 = 574.7 nm reserve, 635 + 7.7 = 642.7 no reserve.
    const res = rangeNm(CHART_EXAMPLE_5_27);
    expect(Math.abs(res.rangeNm - 574.7) / 574.7).toBeLessThan(0.005);
    const noRes = rangeNm({ ...CHART_EXAMPLE_5_27, reserve: "noReserve" });
    expect(Math.abs(noRes.rangeNm - 642.7) / 642.7).toBeLessThan(0.005);
    expect(res.warnings).toEqual([]);
  });

  // Digitized samples from fig_5_27.json "curves". Curve rms ≤ 0.106%; assert within 0.5%.
  const golden: [ReservePolicy, PowerPct, number, number][] = [
    ["reserve45", 75, 500, 541.7],
    ["reserve45", 75, 10000, 596.1],
    ["reserve45", 65, 6000, 599.7],
    ["reserve45", 65, 12000, 629.4],
    ["reserve45", 55, 500, 587.7],
    ["reserve45", 55, 12000, 641.3],
    ["noReserve", 75, 5000, 634.5],
    ["noReserve", 75, 10000, 667.6],
    ["noReserve", 65, 13000, 711.2],
    ["noReserve", 55, 500, 656.7],
    ["noReserve", 55, 7000, 689.4],
    ["noReserve", 55, 13000, 720.5],
  ];
  test.each(golden)("golden point %s %i%% @ %i ft → %f nm", (reserve, power, pa, nm) => {
    const r = stdRange("bestEconomy", reserve, power, pa);
    expect(Math.abs(r.baseRangeNm - nm) / nm).toBeLessThan(0.005);
  });

  test("best economy beats best power at equal nominal %power (FINDINGS: 13–16% at equal settings)", () => {
    for (const power of [55, 65, 75] as const) {
      for (const pa of [0, 4000, 8000]) {
        const be = stdRange("bestEconomy", "reserve45", power, pa).baseRangeNm;
        const bp = stdRange("bestPower", "reserve45", power, pa).baseRangeNm;
        expect(be / bp).toBeGreaterThan(1.05);
        expect(be / bp).toBeLessThan(1.25);
      }
    }
  });
});

describe("Fig 5-29 endurance", () => {
  test("reproduces the printed worked example within 1% (fit achieved 0.54%)", () => {
    // 5000 ft, 75% best economy: printed 4.85 hr reserve, 5.45 hr no reserve.
    const res = enduranceHr(CHART_EXAMPLE_5_29);
    expect(Math.abs(res.enduranceHr - 4.85) / 4.85).toBeLessThan(0.01);
    const noRes = enduranceHr({ ...CHART_EXAMPLE_5_29, reserve: "noReserve" });
    expect(Math.abs(noRes.enduranceHr - 5.45) / 5.45).toBeLessThan(0.01);
    expect(res.warnings).toEqual([]);
  });

  // Digitized samples from fig_5_29.json "curves" (quadratic fit, rms ≈ 0).
  const golden: [ReservePolicy, PowerPct, number, number][] = [
    ["reserve45", 75, 500, 4.916],
    ["reserve45", 75, 9000, 4.761],
    ["reserve45", 65, 6000, 5.414],
    ["reserve45", 65, 11500, 5.35],
    ["reserve45", 55, 500, 6.383],
    ["reserve45", 55, 11500, 6.145],
    ["noReserve", 75, 5000, 5.438],
    ["noReserve", 75, 11500, 5.376],
    ["noReserve", 65, 500, 6.246],
    ["noReserve", 65, 11500, 6.125],
    ["noReserve", 55, 5000, 6.945],
    ["noReserve", 55, 11500, 6.726],
  ];
  test.each(golden)("golden point %s %i%% @ %i ft → %f hr", (reserve, power, pa, hr) => {
    const r = enduranceHr({ power, reserve, pressureAltFt: pa });
    expect(Math.abs(r.enduranceHr - hr) / hr).toBeLessThan(0.003);
  });
});

describe("cross-chart invariants", () => {
  test("lower power → more range and more endurance; no-reserve > reserve", () => {
    for (const mixture of ["bestPower", "bestEconomy"] as const) {
      for (const pa of [0, 5000, 9000]) {
        const r55 = stdRange(mixture, "reserve45", 55, pa).baseRangeNm;
        const r65 = stdRange(mixture, "reserve45", 65, pa).baseRangeNm;
        const r75 = stdRange(mixture, "reserve45", 75, pa).baseRangeNm;
        expect(r55).toBeGreaterThan(r65);
        expect(r65).toBeGreaterThan(r75);
        expect(stdRange(mixture, "noReserve", 65, pa).baseRangeNm).toBeGreaterThan(r65);
      }
    }
    for (const pa of [0, 5000, 9000]) {
      const e55 = enduranceHr({ power: 55, reserve: "reserve45", pressureAltFt: pa }).enduranceHr;
      const e65 = enduranceHr({ power: 65, reserve: "reserve45", pressureAltFt: pa }).enduranceHr;
      const e75 = enduranceHr({ power: 75, reserve: "reserve45", pressureAltFt: pa }).enduranceHr;
      expect(e55).toBeGreaterThan(e65);
      expect(e65).toBeGreaterThan(e75);
      expect(enduranceHr({ power: 65, reserve: "noReserve", pressureAltFt: pa }).enduranceHr).toBeGreaterThan(e65);
    }
  });

  test("implied average block TAS = range/endurance is a plausible 80–135 kt everywhere", () => {
    for (const reserve of ["reserve45", "noReserve"] as const) {
      for (const power of [55, 65, 75] as const) {
        for (const pa of [0, 3000, 6000, 9000]) {
          const r = stdRange("bestEconomy", reserve, power, pa).baseRangeNm;
          const e = enduranceHr({ power, reserve, pressureAltFt: pa }).enduranceHr;
          const tas = impliedBlockTasKt(r, e);
          expect(tas).toBeGreaterThan(80);
          expect(tas).toBeLessThan(135);
        }
      }
    }
  });

  test("envelope warnings fire outside the drawn curves", () => {
    expect(rangeNm({ ...CHART_EXAMPLE_5_25, pressureAltFt: 10000 }).warnings.length).toBeGreaterThan(0); // 75% ends at 9000
    expect(rangeNm({ ...CHART_EXAMPLE_5_27, pressureAltFt: 11000 }).warnings.length).toBeGreaterThan(0); // 75% ends at 10000
    expect(rangeNm({ ...CHART_EXAMPLE_5_25, pressureAltFt: -500 }).warnings.length).toBeGreaterThan(0);
    expect(enduranceHr({ ...CHART_EXAMPLE_5_29, pressureAltFt: 9500 }).warnings.length).toBeGreaterThan(0); // 75% reserve ends at 9000
    expect(enduranceHr({ power: 55, reserve: "noReserve", pressureAltFt: 12000 }).warnings.length).toBeGreaterThan(0);
    expect(enduranceHr({ power: 55, reserve: "noReserve", pressureAltFt: 8000 }).warnings).toEqual([]);
  });
});
