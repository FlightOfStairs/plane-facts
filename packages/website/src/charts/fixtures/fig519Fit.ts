/**
 * Fitted coefficient tables for POH Figure 5-19 (Fuel, Time and Distance to
 * Climb), PA-28-161 Warrior II, Report VB-1180 p. 99.
 *
 * Provenance: tools/digitize/out/fits/fig_5_19.json — two-stage nomograph
 * composition fitted to the 300-dpi scan (deskew −0.25°):
 *   1. y_px = Σ G_SURFACE[i][j] · (PA_ft/1000)^i · (OAT_C/10)^j  (deg-4 surface,
 *      rms 3.4 px against the digitized altitude-curve family), then
 *   2. value = clamp0(polyval(P, y_px) − VALUE_X0_PX) / VALUE_PX_PER_UNIT for
 *      each of time/dist/fuel (P are px-space polynomials x(y); value rms
 *      1.07–1.25% against the digitized curves).
 * All pixel coordinates refer to the ORIGINAL 300-dpi page scan.
 */

/** g[i][j] multiplies (PA_ft/1000)^i · (OAT_C/10)^j. Unfitted terms are 0. */
export const G_SURFACE: readonly (readonly number[])[] = [
  [1415.44308, -3.69538, 0.11986, 0.06483, 0.01042],
  [-67.93934, 2.01982, -0.56926, -0.07282, 0],
  [-0.94882, -1.7331, -0.01552, 0, 0],
  [0.07005, 0.08526, 0, 0, 0],
  [-0.00822, 0, 0, 0, 0],
];

/** y_px span over which the value polynomials are valid (top, bottom). */
export const Y_RANGE_PX: readonly [number, number] = [530.0, 1419.3];

/** x_px(y_px) polynomials, highest-degree coefficient first. */
export const TIME_POLY = [1.014e-9, -4.798084e-6, 0.008508439485, -6.917206749729, 3746.081237882269] as const;
export const DIST_POLY = [1.721e-9, -8.021987e-6, 0.014056707079, -11.27640563871, 5103.226477679855] as const;
export const FUEL_POLY = [5.8984824e-5, -0.186140729799, 1607.54757745534] as const;

/** Shared bottom value axis: value 10 sits at x px 1537.858, 7.5176 px/unit. */
export const VALUE_PX_PER_UNIT = 7.517619047619064;
/** x px of value 0 on the shared axis (= px0 − 10·pxPerUnit). */
export const VALUE_X0_PX = 1537.8583333333333 - 10 * VALUE_PX_PER_UNIT;

/** Chart-implied constant climb fuel flow, GPH (from the fit notes). */
export const IMPLIED_FUEL_FLOW_GPH = 12.0;
