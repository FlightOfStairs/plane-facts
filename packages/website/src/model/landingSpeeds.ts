/**
 * PA-28-161 Warrior II — landing speed strips printed on the landing
 * nomographs (POH Figs 5-35 and 5-37, Report VB-1180, Aug 1982).
 *
 * The printed strips are neither linear in W nor V·√(W/2440); the quadratic
 * fits below (from tools/digitize/out/fits/fig_5_35.json — Fig 5-37 carries
 * the identical touchdown strip) reproduce every printed label on rounding:
 *   approach:  65/63/60/55/49 KIAS at 2440/2200/2000/1800/1600 lb
 *   touchdown: 45/42/40/39/37 KIAS at the same weights
 * At 2440 lb they anchor exactly to physics (touchdown 45 = flaps-40 stall
 * IAS; approach 65 = 1.3×Vs0-CAS converted CAS→IAS via Fig 5-3); at lighter
 * weights the printed values sit deliberately above both rules.
 */

// Quadratic coefficients [c2, c1, c0], V = c2·W² + c1·W + c0 (KIAS).
// Source: tools/digitize/out/fits/fig_5_35.json "speeds".
const APPROACH_QUAD = [-1.8462767576341792e-5, 0.09367906056609555, -53.664583544689435] as const;
const TOUCHDOWN_QUAD = [3.7659362212979275e-6, -0.006041205911196915, 37.219904636299205] as const;

/** Approach speed strip (Fig 5-35), KIAS. Printed range 1600–2440 lb. */
export function approachKias(weightLb: number): number {
  return APPROACH_QUAD[0] * weightLb * weightLb + APPROACH_QUAD[1] * weightLb + APPROACH_QUAD[2];
}

/** Touchdown speed strip (Figs 5-35 & 5-37), KIAS. Printed range 1600–2440 lb. */
export function touchdownKias(weightLb: number): number {
  return TOUCHDOWN_QUAD[0] * weightLb * weightLb + TOUCHDOWN_QUAD[1] * weightLb + TOUCHDOWN_QUAD[2];
}
