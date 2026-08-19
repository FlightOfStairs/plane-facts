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

export interface Polyline {
  points: [number, number][];
  dashed?: boolean;
}
