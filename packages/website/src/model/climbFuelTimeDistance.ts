/**
 * PA-28-161 Warrior II — fuel, time and distance to climb.
 * Reverse-engineered from POH Figure 5-19 (Report VB-1180, Aug 1982).
 * Two-stage nomograph composition: an altitude/temperature surface gives the
 * shared nomograph height, then per-curve pixel-space polynomials give the
 * cumulative time / distance / fuel; the chart's answer is cruise minus
 * departure. Reproduces the printed worked example to −2…−6%. Study/planning
 * tool only — not a substitute for the POH/AFM.
 *
 * Associated conditions: 2440 lb, flaps 0°, full throttle, mixture leaned
 * per Lycoming instructions, 79 KIAS, no wind.
 */

import { DIST_POLY, FUEL_POLY, G_SURFACE, TIME_POLY, VALUE_PX_PER_UNIT, VALUE_X0_PX, Y_RANGE_PX } from "../charts/fixtures/fig519Fit";
import { densityAltitudeFt, densityRatio, isaTempC } from "./atmosphere";
import { warnRange } from "./shared";

export interface ClimbToInputs {
  /** Departure airport pressure altitude, ft (chart: 0–11,000) */
  departurePaFt: number;
  /** Departure airport OAT, °C (chart: −40…+40) */
  departureOatC: number;
  /** Cruise pressure altitude, ft (chart: 0–11,000) */
  cruisePaFt: number;
  /** Cruise OAT, °C (chart: −40…+40) */
  cruiseOatC: number;
}

/** Cumulative sea-level→altitude lookup (one vertical on the chart). */
export interface ClimbLeg {
  timeMin: number;
  distNm: number;
  fuelGal: number;
  /** Shared nomograph height, ORIGINAL-page px (used by the chart overlay) */
  yPx: number;
  densityAltitudeFt: number;
}

export interface ClimbToResult {
  departure: ClimbLeg;
  cruise: ClimbLeg;
  /** Final answers: cruise minus departure (clamped at 0) */
  timeMin: number;
  distNm: number;
  fuelGal: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

/** Nomograph height y_px from PA and OAT (deg-4 fitted surface). */
export function climbYPx(paFt: number, oatC: number): number {
  const p = paFt / 1000;
  const t = oatC / 10;
  let y = 0;
  let pi = 1;
  for (let i = 0; i < G_SURFACE.length; i++) {
    const row = G_SURFACE[i]!;
    let tj = 1;
    for (let j = 0; j < row.length; j++) {
      y += row[j]! * pi * tj;
      tj *= t;
    }
    pi *= p;
  }
  return y;
}

function polyval(coefs: readonly number[], x: number): number {
  return coefs.reduce((acc, c) => acc * x + c, 0);
}

function valueFromYPx(coefs: readonly number[], yPx: number): number {
  const y = Math.min(Math.max(yPx, Y_RANGE_PX[0]), Y_RANGE_PX[1]);
  return Math.max(0, (polyval(coefs, y) - VALUE_X0_PX) / VALUE_PX_PER_UNIT);
}

/** Cumulative time/distance/fuel from sea level to (PA, OAT). */
export function climbLeg(paFt: number, oatC: number): ClimbLeg {
  const yPx = climbYPx(paFt, oatC);
  return {
    timeMin: valueFromYPx(TIME_POLY, yPx),
    distNm: valueFromYPx(DIST_POLY, yPx),
    fuelGal: valueFromYPx(FUEL_POLY, yPx),
    yPx,
    densityAltitudeFt: densityAltitudeFt(densityRatio(paFt, oatC)),
  };
}

function envelopeWarnings(prefix: string, paFt: number, oatC: number, yPx: number, out: string[]): void {
  const oatOffChart = oatC < -40 || oatC > 40;
  warnRange(out, paFt, 0, 11000, `${prefix} pressure altitude`, "ft");
  warnRange(out, oatC, -40, 40, `${prefix} OAT`, "°C");
  // Only meaningful with the OAT on the chart — off-chart OAT already warned above.
  if (!oatOffChart && yPx < Y_RANGE_PX[0]) out.push(`${prefix} conditions beyond the drawn curve family (this altitude is only charted at colder OAT)`);
}

export function climbFuelTimeDistance(inp: ClimbToInputs): ClimbToResult {
  const departure = climbLeg(inp.departurePaFt, inp.departureOatC);
  const cruise = climbLeg(inp.cruisePaFt, inp.cruiseOatC);

  const warnings: string[] = [];
  envelopeWarnings("departure", inp.departurePaFt, inp.departureOatC, departure.yPx, warnings);
  envelopeWarnings("cruise", inp.cruisePaFt, inp.cruiseOatC, cruise.yPx, warnings);
  if (inp.cruisePaFt < inp.departurePaFt) warnings.push("cruise altitude is below the departure airport — no climb to compute");
  const isaDevDep = inp.departureOatC - isaTempC(inp.departurePaFt);
  const isaDevCruise = inp.cruiseOatC - isaTempC(inp.cruisePaFt);
  if (Math.abs(isaDevDep - isaDevCruise) > 10) warnings.push("departure and cruise ISA deviations differ by more than 10 °C — the chart's subtraction rule is approximate here");

  return {
    departure,
    cruise,
    timeMin: Math.max(0, cruise.timeMin - departure.timeMin),
    distNm: Math.max(0, cruise.distNm - departure.distNm),
    fuelGal: Math.max(0, cruise.fuelGal - departure.fuelGal),
    warnings,
  };
}

/**
 * The chart's own worked example: departure 1500 ft / 27 °C, cruise
 * 5000 ft / 16 °C → POH prints 12−3 = 9 min, 16−4 = 12 nm, 3−1 = 2 gal.
 * Model gives 8.5 min / 11.7 nm / 1.9 gal (−6…−2%).
 */
export const CHART_EXAMPLE: ClimbToInputs = {
  departurePaFt: 1500,
  departureOatC: 27,
  cruisePaFt: 5000,
  cruiseOatC: 16,
};
