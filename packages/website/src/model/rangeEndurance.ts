/**
 * PA-28-161 Warrior II — cruise range and endurance.
 * Reverse-engineered from POH Figures 5-25 (best power mixture range),
 * 5-27 (best economy mixture range) and 5-29 (endurance), Report VB-1180.
 * Constants copied from tools/digitize/out/fits/fig_5_25.json,
 * fig_5_27.json and fig_5_29.json. Study/planning tool only — not a
 * substitute for the POH/AFM.
 *
 * Associated conditions (all three charts): mixture leaned per Section 4,
 * mid-cruise weight 2300 lb, no wind, 48 gal usable fuel, wheel fairings
 * installed (range may drop up to 7% without). Range includes distance to
 * climb and descend; endurance includes time to climb and descend. The
 * endurance chart assumes best economy mixture.
 *
 * Model forms (from the fits):
 *   range_nm  = R0 + slope·PA + tempCorr,
 *     tempCorr = perDegAboveStd·ΔISA if ΔISA > 0 else perDegBelowStd·ΔISA
 *     (two-sided per-degree values differ between the two range charts)
 *   endurance_hr = E0 + b·PA + c·PA²   (no temperature dependence printed)
 */

import { isaTempC } from "./atmosphere";

export type Mixture = "bestPower" | "bestEconomy";
export type PowerPct = 55 | 65 | 75;
export type ReservePolicy = "reserve45" | "noReserve";

export const RESERVE_LABEL: Record<ReservePolicy, string> = {
  reserve45: "45-min reserve @ 55%",
  noReserve: "no reserve",
};

interface RangeCurve {
  R0Nm: number;
  slopeNmPerFt: number;
  altMinFt: number;
  altMaxFt: number;
}

interface RangeChart {
  figure: string;
  /** nm added per °C above standard temperature */
  perDegAboveStd: number;
  /** nm removed per °C below standard temperature */
  perDegBelowStd: number;
  curves: Record<ReservePolicy, Record<PowerPct, RangeCurve>>;
}

/** Fitted parameters, fig_5_25.json (rms 0.084%) and fig_5_27.json (rms 0.046%). */
const RANGE_CHARTS: Record<Mixture, RangeChart> = {
  bestPower: {
    figure: "5-25",
    perDegAboveStd: 0.6,
    perDegBelowStd: 1.0,
    curves: {
      reserve45: {
        75: { R0Nm: 474.2, slopeNmPerFt: 0.005568, altMinFt: 500, altMaxFt: 9000 },
        65: { R0Nm: 499.9, slopeNmPerFt: 0.004126, altMinFt: 500, altMaxFt: 12000 },
        55: { R0Nm: 513.8, slopeNmPerFt: 0.003902, altMinFt: 500, altMaxFt: 12000 },
      },
      noReserve: {
        75: { R0Nm: 524.3, slopeNmPerFt: 0.00708, altMinFt: 500, altMaxFt: 9000 },
        65: { R0Nm: 559.2, slopeNmPerFt: 0.004334, altMinFt: 500, altMaxFt: 13000 },
        55: { R0Nm: 579.1, slopeNmPerFt: 0.00392, altMinFt: 500, altMaxFt: 13000 },
      },
    },
  },
  bestEconomy: {
    figure: "5-27",
    perDegAboveStd: 0.7,
    perDegBelowStd: 1.1,
    curves: {
      reserve45: {
        75: { R0Nm: 538.9, slopeNmPerFt: 0.005725, altMinFt: 500, altMaxFt: 10000 },
        65: { R0Nm: 570.1, slopeNmPerFt: 0.004931, altMinFt: 500, altMaxFt: 12000 },
        55: { R0Nm: 584.1, slopeNmPerFt: 0.004664, altMinFt: 500, altMaxFt: 12000 },
      },
      noReserve: {
        75: { R0Nm: 601.5, slopeNmPerFt: 0.006594, altMinFt: 500, altMaxFt: 10000 },
        65: { R0Nm: 638.7, slopeNmPerFt: 0.005556, altMinFt: 500, altMaxFt: 13000 },
        55: { R0Nm: 653.8, slopeNmPerFt: 0.005106, altMinFt: 500, altMaxFt: 13000 },
      },
    },
  },
};

interface EnduranceCurve {
  E0Hr: number;
  bHrPerFt: number;
  cHrPerFt2: number;
  altMinFt: number;
  altMaxFt: number;
}

/** Fitted parameters, fig_5_29.json (quadratic in PA, rms ≈ 0). */
const ENDURANCE_CURVES: Record<ReservePolicy, Record<PowerPct, EnduranceCurve>> = {
  reserve45: {
    75: { E0Hr: 4.927, bHrPerFt: -2.3296e-5, cHrPerFt2: 5.355e-10, altMinFt: 500, altMaxFt: 9000 },
    65: { E0Hr: 5.551, bHrPerFt: -2.856e-5, cHrPerFt2: 9.616e-10, altMinFt: 500, altMaxFt: 11500 },
    55: { E0Hr: 6.4, bHrPerFt: -3.4462e-5, cHrPerFt2: 1.0725e-9, altMinFt: 500, altMaxFt: 11500 },
  },
  noReserve: {
    75: { E0Hr: 5.485, bHrPerFt: -9.182e-6, cHrPerFt2: -2.25e-11, altMinFt: 500, altMaxFt: 11500 },
    65: { E0Hr: 6.247, bHrPerFt: -2.616e-6, cHrPerFt2: -6.934e-10, altMinFt: 500, altMaxFt: 11500 },
    55: { E0Hr: 7.109, bHrPerFt: -3.2592e-5, cHrPerFt2: -6.01e-11, altMinFt: 500, altMaxFt: 11500 },
  },
};

