/**
 * PA-28-161 Warrior II — fuel, time and distance to descend.
 * Reverse-engineered from POH Figure 5-31 (Report VB-1180, Aug 1982).
 * Constants from tools/digitize/out/fits/fig_5_31.json. Study/planning
 * tool only — not a substitute for the POH/AFM.
 *
 * Associated conditions: 2500 RPM, 126 KIAS, no wind.
 *
 * Chart mechanics: each (PA, OAT) pair maps to an "effective altitude" h_e
 * on the chart's internal scale; time/distance/fuel are cumulative curves
 * of h_e and the answer is cruise reading minus destination reading.
 * Quirk (docs/FINDINGS.md): the temperature sign is INVERTED vs density
 * physics — warmer than ISA lowers h_e (≈−8 ft/°C at SL to ≈−60 ft/°C at
 * 10,000 ft), i.e. less time/fuel/distance. Certification-policy
 * smoothing, faithfully reproduced.
 */

import { cubic, DIST_POLY, FUEL_POLY, HE_SURFACE, TIME_POLY } from "../charts/fixtures/fig531Coeffs";
import { isaTempC } from "./atmosphere";

export interface DescentInputs {
  /** Cruise pressure altitude, ft (chart: 0–12,000) */
  cruisePressureAltitudeFt: number;
  /** Cruise OAT, °C (chart: −40…+40) */
  cruiseOatC: number;
  /** Destination airport pressure altitude, ft (chart: 0–12,000) */
  destPressureAltitudeFt: number;
  /** Destination airport OAT, °C (chart: −40…+40) */
  destOatC: number;
}

/** One end of the descent: chart readings at its effective altitude. */
export interface DescentReading {
  /** Effective altitude h_e on the chart's internal scale, ft */
  effectiveAltitudeFt: number;
  /** Cumulative time reading, min (offset-laden — differences only) */
  timeMin: number;
  /** Cumulative distance reading, nm */
  distNm: number;
  /** Cumulative fuel reading, gal */
  fuelGal: number;
}

export interface DescentResult {
  cruise: DescentReading;
  destination: DescentReading;
  /** Time to descend, min */
  timeMin: number;
  /** Still-air distance to descend, nm */
  distNm: number;
  /** Fuel to descend, gal (chart resolution only ~±0.2 gal) */
  fuelGal: number;
  /** Non-empty if inputs fall outside the digitized chart envelope */
  warnings: string[];
}

/**
 * The chart's coarse fuel scale (0.5-gal gridlines, curve nearly vertical)
 * limits fuel readings to roughly ±0.2 gal — the POH's own worked example
 * prints "0.5 gal" for a drawn ≈0.62 gal.
 */
export const FUEL_TOLERANCE_GAL = 0.2;

/** Effective chart altitude h_e for a (pressure altitude, OAT) pair. */
export function effectiveAltitudeFt(pressureAltitudeFt: number, oatC: number): number {
  const { a1, a2, b1, b2, c3 } = HE_SURFACE;
  const pa = pressureAltitudeFt;
  const dT = oatC - isaTempC(pa);
  return pa + a1 * dT + (a2 * dT * pa) / 1000 + b1 * dT * dT + (b2 * dT * dT * pa) / 1000 + c3 * dT * dT * dT;
}

/** Cumulative chart readings at an effective altitude. */
export function readingsAt(pressureAltitudeFt: number, oatC: number): DescentReading {
  const h = effectiveAltitudeFt(pressureAltitudeFt, oatC);
  return {
    effectiveAltitudeFt: h,
    timeMin: cubic(TIME_POLY, h),
    distNm: cubic(DIST_POLY, h),
    fuelGal: cubic(FUEL_POLY, h),
  };
}

export function descentFuelTimeDistance(inp: DescentInputs): DescentResult {
  const cruise = readingsAt(inp.cruisePressureAltitudeFt, inp.cruiseOatC);
  const destination = readingsAt(inp.destPressureAltitudeFt, inp.destOatC);

  const warnings: string[] = [];
  if (inp.cruisePressureAltitudeFt < 0 || inp.cruisePressureAltitudeFt > 12000) warnings.push("cruise pressure altitude outside chart (0–12,000 ft)");
  if (inp.destPressureAltitudeFt < 0 || inp.destPressureAltitudeFt > 12000) warnings.push("destination pressure altitude outside chart (0–12,000 ft)");
  if (inp.cruiseOatC < -40 || inp.cruiseOatC > 40) warnings.push("cruise OAT outside chart (−40…+40 °C)");
  if (inp.destOatC < -40 || inp.destOatC > 40) warnings.push("destination OAT outside chart (−40…+40 °C)");
  if (destination.effectiveAltitudeFt >= cruise.effectiveAltitudeFt) warnings.push("destination is not below cruise on the chart's effective-altitude scale — no descent to compute");
  if (inp.cruisePressureAltitudeFt > 10000) warnings.push("11,000/12,000 ft curves are unlabeled in the POH — lower confidence");

  return {
    cruise,
    destination,
    timeMin: cruise.timeMin - destination.timeMin,
    distNm: cruise.distNm - destination.distNm,
    fuelGal: cruise.fuelGal - destination.fuelGal,
    warnings,
  };
}

/**
 * The chart's own worked example: cruise 5000 ft / 16 °C, destination
 * 2500 ft / 24 °C → POH prints 3.0 min, 5.5 nm, 0.5 gal (readings
 * 7.5−4.5 min, 13.5−8 nm, 1.0−0.5 gal). Model: h_e 4456/2147 →
 * 2.91 min (−3.1%), 5.56 nm (+1.0%), 0.33 gal (the printed 0.5 is a
 * rounded read of a drawn ≈0.62 — fuel scale is only good to ±0.2 gal).
 */
export const CHART_EXAMPLE: DescentInputs = {
  cruisePressureAltitudeFt: 5000,
  cruiseOatC: 16,
  destPressureAltitudeFt: 2500,
  destOatC: 24,
};
