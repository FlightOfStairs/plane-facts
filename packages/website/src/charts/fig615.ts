/**
 * Fig 6-15 "C.G. Range and Weight" wiring: the chart's coordinate transform
 * and the loading path drawn over it.
 *
 * The abscissa is not C.G. despite the axis caption — it encodes moment about
 * an 88-inch reference, so a constant-C.G. line is only vertical at 88 and the
 * C.G. scale stretches with weight. Constants fitted in
 * tools/digitize/out/fits/fig_6_15.json and verified against the printed rays
 * (read back as 88.92/89.91/90.91/91.95/92.93 vs their 89-93 labels).
 */

import type { StationPoint, WeightBalanceResult } from "../model/weightBalance";
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

export interface Fig615Trace {
  polylines: Polyline[];
  markers: { at: [number, number]; color: string; label: string }[];
}

const OK = SECTION_COLORS.result;
const BAD = "#C62828";

/**
 * The two points that matter: take-off and, once the fuel has burned off, zero
 * fuel — joined to show the C.G. travel over the flight. Fuel sits at 95.0 in,
 * aft of a typical loaded C.G., so burning it walks the C.G. forward.
 */
export function fig615Trace(result: WeightBalanceResult): Fig615Trace {
  // A grossly out-of-limits load can plot off the sheet entirely; keep the
  // markers just inside so they stay visible.
  const clamp = ([x, y]: [number, number]): [number, number] => [Math.min(Math.max(x, 8), fig615Meta.widthPx - 8), Math.min(Math.max(y, 8), fig615Meta.heightPx - 8)];
  const mark = (p: StationPoint, label: string) => ({
    at: clamp(at(p.cgIn, p.weightLb)),
    color: p.ok ? OK : BAD,
    label,
  });

  const takeoff = mark(result.takeoff, "take-off");
  const zeroFuel = mark(result.zeroFuel, "zero fuel");

  return {
    // Dashed grey: the travel between the two points is a connector, not a
    // modelled locus, so it stays subordinate to the coloured end markers.
    polylines: [{ points: [takeoff.at, zeroFuel.at], color: "#616161", dashed: true }],
    markers: [zeroFuel, takeoff],
  };
}
