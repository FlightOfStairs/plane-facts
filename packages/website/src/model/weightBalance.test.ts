import { describe, expect, test } from "vitest";
import { LIMITS, SAMPLE_PROBLEM, aftLimitIn, forwardLimitIn, weightAndBalance } from "./weightBalance";

describe("POH Fig 6-9 sample loading problem (page 6-11)", () => {
  const r = weightAndBalance(SAMPLE_PROBLEM);

  test("reproduces every printed moment", () => {
    const m = Object.fromEntries(r.rows.map((row) => [row.key, row.momentInLb]));
    expect(m.bew).toBeCloseTo(128850, 0);
    expect(m.front).toBeCloseTo(27370, 0);
    expect(m.rear).toBeCloseTo(40154, 0);
    expect(m.fuel).toBeCloseTo(25365, 0);
  });

  test("reproduces the printed ramp and take-off figures", () => {
    expect(r.ramp.weightLb).toBeCloseTo(2447, 0);
    expect(r.ramp.momentInLb).toBeCloseTo(221739, 0);
    expect(r.ramp.cgIn).toBeCloseTo(90.6, 1);
    expect(r.takeoff.weightLb).toBeCloseTo(2440, 0);
    expect(r.takeoff.momentInLb).toBeCloseTo(221074, 0);
    expect(r.takeoff.cgIn).toBeCloseTo(90.6, 1);
  });

  test("the sample loading is inside the envelope with no warnings", () => {
    expect(r.takeoff.withinEnvelope).toBe(true);
    expect(r.withinLimits).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  test("burning the fuel off moves the C.G. forward but stays legal", () => {
    expect(r.zeroFuel.weightLb).toBeCloseTo(2180, 0);
    expect(r.zeroFuel.cgIn).toBeLessThan(r.takeoff.cgIn);
    expect(r.zeroFuel.withinEnvelope).toBe(true);
  });
});

describe("C.G. limits (POH 2.13)", () => {
  test("forward limit is the tabulated cutout, not a constant", () => {
    expect(forwardLimitIn(1200, "normal")).toBeCloseTo(83.0, 6);
    expect(forwardLimitIn(1950, "normal")).toBeCloseTo(83.0, 6);
    expect(forwardLimitIn(2440, "normal")).toBeCloseTo(88.3, 6);
    // straight-line variation between the tabulated points
    expect(forwardLimitIn(2195, "normal")).toBeCloseTo((83.0 + 88.3) / 2, 2);
  });

  test("utility has its own, much shallower cutout", () => {
    expect(forwardLimitIn(1950, "utility")).toBeCloseTo(83.0, 6);
    expect(forwardLimitIn(2020, "utility")).toBeCloseTo(83.8, 6);
    // at a weight utility cannot reach, normal is far more restrictive forward
    expect(forwardLimitIn(2400, "normal")).toBeGreaterThan(forwardLimitIn(2020, "utility"));
  });

  test("aft limit is 93.0 at every weight", () => {
    for (const w of [1200, 1800, 2020, 2440]) {
      expect(aftLimitIn("normal")).toBe(93.0);
      expect(forwardLimitIn(w, "normal")).toBeLessThan(93.0);
    }
  });
});

describe("out-of-limits detection", () => {
  // Two large adults up front, full fuel, nothing aft: heavy enough that the
  // cutout has risen well above 83, and forward of it.
  const heavyFwd = weightAndBalance({
    ...SAMPLE_PROBLEM,
    frontSeatsLb: 500,
    rearSeatsLb: 0,
    baggageLb: 0,
    fuelLb: 288,
  });

  test("a nose-heavy load at high weight is caught by the cutout, not by 83.0", () => {
    // C.G. sits above 83 but below the forward limit that applies at this weight
    expect(heavyFwd.takeoff.cgIn).toBeGreaterThan(83.0);
    expect(heavyFwd.takeoff.cgIn).toBeLessThan(heavyFwd.takeoff.fwdLimitIn);
    expect(heavyFwd.takeoff.withinEnvelope).toBe(false);
    expect(heavyFwd.warnings.join(" ")).toMatch(/forward of the/);
  });

  test("aft C.G. is caught", () => {
    const r = weightAndBalance({ ...SAMPLE_PROBLEM, frontSeatsLb: 0, rearSeatsLb: 340, baggageLb: 200, fuelLb: 100 });
    expect(r.takeoff.cgIn).toBeGreaterThan(93.0);
    expect(r.warnings.join(" ")).toMatch(/aft of the/);
    expect(r.withinLimits).toBe(false);
  });

  test("overweight is reported against ramp and take-off limits", () => {
    const r = weightAndBalance({ ...SAMPLE_PROBLEM, baggageLb: 200, fuelLb: 288 });
    expect(r.ramp.weightLb).toBeGreaterThan(LIMITS.normal.maxRampLb);
    expect(r.warnings.join(" ")).toMatch(/ramp weight .* exceeds/);
    expect(r.warnings.join(" ")).toMatch(/take-off weight .* exceeds/);
  });

  test("utility category forbids baggage and rear passengers", () => {
    const r = weightAndBalance({ ...SAMPLE_PROBLEM, category: "utility", baggageLb: 50, fuelLb: 100, rearSeatsLb: 80 });
    expect(r.warnings.join(" ")).toMatch(/no baggage/);
    expect(r.warnings.join(" ")).toMatch(/no rear-seat passengers/);
  });

  test("zero-fuel point is checked too, not just take-off", () => {
    // heavy front seats with full fuel: legal loaded, forward once fuel burns off
    const r = weightAndBalance({ ...SAMPLE_PROBLEM, frontSeatsLb: 380, rearSeatsLb: 0, fuelLb: 288, baggageLb: 0 });
    expect(r.zeroFuel.cgIn).toBeLessThan(r.takeoff.cgIn);
  });
});
