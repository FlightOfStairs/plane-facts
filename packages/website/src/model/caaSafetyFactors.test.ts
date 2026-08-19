import { describe, expect, test } from "vitest";
import { SAFETY_DEFAULTS, safetyFactors } from "./caaSafetyFactors";

describe("CAA Safety Sense factors", () => {
  test("paved dry level runway with no general factor is a no-op", () => {
    const r = safetyFactors("takeoff", { ...SAFETY_DEFAULTS, generalFactor: false });
    expect(r.total).toBe(1);
    expect(r.terms).toEqual([]);
  });

  test("general factor alone matches the leaflet", () => {
    expect(safetyFactors("takeoff", SAFETY_DEFAULTS).total).toBeCloseTo(1.33, 6);
    expect(safetyFactors("landing", SAFETY_DEFAULTS).total).toBeCloseTo(1.43, 6);
  });

  test("surface factors match the leaflet table", () => {
    const bare = (op: "takeoff" | "landing", surface: Parameters<typeof safetyFactors>[1]["surface"]) => safetyFactors(op, { ...SAFETY_DEFAULTS, surface, generalFactor: false }).total;
    expect(bare("takeoff", "grassDry")).toBeCloseTo(1.2, 6);
    expect(bare("landing", "grassDry")).toBeCloseTo(1.15, 6);
    expect(bare("takeoff", "grassWet")).toBeCloseTo(1.3, 6);
    expect(bare("landing", "grassWet")).toBeCloseTo(1.35, 6);
    expect(bare("takeoff", "pavedWet")).toBe(1); // leaflet prints "–"
    expect(bare("landing", "pavedWet")).toBeCloseTo(1.15, 6);
    expect(bare("takeoff", "softOrSnow")).toBeCloseTo(1.25, 6);
    expect(bare("landing", "softOrSnow")).toBeCloseTo(1.25, 6);
  });

  test("adverse 2% slope is a step of ×1.1, never interpolated", () => {
    const f = (op: "takeoff" | "landing", adverseSlope: boolean) => safetyFactors(op, { ...SAFETY_DEFAULTS, adverseSlope, generalFactor: false }).total;
    expect(f("takeoff", true)).toBeCloseTo(1.1, 6);
    expect(f("landing", true)).toBeCloseTo(1.1, 6);
    expect(f("takeoff", false)).toBe(1);
    expect(f("landing", false)).toBe(1);
  });

  test("slope term names the direction that is adverse for the operation", () => {
    const term = (op: "takeoff" | "landing") => safetyFactors(op, { ...SAFETY_DEFAULTS, adverseSlope: true, generalFactor: false }).terms[0]?.label;
    expect(term("takeoff")).toBe("2% uphill slope");
    expect(term("landing")).toBe("2% downhill slope");
  });

  test("multiple factors multiply together, per the leaflet note", () => {
    const r = safetyFactors("takeoff", { surface: "grassDry", adverseSlope: true, generalFactor: true });
    expect(r.terms).toHaveLength(3);
    expect(r.total).toBeCloseTo(1.2 * 1.1 * 1.33, 6);
  });

  test("worst realistic landing case stays finite and ordered", () => {
    const r = safetyFactors("landing", { surface: "grassWet", adverseSlope: true, generalFactor: true });
    expect(r.total).toBeCloseTo(1.35 * 1.1 * 1.43, 6);
    expect(r.terms.at(-1)?.label).toBe("General safety factor");
  });
});
