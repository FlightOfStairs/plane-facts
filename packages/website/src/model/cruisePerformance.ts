/**
 * PA-28-161 Warrior II — cruise performance (TAS + fuel flow).
 * Reverse-engineered from POH Figures 5-21 (best power mixture) and
 * 5-23 (best economy mixture), Report VB-1180. One model parameterized by
 * mixture; constants copied from tools/digitize/out/fits/fig_5_21.json and
 * fig_5_23.json. Fit residuals ≤0.15 kt rms per curve; worked examples
 * reproduce within ±0.5%. Study/planning tool only — not a substitute for
 * the POH/AFM.
 *
 * Associated conditions: mid-cruise weight 2300 lb, wheel fairings
 * installed (subtract 7 kt TAS if removed — chart note), mixture leaned
 * per Section 4.
 *
 * Internal ordinate: u = DA/2000 (the charts' PA/OAT lattice is a true
 * density-altitude collapse — temperature weight ≈119–121 ft/°C ≈ textbook
 * 118.8, see docs/FINDINGS.md). We compute u from each figure's fitted
 * quadratic surface in (PA, OAT) to stay faithful to the printed lattice;
 * it agrees with the shared ISA densityAltitudeFt() to within ~80 ft over
 * the whole envelope (asserted in tests), so either would do.
 */

import { densityAltitudeFt, densityRatio } from "./atmosphere";

export type Mixture = "bestPower" | "bestEconomy";
export type PowerSetting = 55 | 65 | 75;

export interface CruiseInputs {
  /** Pressure altitude, ft (chart: 0–16000) */
  pressureAltitudeFt: number;
  /** Outside air temperature, °C (chart: −40…+40) */
  oatC: number;
  /** Nominal cruise power, % rated (chart curves: 55 / 65 / 75) */
  powerPct: PowerSetting;
  /** Mixture per POH leaning instructions: Fig 5-21 vs Fig 5-23 */
  mixture: Mixture;
  /** Wheel fairings installed? Chart note: subtract 7 kt TAS if not. */
  wheelFairings: boolean;
}

