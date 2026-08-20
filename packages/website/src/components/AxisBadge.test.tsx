// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TakeoffGroundRoll25Page } from "../pages/TakeoffGroundRoll25Page";

/**
 * The point of these: a handle must drive the very same state the slider
 * drives. jsdom has no SVG layout and no pointer capture, so the drag maths is
 * covered in lib/chartGeometry.test.ts and what is checked here is the wiring —
 * keyboard, aria, and the slider moving with the badge.
 */

// jsdom has no ResizeObserver, which ChartOverlay uses to scale its strokes.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// vitest runs without `globals`, so Testing Library's auto-cleanup is off.
afterEach(cleanup);

const handle = (name: RegExp) => screen.getByRole("slider", { name });

describe("chart handles on a page", () => {
  test("renders one handle per axis-mapped input, and none for the curve-family input", () => {
    render(<TakeoffGroundRoll25Page />);
    expect(handle(/OAT — drag/)).toBeDefined();
    expect(handle(/Weight — drag/)).toBeDefined();
    expect(handle(/Wind .* drag/)).toBeDefined();
    // Pressure altitude is drawn as a family of curves: no axis, no handle.
    expect(screen.queryByRole("slider", { name: /Pressure altitude — drag/ })).toBeNull();
  });

  test("arrow keys move the handle and the page's slider together", () => {
    render(<TakeoffGroundRoll25Page />);
    const badge = handle(/OAT — drag/);
    const before = Number(badge.getAttribute("aria-valuenow"));

    fireEvent.keyDown(badge, { key: "ArrowRight" });
    expect(Number(handle(/OAT — drag/).getAttribute("aria-valuenow"))).toBe(before + 1);

    // The MUI slider in the conditions column is the same state, not a copy.
    const slider = screen.getByRole("slider", { name: "OAT" });
    expect(Number(slider.getAttribute("aria-valuenow"))).toBe(before + 1);
  });

  test("Home and End jump to the ends of the slider's own range", () => {
    render(<TakeoffGroundRoll25Page />);
    fireEvent.keyDown(handle(/Weight — drag/), { key: "Home" });
    // 1600, not the last labelled tick at 1700 — the scale runs past its labels.
    expect(handle(/Weight — drag/).getAttribute("aria-valuenow")).toBe("1600");
    fireEvent.keyDown(handle(/Weight — drag/), { key: "End" });
    expect(handle(/Weight — drag/).getAttribute("aria-valuenow")).toBe("2440");
  });

  test("the wind handle drags magnitude and its toggle flips the sign", () => {
    render(<TakeoffGroundRoll25Page />);
    const wind = handle(/Wind .* drag/);
    // The chart plots |wind|, so the handle's value is a magnitude…
    expect(wind.getAttribute("aria-valuemin")).toBe("0");
    expect(wind.getAttribute("aria-valuetext")).toMatch(/headwind/);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Wind direction/ }));
    expect(handle(/Wind .* drag/).getAttribute("aria-valuetext")).toMatch(/tailwind/);
    // …and switching to tailwind clamps to the chart's 5 kt tailwind limit.
    expect(Number(handle(/Wind .* drag/).getAttribute("aria-valuenow"))).toBeLessThanOrEqual(5);
  });

  test("a pointer drag writes the value under the pointer", () => {
    render(<TakeoffGroundRoll25Page />);
    const badge = handle(/OAT — drag/);
    const svg = badge.closest("svg")!;
    // jsdom reports a zero-sized rect, so stand in for layout.
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1050, height: 620, right: 1050, bottom: 620, x: 0, y: 0, toJSON: () => ({}) });

    // Grab the badge where it actually sits (27 °C ≈ x 321), so the drag
    // carries no offset.
    fireEvent.pointerDown(badge, { pointerId: 1, isPrimary: true, clientX: 321, clientY: 552 });
    fireEvent.pointerMove(badge, { pointerId: 1, clientX: 300, clientY: 552 });

    // x=300 on the OAT axis (px0 69.865, 3.74485 px/°C from -40) ≈ 21 °C.
    expect(handle(/OAT — drag/).getAttribute("aria-valuenow")).toBe("21");
    expect(screen.getByRole("slider", { name: "OAT" }).getAttribute("aria-valuenow")).toBe("21");
  });

  test("read-out badges are not controls", () => {
    render(<TakeoffGroundRoll25Page />);
    expect(screen.queryByRole("slider", { name: /Ground roll/ })).toBeNull();
    expect(screen.getByRole("img", { name: /Ground roll, POH chart/ })).toBeDefined();
  });
});
