import { describe, expect, test } from "vitest";
import { casFromIas, iasFromCas } from "./airspeed";
import { airspeedCalibration } from "./airspeedCalibration";

describe("Fig 5-3 airspeed system calibration (shared model/airspeed.ts)", () => {
  test("worked-example anchors: Fig 5-3 prints no example box — validated against Fig 5-5 stall anchors within 0.5%", () => {
    // fig_5_03.json workedExample: 44.1 KIAS flaps 40 ↔ 50.2 KCAS (model 50.43,
    // +0.46%); flaps-up check 50.2 KIAS ↔ 56.1 KCAS (model 56.05, −0.1%).
    expect(Math.abs(casFromIas(44.1, "deg40") - 50.2) / 50.2).toBeLessThan(0.005);
    expect(Math.abs(casFromIas(50.2, "up") - 56.1) / 56.1).toBeLessThan(0.005);
  });

  // Digitized samples from fig_5_03.json "curves" (fit rms 0.23 kt vs the
  // drawn lines; the quadratic reproduces these samples to <0.01 kt — assert
  // ±0.3 kt). [KIAS, KCAS]
  const golden: { flaps: "up" | "deg40"; points: [number, number][] }[] = [
    {
      flaps: "up",
      points: [
        [60, 64.12],
        [70, 72.49],
        [80, 80.99],
        [90, 89.61],
        [100, 98.36],
        [110, 107.24],
        [120, 116.24],
        [130, 125.37],
        [140, 134.63],
        [155, 148.75],
      ],
    },
    {
      flaps: "deg40",
      points: [
        [45, 51.07],
        [55, 58.39],
        [65, 66.12],
        [75, 74.26],
        [85, 82.8],
        [95, 91.76],
        [100, 96.39],
      ],
    },
  ];

  test.each(golden)("golden digitized points — flaps $flaps", ({ flaps, points }) => {
    for (const [ias, cas] of points) {
      expect(Math.abs(casFromIas(ias, flaps) - cas), `IAS=${ias}`).toBeLessThan(0.3);
    }
  });

  test("inverse round-trips within 0.05 kt across the drawn range", () => {
    for (let ias = 60; ias <= 155; ias += 5) {
      expect(iasFromCas(casFromIas(ias, "up"), "up")).toBeCloseTo(ias, 1);
    }
    for (let ias = 45; ias <= 100; ias += 5) {
      expect(iasFromCas(casFromIas(ias, "deg40"), "deg40")).toBeCloseTo(ias, 1);
    }
  });

  test("CAS = IAS crossings at ~87 KIAS flaps up, ~71 KIAS flaps 40 (FINDINGS.md)", () => {
    expect(casFromIas(87, "up")).toBeCloseTo(87, 0);
    expect(Math.abs(casFromIas(87, "up") - 87)).toBeLessThan(0.5);
    expect(Math.abs(casFromIas(71, "deg40") - 71)).toBeLessThan(0.5);
  });

  test("flaps-40 line ends at Vfe 103 and merges into flaps up", () => {
    expect(casFromIas(110, "deg40")).toBe(casFromIas(110, "up"));
  });

  test("directions agree: casToIas inverts iasToCas", () => {
    const fwd = airspeedCalibration({ speedKt: 100, direction: "iasToCas", flaps: "up" });
    const back = airspeedCalibration({ speedKt: fwd.casKt, direction: "casToIas", flaps: "up" });
    expect(back.iasKt).toBeCloseTo(100, 2);
    expect(fwd.positionErrorKt).toBeCloseTo(fwd.casKt - 100, 6);
  });

  test("envelope warnings fire off the drawn lines", () => {
    expect(airspeedCalibration({ speedKt: 45, direction: "iasToCas", flaps: "up" }).warnings.length).toBeGreaterThan(0);
    expect(airspeedCalibration({ speedKt: 170, direction: "iasToCas", flaps: "up" }).warnings.length).toBeGreaterThan(0);
    expect(airspeedCalibration({ speedKt: 110, direction: "iasToCas", flaps: "deg40" }).warnings.length).toBeGreaterThan(0);
    expect(airspeedCalibration({ speedKt: 40, direction: "iasToCas", flaps: "deg40" }).warnings.length).toBeGreaterThan(0);
    expect(airspeedCalibration({ speedKt: 100, direction: "iasToCas", flaps: "up" }).warnings).toEqual([]);
    expect(airspeedCalibration({ speedKt: 80, direction: "casToIas", flaps: "deg40" }).warnings).toEqual([]);
  });
});
