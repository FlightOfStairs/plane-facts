/** Calibration metadata emitted by tools/digitize/export_asset.py. */

export interface AxisMeta {
  /** Pixel coordinate (in the exported asset) of value v0 */
  px0: number;
  v0: number;
  pxPerUnit: number;
  orient: string; // "x" | "y" — kept loose so generated JSON assigns structurally
}

export interface ChartMeta {
  id: string;
  title: string;
  pdfPage: number;
  image: string;
  widthPx: number;
  heightPx: number;
  deskewDeg: number;
  axes: Record<string, AxisMeta>;
}

/** Chart-unit value → asset pixel coordinate. */
export function axisPx(axis: AxisMeta, value: number): number {
  return axis.px0 + (value - axis.v0) * axis.pxPerUnit;
}

/** Asset pixel coordinate → chart-unit value; the inverse of axisPx. */
export function axisValue(axis: AxisMeta, px: number): number {
  return axis.v0 + (px - axis.px0) / axis.pxPerUnit;
}

export interface Polyline {
  points: [number, number][];
  dashed?: boolean;
  /** Stroke color; defaults to SECTION_COLORS.entry. */
  color?: string;
  /** Multiplier on the standard stroke width — thinner for reference lines
   *  whose alignment against the printed chart needs to be judged. */
  widthScale?: number;
}

/**
 * Where a value badge attaches to the scan. Pixel geometry only: the value,
 * its range and its step belong to the page that owns the input, and are
 * joined to this by key in ChartPageLayout.
 *
 * Orientation follows the anchor's axis, never the badge's role — Fig 5-3
 * takes its input on x or on y depending on the direction toggle, and the
 * range/endurance/glide charts read their answer off an x axis while their
 * input slides up the y. Nothing may assume input-is-x.
 */
export interface AxisAnchor {
  /** Key into ChartMeta.axes; supplies px0/pxPerUnit/orient. */
  axis: string;
  /**
   * Perpendicular pixel the arrow tip touches — usually the axis line, or for
   * a "none" badge the point on the line it sits at. Pages whose line moves
   * with the inputs override this per render via HandleWiring.anchorPx.
   */
  atPx: number;
  /** Which way the arrow points, i.e. which side of atPx the badge sits. */
  point: "up" | "down" | "left" | "right";
  /** Trace section to colour-match, so a badge reads as part of its segment. */
  color?: keyof typeof SECTION_COLORS;
}

export type ChartAnchors = Record<string, AxisAnchor>;

/**
 * Standard trace colors, one per nomogram section, in reading order.
 * Palette validated (CVD separation + contrast) over the white scan surface.
 */
export const SECTION_COLORS = {
  /** First panel: altitude/temperature (or the chart's single entry) */
  entry: "#1565C0",
  /** Weight-correction panel */
  weight: "#E65100",
  /** Wind-correction panel */
  wind: "#8E24AA",
  /** Final read-out segment and result marker */
  result: "#2E7D32",
} as const;
