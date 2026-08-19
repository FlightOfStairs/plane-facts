import { describe, expect, test } from "vitest";
import { casFromIas, iasFromCas } from "./airspeed";

describe("Fig 5-3 airspeed calibration", () => {
  test("anchors from Fig 5-5 at 2440 lb", () => {
    // flaps-40 stall: 44.1 KIAS ↔ ~50.1 KCAS; flaps-up 50.2 KIAS → ~56.1 KCAS
    expect(casFromIas(44.1, "deg40")).toBeCloseTo(50.4, 0);
    expect(casFromIas(50.2, "up")).toBeCloseTo(56.1, 0);
  });

  test("CAS = IAS crossings near the printed values", () => {
    expect(Math.abs(casFromIas(87, "up") - 87)).toBeLessThan(0.7);
    expect(Math.abs(casFromIas(71, "deg40") - 71)).toBeLessThan(0.7);
  });

  test("inverse round-trips within 0.1 kt", () => {
    for (const ias of [60, 80, 100, 120, 150]) {
      expect(iasFromCas(casFromIas(ias, "up"), "up")).toBeCloseTo(ias, 1);
    }
    for (const ias of [50, 70, 90]) {
      expect(iasFromCas(casFromIas(ias, "deg40"), "deg40")).toBeCloseTo(ias, 1);
    }
  });

  test("flaps-40 falls back to flaps-up above Vfe range", () => {
    expect(casFromIas(120, "deg40")).toBeCloseTo(casFromIas(120, "up"), 5);
  });
});
