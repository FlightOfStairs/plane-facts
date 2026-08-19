import { describe, expect, test } from "vitest";
import { cubic, DIST_POLY, FUEL_POLY, TIME_POLY } from "../charts/fixtures/fig531Coeffs";
import { CHART_EXAMPLE, FUEL_TOLERANCE_GAL, descentFuelTimeDistance, effectiveAltitudeFt } from "./descentFuelTimeDistance";

describe("Fig 5-31 fuel, time and distance to descend", () => {
  test("reproduces the chart's printed worked example (fit achieved −3.1% time, +1.0% dist)", () => {
    const r = descentFuelTimeDistance(CHART_EXAMPLE);
    // printed 3.0 min; fit JSON reports 2.91 (−3.1%) — assert within 5%
    expect(Math.abs(r.timeMin - 3.0)).toBeLessThan(3.0 * 0.05);
    // printed 5.5 nm; fit JSON reports 5.56 (+1.0%) — assert within 2%
    expect(Math.abs(r.distNm - 5.5)).toBeLessThan(5.5 * 0.02);
    // printed 0.5 gal is a rounded read of a drawn ≈0.62; model 0.33 —
    // the chart's fuel scale is only meaningful to ±0.2 gal (FINDINGS.md)
    expect(Math.abs(r.fuelGal - 0.5)).toBeLessThanOrEqual(FUEL_TOLERANCE_GAL);
    // intermediate h_e values match the fit JSON's worked-example trace
    expect(r.cruise.effectiveAltitudeFt).toBeCloseTo(4456, 0);
    expect(r.destination.effectiveAltitudeFt).toBeCloseTo(2147, 0);
    // cumulative readings match the printed dashed-trace reads (~±0.5 unit)
    expect(Math.abs(r.cruise.timeMin - 7.5)).toBeLessThan(0.5);
    expect(Math.abs(r.destination.timeMin - 4.5)).toBeLessThan(0.5);
    expect(Math.abs(r.cruise.distNm - 13.5)).toBeLessThan(0.5);
    expect(Math.abs(r.destination.distNm - 8.0)).toBeLessThan(0.5);
    expect(r.warnings).toEqual([]);
  });

  // Digitized samples copied from tools/digitize/out/fits/fig_5_31.json
  // "curves" (PA-labelled altitude curves): [paFt, oatC, h_e ft]. Surface
  // rms is 164 ft; assert within 350 ft (~2σ).
  const surfaceGolden: [number, number, number][] = [
    [1000, 0.6, 1215],
    [2000, 0.6, 2359],
    [3000, -2.5, 3475],
    [4000, 3.4, 4123],
    [5000, 16.7, 4438],
    [5000, -14.6, 6557],
    [7000, -12.0, 8128],
    [8000, 25.4, 6450],
    [9000, -5.1, 9164],
    [10000, 20.6, 8107],
    [12000, 15.1, 9812],
  ];
  test.each(surfaceGolden)("h_e surface golden point: PA %d ft, OAT %d °C", (pa, oat, he) => {
    expect(Math.abs(effectiveAltitudeFt(pa, oat) - he)).toBeLessThan(350);
  });

  // Digitized samples from the cumulative value curves: [reading, h_e ft].
  // Curve rms 0.184 min / 0.161 nm / 0.082 gal; assert within rms + margin.
  const timeGolden: [number, number][] = [
    [2.53, 1095],
    [4.51, 2338],
    [8.16, 5547],
    [9.64, 7419],
    [11.01, 9772],
  ];
  test.each(timeGolden)("cumulative time golden point: %f min at h %d ft", (t, h) => {
    expect(Math.abs(cubic(TIME_POLY, h) - t)).toBeLessThan(0.35);
  });

  const distGolden: [number, number][] = [
    [9.4, 2780],
    [13.66, 4571],
    [17.31, 6296],
    [21.54, 8649],
    [24.66, 10494],
  ];
  test.each(distGolden)("cumulative distance golden point: %f nm at h %d ft", (d, h) => {
    expect(Math.abs(cubic(DIST_POLY, h) - d)).toBeLessThan(0.35);
  });

  const fuelGolden: [number, number][] = [
    [0.75, 2098],
    [1.09, 5053],
    [1.22, 7793],
    [1.29, 9384],
  ];
  test.each(fuelGolden)("cumulative fuel golden point: %f gal at h %d ft", (f, h) => {
    expect(Math.abs(cubic(FUEL_POLY, h) - f)).toBeLessThan(0.15);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(descentFuelTimeDistance({ cruisePressureAltitudeFt: 13000, cruiseOatC: 0, destPressureAltitudeFt: 0, destOatC: 15 }).warnings.length).toBeGreaterThan(0);
    expect(descentFuelTimeDistance({ cruisePressureAltitudeFt: 8000, cruiseOatC: 45, destPressureAltitudeFt: 0, destOatC: 15 }).warnings.length).toBeGreaterThan(0);
    expect(descentFuelTimeDistance({ cruisePressureAltitudeFt: 2000, cruiseOatC: 0, destPressureAltitudeFt: 5000, destOatC: 0 }).warnings.length).toBeGreaterThan(0);
  });

  test("inverted temperature sign (FINDINGS.md): warmer cruise ⇒ LESS time/dist/fuel", () => {
    const base = { cruisePressureAltitudeFt: 5000, destPressureAltitudeFt: 1000, destOatC: 13 };
    const cold = descentFuelTimeDistance({ ...base, cruiseOatC: -20 });
    const warm = descentFuelTimeDistance({ ...base, cruiseOatC: 30 });
    expect(warm.cruise.effectiveAltitudeFt).toBeLessThan(cold.cruise.effectiveAltitudeFt);
    expect(warm.timeMin).toBeLessThan(cold.timeMin);
    expect(warm.distNm).toBeLessThan(cold.distNm);
    expect(warm.fuelGal).toBeLessThan(cold.fuelGal);
  });

  test("difference mode composes exactly: (A→C) = (A→B) + (B→C)", () => {
    const oat = 0;
    const ab = descentFuelTimeDistance({ cruisePressureAltitudeFt: 9000, cruiseOatC: oat, destPressureAltitudeFt: 5000, destOatC: oat });
    const bc = descentFuelTimeDistance({ cruisePressureAltitudeFt: 5000, cruiseOatC: oat, destPressureAltitudeFt: 1000, destOatC: oat });
    const ac = descentFuelTimeDistance({ cruisePressureAltitudeFt: 9000, cruiseOatC: oat, destPressureAltitudeFt: 1000, destOatC: oat });
    expect(ab.timeMin + bc.timeMin).toBeCloseTo(ac.timeMin, 10);
    expect(ab.distNm + bc.distNm).toBeCloseTo(ac.distNm, 10);
    expect(ab.fuelGal + bc.fuelGal).toBeCloseTo(ac.fuelGal, 10);
  });
});
