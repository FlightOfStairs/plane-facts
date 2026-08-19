import { describe, expect, test } from "vitest";
import { casFromIas } from "./airspeed";
import { CHART_EXAMPLE, bankFactor, stallSpeed } from "./stallSpeed";

describe("Fig 5-5 stall speed", () => {
  test("reproduces the chart's printed worked example within 1.5%", () => {
    // 2170 lb, 20° bank, flaps 40 → POH prints 44 KIAS. The fit achieves
    // −1.1% (43.5 KIAS): the printed answer is 0.5–1 kt generous against the
    // chart's own drawn curves (FINDINGS.md errata #4).
    const r = stallSpeed(CHART_EXAMPLE);
    expect(Math.abs(r.stallIasKt - 44) / 44).toBeLessThan(0.015);
    expect(r.stallIasKt).toBeCloseTo(43.52, 1);
    expect(r.wingsLevelIasKt).toBeCloseTo(42.19, 1);
    expect(r.stallCasKt).toBeCloseTo(50.23, 1);
    expect(r.warnings).toEqual([]);
  });

  test("wings-level anchors at 2440 lb (FINDINGS.md)", () => {
    const f0 = stallSpeed({ weightLb: 2440, bankDeg: 0, flaps: 0 });
    const f40 = stallSpeed({ weightLb: 2440, bankDeg: 0, flaps: 40 });
    expect(f0.stallCasKt).toBeCloseTo(56.06, 1);
    expect(f0.stallIasKt).toBeCloseTo(50.45, 1);
    expect(f40.stallCasKt).toBeCloseTo(50.05, 1);
    expect(f40.stallIasKt).toBeCloseTo(44.09, 1);
  });

  // Digitized samples from fig_5_05.json "curves" (fit rms 0.08–0.21 kt per
  // curve; ±0.5 kt allows margin). [weightLb, kt]
  const goldenLeft: { flaps: 0 | 40; kind: "cas" | "ias"; points: [number, number][] }[] = [
    {
      flaps: 0,
      kind: "cas",
      points: [
        [2433.7, 56.14],
        [2290.1, 55.51],
        [2157.1, 54.47],
        [1986.9, 52.62],
        [1832.6, 50.75],
        [1602.5, 47.2],
      ],
    },
    {
      flaps: 40,
      kind: "cas",
      points: [
        [2433.7, 50.18],
        [2290.1, 49.24],
        [2087.9, 48.07],
        [1924.3, 46.12],
        [1748.8, 43.61],
      ],
    },
    {
      flaps: 0,
      kind: "ias",
      points: [
        [2433.7, 50.18],
        [2294.1, 49.41],
        [2048.0, 46.73],
        [1876.5, 44.55],
        [1711.6, 41.83],
        [1602.5, 40.26],
      ],
    },
    {
      flaps: 40,
      kind: "ias",
      points: [
        [2433.7, 44.11],
        [2234.2, 42.74],
        [1989.5, 40.23],
        [1823.3, 37.78],
        [1651.7, 34.96],
      ],
    },
  ];

  test.each(goldenLeft)("golden left-panel points — flaps $flaps $kind", ({ flaps, kind, points }) => {
    for (const [w, kt] of points) {
      const r = stallSpeed({ weightLb: w, bankDeg: 0, flaps });
      const model = kind === "cas" ? r.stallCasKt : r.stallIasKt;
      expect(Math.abs(model - kt), `W=${w}`).toBeLessThan(0.5);
    }
  });

  // Digitized bank-fan samples (fan rms 0.21 kt; drafting wobble up to
  // ~0.3 kt on the picked points — ±0.7 kt margin). [bankDeg, kt] with the
  // fitted 0°-intercept V₀ of each guide curve.
  const goldenFan: { v0: number; points: [number, number][] }[] = [
    {
      v0: 34.24,
      points: [
        [0.5, 34.16],
        [29.2, 36.67],
        [46.5, 41.33],
        [59.6, 47.8],
      ],
    },
    {
      v0: 42.39,
      points: [
        [12.8, 42.77],
        [34.3, 46.66],
        [51.2, 53.56],
      ],
    },
    {
      v0: 50.07,
      points: [
        [8.4, 50.48],
        [32.6, 54.47],
        [59.3, 69.75],
      ],
    },
  ];

  test.each(goldenFan)("golden bank-fan points — V₀ $v0 kt", ({ v0, points }) => {
    for (const [phi, kt] of points) {
      expect(Math.abs(v0 * bankFactor(phi) - kt), `φ=${phi}`).toBeLessThan(0.7);
    }
  });

  test("bank fan is exact load-factor physics: V ∝ cos(φ)^−0.499 ≈ √n", () => {
    expect(bankFactor(0)).toBe(1);
    expect(bankFactor(60)).toBeCloseTo(Math.pow(2, 0.499), 3); // n = 2 at 60°
    const r = stallSpeed({ weightLb: 2200, bankDeg: 60, flaps: 0 });
    expect(r.loadFactor).toBeCloseTo(2, 6);
    // universal fan: same multiplier regardless of flaps/weight entry speed
    const a = stallSpeed({ weightLb: 2440, bankDeg: 45, flaps: 0 });
    const b = stallSpeed({ weightLb: 1700, bankDeg: 45, flaps: 40 });
    expect(a.stallCasKt / a.wingsLevelCasKt).toBeCloseTo(b.stallIasKt / b.wingsLevelIasKt, 10);
  });

  test("stall speed increases with weight and bank; flaps 40 stalls slower", () => {
    const light = stallSpeed({ weightLb: 1800, bankDeg: 0, flaps: 0 });
    const heavy = stallSpeed({ weightLb: 2440, bankDeg: 0, flaps: 0 });
    expect(heavy.stallCasKt).toBeGreaterThan(light.stallCasKt);
    const banked = stallSpeed({ weightLb: 2440, bankDeg: 45, flaps: 0 });
    expect(banked.stallCasKt).toBeGreaterThan(heavy.stallCasKt);
    const flapped = stallSpeed({ weightLb: 2440, bankDeg: 0, flaps: 40 });
    expect(flapped.stallCasKt).toBeLessThan(heavy.stallCasKt);
    expect(flapped.stallIasKt).toBeLessThan(heavy.stallIasKt);
  });

  test("CAS/IAS pairs at 2440 lb agree with Fig 5-3 within ~0.5 kt (FINDINGS.md)", () => {
    const f0 = stallSpeed({ weightLb: 2440, bankDeg: 0, flaps: 0 });
    const f40 = stallSpeed({ weightLb: 2440, bankDeg: 0, flaps: 40 });
    expect(Math.abs(casFromIas(f0.stallIasKt, "up") - f0.stallCasKt)).toBeLessThan(0.5);
    expect(Math.abs(casFromIas(f40.stallIasKt, "deg40") - f40.stallCasKt)).toBeLessThan(0.5);
  });

  test("envelope warnings fire outside the digitized chart", () => {
    expect(stallSpeed({ weightLb: 1500, bankDeg: 0, flaps: 0 }).warnings.length).toBeGreaterThan(0);
    expect(stallSpeed({ weightLb: 2500, bankDeg: 0, flaps: 0 }).warnings.length).toBeGreaterThan(0);
    expect(stallSpeed({ weightLb: 2200, bankDeg: 70, flaps: 40 }).warnings.length).toBeGreaterThan(0);
    expect(stallSpeed({ weightLb: 2200, bankDeg: 30, flaps: 40 }).warnings).toEqual([]);
  });
});
