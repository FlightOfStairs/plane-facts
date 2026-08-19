/**
 * Fitted coefficients for POH Figure 5-31 "Fuel, Time and Distance to
 * Descend" (PA-28-161, Report VB-1180, Aug 1982).
 *
 * Provenance: tools/digitize/out/fits/fig_5_31.json — digitized from the
 * 300-dpi page-105 scan and fitted there (surface rms 164 ft; cumulative
 * curve rms 0.184 min / 0.161 nm / 0.082 gal; worked example within ±3.1%
 * on time/distance). Copied verbatim; do not tweak here.
 *
 * Model form (see the fit JSON):
 *   dT  = OAT − ISA(PA)
 *   h_e = PA + a1·dT + a2·dT·PA/1000 + b1·dT² + b2·dT²·PA/1000 + c3·dT³
 *   time_min(h) = T0 + T1·h + T2·h² + T3·h³
 *   dist_nm(h)  = D0 + D1·h + D2·h²
 *   fuel_gal(h) = F0 + F1·h + F2·h² + F3·h³
 * Only differences of two lookups are meaningful (the drawn cumulative
 * curves carry small drafting offsets that cancel in subtraction).
 */

/** Effective-altitude surface h_e(PA, OAT). */
export const HE_SURFACE = {
  a1: -0.5592,
  a2: -11.267,
  b1: -0.0506,
  b2: 0.1514,
  c3: -0.00602,
} as const;

/** Cumulative time from a reference datum, minutes. */
export const TIME_POLY = [0.4489, 0.00199928, -1.31627e-7, 3.7966e-12] as const;

/** Cumulative distance, nautical miles. */
export const DIST_POLY = [1.9562, 0.00281123, -6.1402e-8, 0] as const;

/** Cumulative fuel, US gallons. */
export const FUEL_POLY = [0.1994, 0.00028722, -2.5875e-8, 7.949e-13] as const;

/** Evaluate a cubic [c0, c1, c2, c3] at h. */
export function cubic(c: readonly [number, number, number, number], h: number): number {
  return c[0] + c[1] * h + c[2] * h * h + c[3] * h * h * h;
}