export const USABLE_FUEL_GAL = 48;
export const MID_CRUISE_WEIGHT_LB = 2300;

export interface RangeInputs {
  mixture: Mixture;
  power: PowerPct;
  reserve: ReservePolicy;
  /** Pressure altitude, ft (chart: 0–12000; 75% curves end at 9000/10000) */
  pressureAltFt: number;
  /** Outside air temperature, °C (chart correction is arithmetic, unbounded) */
  oatC: number;
}

export interface RangeResult {
  /** Final range, nm (base + temperature correction) */
  rangeNm: number;
  /** Chart curve read at standard temperature, nm */
  baseRangeNm: number;
  /** Two-sided temperature correction, nm (negative below standard) */
  tempCorrNm: number;
  /** ISA standard temperature at the pressure altitude, °C */
  stdTempC: number;
  /** OAT − standard temperature, °C */
  deltaIsaC: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

/**
 * Range from Fig 5-25 (best power) or Fig 5-27 (best economy).
 * The fits use Tstd = 15 − 1.9812·PA/1000; the shared isaTempC uses a
 * 1.98 lapse — the difference is < 0.015 °C (< 0.02 nm) over the envelope.
 */
export function rangeNm(inp: RangeInputs): RangeResult {
  const chart = RANGE_CHARTS[inp.mixture];
  const curve = chart.curves[inp.reserve][inp.power];

  const stdTempC = isaTempC(inp.pressureAltFt);
  const deltaIsaC = inp.oatC - stdTempC;
  const baseRangeNm = curve.R0Nm + curve.slopeNmPerFt * inp.pressureAltFt;
  const tempCorrNm = deltaIsaC > 0 ? chart.perDegAboveStd * deltaIsaC : chart.perDegBelowStd * deltaIsaC;

  const warnings: string[] = [];
  if (inp.pressureAltFt < 0) warnings.push("pressure altitude below chart (0 ft)");
  if (inp.pressureAltFt > curve.altMaxFt) warnings.push(`${inp.power}% ${RESERVE_LABEL[inp.reserve]} curve of Fig ${chart.figure} is drawn only to ${curve.altMaxFt} ft — extrapolating`);

  return { rangeNm: baseRangeNm + tempCorrNm, baseRangeNm, tempCorrNm, stdTempC, deltaIsaC, warnings };
}

export interface EnduranceInputs {
  power: PowerPct;
  reserve: ReservePolicy;
  /** Pressure altitude, ft (chart: 0–12000; 75% reserve curve ends at 9000) */
  pressureAltFt: number;
}

export interface EnduranceResult {
  /** Endurance, hr (best economy mixture) */
  enduranceHr: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

/** Endurance from Fig 5-29 (best economy mixture, no temperature dependence). */
export function enduranceHr(inp: EnduranceInputs): EnduranceResult {
  const curve = ENDURANCE_CURVES[inp.reserve][inp.power];
  const pa = inp.pressureAltFt;
  const e = curve.E0Hr + curve.bHrPerFt * pa + curve.cHrPerFt2 * pa * pa;

  const warnings: string[] = [];
  if (pa < 0) warnings.push("pressure altitude below chart (0 ft)");
  if (pa > curve.altMaxFt) warnings.push(`${inp.power}% ${RESERVE_LABEL[inp.reserve]} curve of Fig 5-29 is drawn only to ${curve.altMaxFt} ft — extrapolating`);

  return { enduranceHr: e, warnings };
}

/**
 * Average block TAS implied by range/endurance — a cross-check, not a chart
 * output. Both charts include the climb and descent, so this is the whole-
 * flight average. The endurance chart assumes best economy mixture, so the
 * value is approximate when paired with the best power range chart.
 */
export function impliedBlockTasKt(rangeNmValue: number, enduranceHrValue: number): number {
  return rangeNmValue / enduranceHrValue;
}

/** Fig 5-25's printed example: 5000 ft, 16 °C, 75% → 507.6 / 567.6 nm. */
export const CHART_EXAMPLE_5_25: RangeInputs = {
  mixture: "bestPower",
  power: 75,
  reserve: "reserve45",
  pressureAltFt: 5000,
  oatC: 16,
};

/** Fig 5-27's printed example: 5000 ft, 16 °C, 75% → 574.7 / 642.7 nm. */
export const CHART_EXAMPLE_5_27: RangeInputs = {
  mixture: "bestEconomy",
  power: 75,
  reserve: "reserve45",
  pressureAltFt: 5000,
  oatC: 16,
};

/** Fig 5-29's printed example: 5000 ft, 75% → 4.85 / 5.45 hr. */
export const CHART_EXAMPLE_5_29: EnduranceInputs = {
  power: 75,
  reserve: "reserve45",
  pressureAltFt: 5000,
};
