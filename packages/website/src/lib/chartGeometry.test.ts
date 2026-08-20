import { describe, expect, test } from "vitest";
import type { AxisMeta, ChartMeta } from "../charts/types";
import { axisPx, axisValue } from "../charts/types";
import { clientToViewBox, decimalsFor, dragToValue, snapToStep } from "./chartGeometry";

/** Fig 5-11's own calibration — a positive x axis and a negative y axis. */
const OAT: AxisMeta = { px0: 69.865, v0: -40, pxPerUnit: 3.74485, orient: "x" };
const DISTANCE: AxisMeta = { px0: 551.57, v0: 0, pxPerUnit: -0.1494095, orient: "y" };
/** Weight runs right to left, so its pixels decrease as the value grows. */
const WEIGHT: AxisMeta = { px0: 444.75, v0: 2300, pxPerUnit: -0.3735, orient: "x" };

const META: ChartMeta = { id: "fig-5-11", title: "t", pdfPage: 95, image: "", widthPx: 1050, heightPx: 620, deskewDeg: 0, axes: { oatC: OAT, distanceFt: DISTANCE, weightLb: WEIGHT } };
const RECT = { left: 0, top: 0, width: 1050, height: 620 };

describe("axisValue", () => {
  test("inverts axisPx exactly, whichever way the axis runs", () => {
    for (const axis of [OAT, DISTANCE, WEIGHT]) {
      for (const value of [-40, 0, 17.5, 1000, 2440]) {
        expect(axisValue(axis, axisPx(axis, value))).toBeCloseTo(value, 9);
      }
    }
  });

  test("reads the printed gridlines back off Fig 5-11", () => {
    // The OAT axis is labelled -40…40; its px0 is the -40 gridline.
    expect(axisValue(OAT, 69.865)).toBeCloseTo(-40, 6);
    expect(axisValue(OAT, axisPx(OAT, 27))).toBeCloseTo(27, 6);
  });
});

describe("clientToViewBox", () => {
  test("maps client pixels to viewBox units at 1:1", () => {
    expect(clientToViewBox(RECT, META, 100, 200)).toEqual({ x: 100, y: 200 });
  });

  test("divides through the render scale", () => {
    const half = { left: 0, top: 0, width: 525, height: 310 };
    expect(clientToViewBox(half, META, 100, 100)).toEqual({ x: 200, y: 200 });
  });

  test("subtracts the element's offset on the page", () => {
    const offset = { left: 40, top: 12, width: 1050, height: 620 };
    expect(clientToViewBox(offset, META, 140, 112)).toEqual({ x: 100, y: 100 });
  });

  test("accounts for letterboxing when the box is the wrong shape", () => {
    // Twice as tall as needed: the scan is centred, leaving slack top and bottom.
    const tall = { left: 0, top: 0, width: 1050, height: 1240 };
    expect(clientToViewBox(tall, META, 0, 620).y).toBeCloseTo(310, 6);
  });
});

describe("snapToStep", () => {
  test("snaps to the step measured from min", () => {
    expect(snapToStep(2103, 1600, 2440, 5)).toBe(2105);
    expect(snapToStep(26.6, -40, 40, 1)).toBe(27);
  });

  test("clamps to the range", () => {
    expect(snapToStep(99, -40, 40, 1)).toBe(40);
    expect(snapToStep(-99, -40, 40, 1)).toBe(-40);
  });

  test("keeps fractional steps clean rather than accumulating float dust", () => {
    expect(snapToStep(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(decimalsFor(0.1)).toBe(1);
    expect(decimalsFor(5)).toBe(0);
  });
});

describe("dragToValue", () => {
  const drag = (clientX: number, extra: Partial<Parameters<typeof dragToValue>[0]> = {}) => dragToValue({ rect: RECT, meta: META, axis: OAT, clientX, clientY: 552, grabOffsetPx: 0, min: -40, max: 40, step: 1, ...extra });

  test("reads the value under the pointer", () => {
    expect(drag(axisPx(OAT, 27))).toBe(27);
    expect(drag(axisPx(OAT, 0))).toBe(0);
  });

  test("clamps beyond the ends of the slider's range", () => {
    expect(drag(1040)).toBe(40);
    expect(drag(0)).toBe(-40);
  });

  test("honours the grab offset so the badge does not jump to the finger", () => {
    // Grabbed 20 px right of the badge's centre: the value is 20 px back.
    expect(drag(axisPx(OAT, 27) + 20, { grabOffsetPx: 20 })).toBe(27);
  });

  test("follows the y coordinate on a vertical axis", () => {
    const value = dragToValue({ rect: RECT, meta: META, axis: DISTANCE, clientX: 0, clientY: axisPx(DISTANCE, 1200), grabOffsetPx: 0, min: 0, max: 4000, step: 50 });
    expect(value).toBe(1200);
  });

  test("tracks a right-to-left axis without flipping the direction", () => {
    // Weight decreases as x grows; dragging right must lower the weight.
    const at2300 = dragToValue({ rect: RECT, meta: META, axis: WEIGHT, clientX: axisPx(WEIGHT, 2300), clientY: 0, grabOffsetPx: 0, min: 1600, max: 2440, step: 5 });
    const rightOfIt = dragToValue({ rect: RECT, meta: META, axis: WEIGHT, clientX: axisPx(WEIGHT, 2300) + 40, clientY: 0, grabOffsetPx: 0, min: 1600, max: 2440, step: 5 });
    expect(at2300).toBe(2300);
    expect(rightOfIt).toBeLessThan(at2300);
  });

  test("applies a chart's own projection, e.g. the mirrored wind axis", () => {
    const WIND: AxisMeta = { px0: 705.755, v0: 0, pxPerUnit: 7.523, orient: "x" };
    const magnitude = dragToValue({ rect: RECT, meta: META, axis: WIND, clientX: axisPx(WIND, 10), clientY: 0, grabOffsetPx: 0, min: 0, max: 15, step: 1 });
    expect(magnitude).toBe(10);
  });
});
