import { describe, expect, test } from "vitest";
import { fig503Anchors, fig503Meta } from "../charts/fig503";
import { fig505Anchors, fig505Meta } from "../charts/fig505";
import { fig507Anchors, fig507Meta } from "../charts/fig507";
import { fig509Anchors, fig509Meta } from "../charts/fig509";
import { fig511Anchors, fig511Meta } from "../charts/fig511";
import { fig513Anchors, fig513Meta } from "../charts/fig513";
import { fig515Anchors, fig515Meta } from "../charts/fig515";
import { fig517Anchors, fig517Meta } from "../charts/fig517";
import { fig519Anchors, fig519Meta } from "../charts/fig519";
import { fig521Anchors, fig521Meta } from "../charts/fig521";
import { fig523Anchors, fig523Meta } from "../charts/fig523";
import { fig525Anchors, fig525Meta } from "../charts/fig525";
import { fig527Anchors, fig527Meta } from "../charts/fig527";
import { fig529Anchors, fig529Meta } from "../charts/fig529";
import { fig531Anchors, fig531Meta } from "../charts/fig531";
import { fig533Anchors, fig533Meta } from "../charts/fig533";
import { fig535Anchors, fig535Meta } from "../charts/fig535";
import { fig537Anchors, fig537Meta } from "../charts/fig537";
import type { ChartAnchors, ChartMeta } from "../charts/types";
import { axisPx } from "../charts/types";
import { resolveBadges } from "./chartHandles";

/** Every chart that carries badges, with the anchors it declares. */
const CHARTS: [string, ChartMeta, ChartAnchors][] = [
  ["fig-5-03", fig503Meta, fig503Anchors],
  ["fig-5-05", fig505Meta, fig505Anchors],
  ["fig-5-07", fig507Meta, fig507Anchors],
  ["fig-5-09", fig509Meta, fig509Anchors],
  ["fig-5-11", fig511Meta, fig511Anchors],
  ["fig-5-13", fig513Meta, fig513Anchors],
  ["fig-5-15", fig515Meta, fig515Anchors],
  ["fig-5-17", fig517Meta, fig517Anchors],
  ["fig-5-19", fig519Meta, fig519Anchors],
  ["fig-5-21", fig521Meta, fig521Anchors],
  ["fig-5-23", fig523Meta, fig523Anchors],
  ["fig-5-25", fig525Meta, fig525Anchors],
  ["fig-5-27", fig527Meta, fig527Anchors],
  ["fig-5-29", fig529Meta, fig529Anchors],
  ["fig-5-31", fig531Meta, fig531Anchors],
  ["fig-5-33", fig533Meta, fig533Anchors],
  ["fig-5-35", fig535Meta, fig535Anchors],
  ["fig-5-37", fig537Meta, fig537Anchors],
];

describe("chart anchors", () => {
  test.each(CHARTS)("%s names axes that exist and sits on the sheet", (_name, meta, anchors) => {
    for (const anchor of Object.values(anchors)) {
      // A typo in an anchor's axis name would otherwise fail silently, since
      // ChartMeta.axes is an index signature.
      expect(meta.axes[anchor.axis], `unknown axis ${anchor.axis}`).toBeDefined();
      const limit = anchor.point === "up" || anchor.point === "down" ? meta.heightPx : meta.widthPx;
      expect(anchor.atPx).toBeGreaterThanOrEqual(0);
      expect(anchor.atPx).toBeLessThanOrEqual(limit);
    }
  });
});

describe("resolveBadges", () => {
  const CONTROLS = {
    oatC: { label: "OAT", unit: "°C", min: -40, max: 40, step: 1 },
    weightLb: { label: "Weight", unit: "lb", min: 1600, max: 2440, step: 5 },
  };

  test("joins page bounds to chart geometry and positions on the axis", () => {
    const badges = resolveBadges(fig511Meta, { anchors: fig511Anchors, controls: CONTROLS, values: { oatC: 27, weightLb: 2175 }, setters: { oatC: () => {}, weightLb: () => {} } });
    const oat = badges.find((b) => b.id === "oatC");
    expect(oat?.text).toBe("27 °C");
    expect(oat?.drag?.min).toBe(-40);
    expect(oat?.drag?.max).toBe(40);
    expect(oat?.drag?.current).toBe(27);
    expect(axisPx(oat!.axis, 27)).toBeCloseTo(axisPx(fig511Meta.axes.oatC!, 27), 9);
  });

  test("an input with no setter is shown but cannot be dragged", () => {
    const badges = resolveBadges(fig511Meta, { anchors: fig511Anchors, controls: CONTROLS, values: { oatC: 27, weightLb: 2175 }, setters: { oatC: () => {} } });
    expect(badges.find((b) => b.id === "weightLb")?.drag).toBeFalsy();
    expect(badges.find((b) => b.id === "oatC")?.drag).toBeTruthy();
  });

  test("output badges are read-only", () => {
    const badges = resolveBadges(fig511Meta, { anchors: fig511Anchors, controls: CONTROLS, values: { oatC: 27 }, setters: {}, outputs: [{ anchor: "groundRollFt", value: 975, text: "975 ft", label: "Ground roll" }] });
    const out = badges.find((b) => b.id === "groundRollFt");
    expect(out?.text).toBe("975 ft");
    expect(out?.drag).toBeUndefined();
  });

  test("a projection drags in axis space and maps back to the input", () => {
    const seen: number[] = [];
    const badges = resolveBadges(fig511Meta, {
      anchors: fig511Anchors,
      controls: { ...CONTROLS, windKt: { label: "Wind", unit: "kt", min: -5, max: 15, step: 1 } },
      values: { windKt: -3 },
      setters: { windKt: (v) => seen.push(v) },
      projections: { windKt: { toAxis: Math.abs, fromAxis: (m, current) => (current < 0 ? -Math.min(m, 5) : m), axisMin: 0, axisMax: 15 } },
    });
    const wind = badges.find((b) => b.id === "windKt");
    // A 3 kt tailwind sits at |3| on the axis, and drags within 0…15.
    expect(wind?.drag?.current).toBe(3);
    expect(wind?.drag?.min).toBe(0);
    wind?.drag?.onChange(4);
    // Sign preserved, and the 5 kt tailwind limit respected.
    expect(seen).toEqual([-4]);
    wind?.drag?.onChange(12);
    expect(seen[1]).toBe(-5);
  });
});
