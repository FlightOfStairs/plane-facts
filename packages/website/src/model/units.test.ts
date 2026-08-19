import { describe, expect, test } from "vitest";
import { LB_PER_US_GAL, convert, fromPounds, toPounds } from "./units";

describe("unit conversions", () => {
  test("avgas at SG 0.72 matches the POH loading graph's 6 lb/gal", () => {
    expect(LB_PER_US_GAL).toBeCloseTo(6.009, 3);
    // 48 US gal usable: POH's 6 lb/gal gives 288 lb
    expect(toPounds(48, "usgal")).toBeCloseTo(288.4, 1);
    expect(Math.abs(toPounds(48, "usgal") - 288) / 288).toBeLessThan(0.002);
  });

  test("weight conversions round-trip", () => {
    for (const lb of [1, 170, 340, 1500]) {
      expect(convert(convert(lb, "lb", "kg"), "kg", "lb")).toBeCloseTo(lb, 9);
    }
    expect(convert(340, "lb", "kg")).toBeCloseTo(154.2, 1);
  });

  test("volume conversions round-trip and agree via pounds", () => {
    expect(convert(48, "usgal", "l")).toBeCloseTo(181.7, 1);
    expect(convert(convert(48, "usgal", "l"), "l", "usgal")).toBeCloseTo(48, 9);
    expect(toPounds(181.7, "l")).toBeCloseTo(toPounds(48, "usgal"), 1);
  });

  test("fromPounds inverts toPounds for every unit", () => {
    for (const u of ["lb", "kg", "usgal", "l"] as const) {
      expect(fromPounds(toPounds(12.5, u), u)).toBeCloseTo(12.5, 9);
    }
  });
});
