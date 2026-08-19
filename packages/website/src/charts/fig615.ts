/**
 * Fig 6-15 "C.G. Range and Weight" wiring: the chart's coordinate transform,
 * the POH 2.13 envelope drawn over it, and the loading path.
 *
 * The abscissa is not C.G. despite the axis caption — it encodes moment about
 * an 88-inch reference, so a constant-C.G. line is only vertical at 88 and the
 * C.G. scale stretches with weight. Constants fitted in
 * tools/digitize/out/fits/fig_6_15.json and verified against the printed rays
 * (read back as 88.92/89.91/90.91/91.95/92.93 vs their 89-93 labels).
 */

import type { Category, StationPoint, WeightBalanceResult } from "../model/weightBalance";
import { LIMITS, forwardLimitIn } from "../model/weightBalance";
import metaJson from "./fig-6-15.meta.json";
import type { ChartMeta, Polyline } from "./types";
import { SECTION_COLORS, axisPx } from "./types";

interface MomentAxis {
  aPx: number;
  kPxPerInLb: number;
  cgRefIn: number;
}

export const fig615Meta: ChartMeta = metaJson;
const MOMENT: MomentAxis = metaJson.momentAxis;

/** Chart x for a (C.G., weight) pair. */
export function cgPx(cgIn: number, weightLb: number): number {
  return MOMENT.aPx + MOMENT.kPxPerInLb * weightLb * (cgIn - MOMENT.cgRefIn);
}

export function weightPx(weightLb: number): number {
  return axisPx(fig615Meta.axes.weightLb!, weightLb);
}

const at = (cgIn: number, weightLb: number): [number, number] => [cgPx(cgIn, weightLb), weightPx(weightLb)];

/**
 * The envelope outlines are drawn thin: they exist to confirm the model lines
 * up with the printed chart, so hairlines make misalignment obvious.
 */
const REFERENCE_WIDTH = 0.3;

/** Lowest weight the chart draws — the envelope is clipped here, not limited. */
const CHART_MIN_LB = 1200;

/**
 * The POH 2.13 envelope for a category. Drawn explicitly rather than relying
 * on the printed outline, which bows slightly and is marginally the more
 * permissive at max gross (C.G. 87.93 drawn vs 88.3 tabulated).
 */
export function envelopeOutline(category: Category): Polyline {
  const L = LIMITS[category];

  // The forward cutout is a straight line in C.G. vs weight, but x encodes
  // (cg − 88) × weight, so on this chart its locus is quadratic. Drawing it as
  // a chord between the two tabulated points cuts about 0.3 in inside the true
  // curve at mid-span, so sample it. The other edges really are straight here:
  // constant C.G. is linear in weight, and the top edge is constant weight.
  const cutout: [number, number][] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const w = L.fwdBreakLb + ((L.maxTakeoffLb - L.fwdBreakLb) * i) / steps;
    cutout.push(at(forwardLimitIn(w, category), w));
  }

  // Utility shares its forward, aft and lower edges with normal, so drawing
  // the whole outline twice just hides one under the other: show only the part
  // that differs — its cutout and the 2020 lb cap.
  if (category === "utility") {
    return { points: [...cutout, at(L.aftIn, L.maxTakeoffLb)], color: "#0277BD", dashed: true, widthScale: REFERENCE_WIDTH };
  }

  return {
    points: [at(L.fwdAtBreakIn, CHART_MIN_LB), at(L.fwdAtBreakIn, L.fwdBreakLb), ...cutout, at(L.aftIn, L.maxTakeoffLb), at(L.aftIn, CHART_MIN_LB), at(L.fwdAtBreakIn, CHART_MIN_LB)],
    color: "#C62828",
    widthScale: REFERENCE_WIDTH,
  };
}

export interface Fig615Trace {
  polylines: Polyline[];
  markers: { at: [number, number]; color: string; label: string }[];
}

const OK = SECTION_COLORS.result;
const BAD = "#C62828";

/**
 * Loading path in the POH plotter's own style (Fig 6-15 sample problem): start
 * at the basic empty weight and add one segment per load, then mark the
 * take-off point and the zero-fuel point at the other end of the C.G. travel.
 */
export function fig615Trace(result: WeightBalanceResult): Fig615Trace {
  const polylines: Polyline[] = [envelopeOutline("normal"), envelopeOutline("utility")];

  // Cumulative path: each vertex is the running weight and C.G.
  const segColors = [SECTION_COLORS.entry, SECTION_COLORS.weight, SECTION_COLORS.wind, "#00838F"];
  let w = 0;
  let m = 0;
  let prev: [number, number] | null = null;
  result.rows.forEach((row, i) => {
    w += row.weightLb;
    m += row.momentInLb;
    if (w <= 0) return;
    const here = at(m / w, w);
    if (prev && row.weightLb !== 0) {
      polylines.push({ points: [prev, here], color: segColors[(i - 1) % segColors.length], widthScale: 0.55 });
    }
    prev = here;
  });

  // A grossly out-of-limits load can plot off the sheet entirely; keep the
  // marker just inside so it is always visible (the path still runs off,
  // showing which way, and the banner says how far).
  const clamp = ([x, y]: [number, number]): [number, number] => [Math.min(Math.max(x, 8), fig615Meta.widthPx - 8), Math.min(Math.max(y, 8), fig615Meta.heightPx - 8)];
  const mark = (p: StationPoint, label: string) => ({
    at: clamp(at(p.cgIn, p.weightLb)),
    color: p.ok ? OK : BAD,
    label,
  });

  return {
    polylines,
    markers: [mark(result.zeroFuel, "zero fuel"), mark(result.takeoff, "take-off")],
  };
}