export interface CruiseResult {
  /** Final cruise speed, KTAS (after wheel-fairing adjustment) */
  tasKt: number;
  /** As charted (wheel fairings installed), before the −7 kt adjustment */
  tasChartKt: number;
  /** TAS the nominal %-power curve alone would give (no FT cap) */
  tasPowerCurveKt: number;
  /** True if the full-throttle boundary caps the requested %power */
  fullThrottleLimited: boolean;
  /** Achievable %power at full throttle when limited, else null */
  achievablePowerPct: number | null;
  /** Fuel consumption, GPH (chart table; interpolated to achievable %power when FT-limited) */
  fuelGph: number;
  /** Density altitude from the fitted PA/OAT lattice, ft (= 2000·u) */
  densityAltitudeFt: number;
  /** u = DA/2000, the charts' internal ordinate */
  u: number;
  /** Shared ISA density altitude, ft (comparison; ≈ lattice value ±30 ft) */
  isaDensityAltitudeFt: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

interface FigureParams {
  figure: "5-21" | "5-23";
  /** u = c0 + c1·PA + c2·OAT + c3·PA·OAT + c4·PA² + c5·OAT² */
  uCoeffs: readonly [number, number, number, number, number, number];
  /** TAS(u) per nominal %power, quadratic, highest degree first */
  q: Readonly<Record<PowerSetting, readonly [number, number, number]>>;
  /** Full-throttle boundary TAS(u), cubic, highest degree first */
  qFT: readonly [number, number, number, number];
  /** u-validity of each digitized curve */
  uRange: Readonly<Record<PowerSetting | "FT", readonly [number, number]>>;
  /** Printed fuel-consumption table, GPH */
  fuelGph: Readonly<Record<PowerSetting, number>>;
}

/** Fitted constants from tools/digitize/out/fits/fig_5_21.json */
const FIG_5_21: FigureParams = {
  figure: "5-21",
  uCoeffs: [-0.9507783909699528, 0.0006314575541150251, 0.06466373882369007, -6.104509968054439e-7, -8.253277179683813e-10, -0.0001397604374975914],
  q: {
    55: [-0.0013556416119979624, 1.9340153469688388, 95.44952559967443],
    65: [-0.0012839097363147231, 2.0414474495306685, 104.98876898774971],
    75: [-0.0026384951564287127, 2.966973760344322, 112.60769074691405],
  },
  qFT: [-0.08801613731326688, 0.3397959817536, 0.24308123640715398, 126.1239873492672],
  uRange: {
    55: [0.028948351817934172, 6.504072755900762],
    65: [0.028948351817934172, 6.30298193589819],
    75: [0.028948351817934172, 4.332291899872981],
    FT: [0.028948351817934172, 6.4236364278997335],
  },
  fuelGph: { 55: 7.8, 65: 8.8, 75: 10.0 },
};

/** Fitted constants from tools/digitize/out/fits/fig_5_23.json */
const FIG_5_23: FigureParams = {
  figure: "5-23",
  uCoeffs: [-0.9032707650595712, 0.0006177928156102027, 0.06378223582321918, -5.859859198787578e-7, -7.47280207646028e-11, -0.00015669553705125662],
  q: {
    55: [0.0029826219818078733, 2.0287049309070744, 91.97724863072169],
    65: [0.006236444453224108, 2.4476478156459347, 101.865471050983],
    75: [0.0028594435662199673, 3.026515660428563, 108.59561348641247],
  },
  qFT: [-0.07015505381210722, -0.9732953296860286, 11.634845558568227, 97.06453701269089],
  uRange: {
    55: [0.027366591384530622, 6.38630458409538],
    65: [0.027366591384530622, 5.870715017118824],
    75: [0.027366591384530622, 4.452843707933297],
    FT: [4.660511727965521, 5.992451442654956],
  },
  fuelGph: { 55: 6.6, 65: 7.5, 75: 8.5 },
};

const PARAMS: Readonly<Record<Mixture, FigureParams>> = {
  bestPower: FIG_5_21,
  bestEconomy: FIG_5_23,
};

export const WHEEL_FAIRING_PENALTY_KT = 7; // chart note: subtract if not installed
export const CRUISE_WEIGHT_LB = 2300; // associated condition, both figures

/** Evaluate a polynomial with coefficients highest degree first. */
function polyval(coeffs: readonly number[], x: number): number {
  let acc = 0;
  for (const c of coeffs) acc = acc * x + c;
  return acc;
}

/** u = DA/2000 from the figure's fitted (PA, OAT) lattice surface. */
export function latticeU(mixture: Mixture, pressureAltitudeFt: number, oatC: number): number {
  const [c0, c1, c2, c3, c4, c5] = PARAMS[mixture].uCoeffs;
  return c0 + c1 * pressureAltitudeFt + c2 * oatC + c3 * pressureAltitudeFt * oatC + c4 * pressureAltitudeFt ** 2 + c5 * oatC ** 2;
}

/** Fuel flow (GPH) at a %power, linear through the printed 55/65/75 table. */
function fuelAtPct(p: FigureParams, pct: number): number {
  const f55 = p.fuelGph[55];
  const f65 = p.fuelGph[65];
  const f75 = p.fuelGph[75];
  return pct >= 65 ? f65 + ((pct - 65) / 10) * (f75 - f65) : f55 + ((pct - 55) / 10) * (f65 - f55);
}

export function cruisePerformance(inp: CruiseInputs): CruiseResult {
  const { pressureAltitudeFt: pa, oatC, powerPct, mixture, wheelFairings } = inp;
  const p = PARAMS[mixture];

  const u = latticeU(mixture, pa, oatC);
  const daFt = 2000 * u;
  const isaDa = densityAltitudeFt(densityRatio(pa, oatC));

  const tasPower = polyval(p.q[powerPct], u);
  const tasFT = polyval(p.qFT, u);

  // Cap by the full-throttle boundary. The u-guard keeps the FT cubic from
  // being extrapolated below its drawn range (on 5-23 the boundary is only
  // drawn DA ≈ 9300–12000; extrapolating lower would falsely cap).
  const ftLimited = u >= p.uRange.FT[0] && tasFT < tasPower;
  const tasChart = ftLimited ? tasFT : tasPower;

  // Achievable %power when FT-limited: where the boundary TAS falls within
  // the 55/65/75 curve family at this u (piecewise-linear in %power).
  // Matches the fits' implied full-throttle power lapse to ~0.3 pt.
  let achievable: number | null = null;
  if (ftLimited) {
    const t55 = polyval(p.q[55], u);
    const t65 = polyval(p.q[65], u);
    const t75 = polyval(p.q[75], u);
    achievable = tasFT >= t65 ? 65 + (10 * (tasFT - t65)) / (t75 - t65) : 55 + (10 * (tasFT - t55)) / (t65 - t55);
  }

  const warnings: string[] = [];
  if (pa < 0 || pa > 16000) warnings.push("pressure altitude outside chart (0–16000 ft)");
  if (oatC < -40 || oatC > 40) warnings.push("OAT outside chart (−40…+40 °C)");
  if (daFt < 0) warnings.push("density altitude below 0 ft — off the bottom of the chart");
  if (ftLimited) {
    if (u > p.uRange.FT[1]) warnings.push(`density altitude ${Math.round(daFt)} ft — beyond the drawn full-throttle boundary`);
  } else if (u > p.uRange[powerPct][1]) {
    warnings.push(`density altitude ${Math.round(daFt)} ft — beyond the top of the drawn ${powerPct}% curve`);
  }

  return {
    tasKt: tasChart - (wheelFairings ? 0 : WHEEL_FAIRING_PENALTY_KT),
    tasChartKt: tasChart,
    tasPowerCurveKt: tasPower,
    fullThrottleLimited: ftLimited,
    achievablePowerPct: achievable,
    fuelGph: ftLimited && achievable !== null ? fuelAtPct(p, achievable) : p.fuelGph[powerPct],
    densityAltitudeFt: daFt,
    u,
    isaDensityAltitudeFt: isaDa,
    warnings,
  };
}

/**
 * Both charts' printed worked example: 5000 ft, 16 °C, 75% power.
 * Fig 5-21 prints 122.5 KTAS (model 121.9, −0.5% — the POH's own dashed
 * trace sits ~1 kt above its curves); Fig 5-23 prints 118 KTAS (model
 * 118.1, +0.05%).
 */
export const CHART_EXAMPLE: Omit<CruiseInputs, "mixture"> = {
  pressureAltitudeFt: 5000,
  oatC: 16,
  powerPct: 75,
  wheelFairings: true,
};
