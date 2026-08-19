"""Fig 5-19 Fuel, Time and Distance to Climb (POH p. 5-20, PDF page 99).

Nomograph structure: shared unlabeled vertical coordinate (y, px).
  Left panel:  OAT (-40..40 C) on x; curved pressure-altitude family drawn
               every 1000 ft. Labels 1000..12000 attach from BELOW their
               curves; the 12000 curve itself is almost entirely clipped by
               the title box, so usable curves are 1000..11000. The bottom
               border is the sea-level member (all values 0).
               STANDARD TEMPERATURE reference line as on Fig 5-17.
  Right panel: three cumulative-from-sea-level curves mapping y -> value on
               a common 0..80 scale: FUEL (gal), TIME (min), DISTANCE (nm).
Usage: value(cruise PA, cruise OAT) - value(departure PA, departure OAT).

Associated conditions: 2440 lb, flaps 0, full throttle, lean per Lycoming,
79 KIAS, no wind.

Run:  uv run python charts/fig_5_19.py
Outputs: out/fits/fig_5_19.json, out/qa/fig_5_19_calibration.png,
         out/qa/fig_5_19_curves.png
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from scipy.optimize import brentq

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"
PAGE = 99
ISA_LAPSE = 1.9812
Y_TOP, Y_BOT = 530.0, 1419.3  # usable band of the shared y coordinate; bottom border = sea level

# Fig 5-17 fitted climb model (this session) for the integral-consistency check
ROC_C0, ROC_C1, ROC_K = 645.8, -0.048888, 121.0


def isa_temp(pa_ft):
    return 15.0 - ISA_LAPSE * pa_ft / 1000.0


def sigma(pa_ft, oat_c):
    delta = (1.0 - 6.87559e-6 * pa_ft) ** 5.2559
    theta = (oat_c + 273.15) / 288.15
    return delta / theta


def per_row_centerline(comp):
    ys = comp.y.astype(int)
    return np.array([(float(yy), float(np.median(comp.x[ys == yy]))) for yy in np.unique(ys)])


def robust_polyfit(x, y, deg, tol=2.5, iters=5):
    x, y = np.asarray(x, float), np.asarray(y, float)
    for _ in range(iters):
        co = np.polyfit(x, y, deg)
        r = y - np.polyval(co, x)
        keep = np.abs(r) < max(tol, 2.0 * np.std(r))
        if keep.all():
            break
        x, y = x[keep], y[keep]
    return co, float(np.std(y - np.polyval(co, x))), len(x)


def main():
    img, deskew = raster.prepared_page(PAGE)
    ink = raster.binarize(img)
    print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

    # ---------------- calibration ----------------
    oat_px = [419.0, 638.9, 714.1, 788.7, 864.4, 938.7, 1013.7]
    oat_ax, oat_rms = calibrate.fit_axis(oat_px, [-40, -10, 0, 10, 20, 30, 40])
    print(f"OAT axis: 0C at x={oat_ax.px(0):.1f}, {oat_ax.px_per_unit:.3f} px/C, rms {oat_rms:.2f} px")
    # 0..80 scale: majors every 10 units; the 0 gridline is contaminated by the
    # fuel curve, so fit from 10..80 and extrapolate.
    val_px = [1538.8, 1613.3, 1687.7, 1762.1, 1838.5, 1913.7, 1988.7, 2065.0]
    val_ax, val_rms = calibrate.fit_axis(val_px, [10, 20, 30, 40, 50, 60, 70, 80])
    print(f"value axis: 0 at x={val_ax.px(0):.1f}, {val_ax.px_per_unit:.3f} px/unit, rms {val_rms:.2f} px")
    h_majors = [524.9, 674.0, 822.7, 972.7, 1123.3, 1271.5, 1419.3]

    # ---------------- left panel: std-temp line ----------------
    panel = np.zeros(ink.shape, bool)
    panel[220:1416, 423:1130] = ink[220:1416, 423:1130]
    smask = curves.curve_mask(panel, angles_deg=list(np.arange(-68, -87, -2.0)), length=61, exclude_grid=False)
    std = max(curves.components(smask, min_size=800), key=lambda c: c.points.shape[0])
    scl = per_row_centerline(std)
    std_xy = np.polyfit(scl[:, 0], scl[:, 1], 2)  # x(y)
    oat_bot = oat_ax.value(np.polyval(std_xy, Y_BOT))
    print(f"std-temp at bottom border: OAT {oat_bot:.2f} C (ISA sea level = 15.00)")
    assert abs(oat_bot - 15.0) < 0.7

    # ---------------- left panel: altitude family ----------------
    sm = np.zeros(ink.shape, np.uint8)
    sm[std.y.astype(int), std.x.astype(int)] = 1
    sm = cv2.dilate(sm, np.ones((9, 9), np.uint8)).astype(bool)
    fmask = curves.curve_mask(panel & ~sm, angles_deg=list(np.arange(6, 56, 2.0)), length=51, exclude_grid=False)
    comps = curves.components(fmask, min_size=150)
    groups = curves.group_curves(comps, deg=3, tol_px=3.5)
    groups = [g for g in groups if g.points.shape[0] > 500]

    def is_dashed_cruise(g):  # dashed CRUISE ALTITUDE example trace
        cl = curves.centerline(g)
        co = np.polyfit(cl[:, 0], cl[:, 1], 1)
        return abs(co[0]) < 0.05 and 995 < np.mean(cl[:, 1]) < 1020

    groups = [g for g in groups if not is_dashed_cruise(g)]

    frags = []
    for g in groups:
        pts = g.points[g.points[:, 1] > Y_TOP]  # trim top-border ink tails
        if pts.shape[0] < 300:
            continue
        c = curves.Component(points=pts)
        cl = curves.centerline(c)
        co = np.polyfit(cl[:, 0], cl[:, 1], 3)
        frags.append(dict(cl=cl, co=co, x0=float(c.x.min()), x1=float(c.x.max())))
    left = sorted([f for f in frags if f["x0"] < 480], key=lambda f: np.polyval(f["co"], 430))
    right = sorted([f for f in frags if f["x0"] >= 480], key=lambda f: np.polyval(f["co"], f["x0"]))
    print(f"family fragments: {len(left)} left-anchored, {len(right)} right")
    assert len(left) == 11, "expected 11 left-anchored curves (11000..1000 ft)"

    # pair right fragments to left curves: linear extension of the left frag's
    # last 120 px, evaluated at the right frag's start; order-preserving greedy.
    used = set()
    curves_pts = {i: [f_cl for f_cl in [left[i]["cl"]]][0] for i in range(len(left))}
    for rf in right:
        best_i, best_d = None, 25.0
        for i, lf in enumerate(left):
            if i in used or lf["x1"] >= rf["x1"]:
                continue
            tail = lf["cl"][lf["cl"][:, 0] > lf["x1"] - 120]
            lin = np.polyfit(tail[:, 0], tail[:, 1], 1)
            d = abs(np.polyval(lin, rf["x0"]) - np.polyval(rf["co"], rf["x0"]))
            if d < best_d:
                best_i, best_d = i, d
        if best_i is not None:
            used.add(best_i)
            curves_pts[best_i] = np.vstack([curves_pts[best_i], rf["cl"]])
            print(f"  right frag x=[{rf['x0']:.0f},{rf['x1']:.0f}] -> curve #{best_i} (join gap {best_d:.1f} px)")
        else:
            print(f"  right frag x=[{rf['x0']:.0f},{rf['x1']:.0f}] UNPAIRED (12000 remnant / border junk)")

    # per-curve robust cubic y(x); assignment: top curve = 11000 ft
    family = {}
    for i in range(len(left)):
        pa = (11 - i) * 1000
        pts = curves_pts[i]
        co, rms, n = robust_polyfit(pts[:, 0], pts[:, 1], 3, tol=2.5)
        family[pa] = dict(co=co, x0=float(pts[:, 0].min()), x1=float(pts[:, 0].max()), rms=rms)
        # identity check: ISA crossing
        f = lambda y: np.polyval(co, np.polyval(std_xy, y)) - y
        try:
            ystar = brentq(f, 300, 1500)
            implied = (15.0 - oat_ax.value(np.polyval(std_xy, ystar))) / ISA_LAPSE * 1000
        except ValueError:
            implied = np.nan
        print(f"  PA {pa:5d}: x=[{family[pa]['x0']:.0f},{family[pa]['x1']:.0f}] fit rms {rms:.1f} px, "
              f"ISA-crossing implies {implied:6.0f} ft")

    # ---------------- right panel: fuel / time / distance ----------------
    panel_r = np.zeros(ink.shape, bool)
    panel_r[220:1416, 1400:2318] = ink[220:1416, 1400:2318]
    rmask = curves.curve_mask(panel_r, angles_deg=list(np.arange(25, 81, 2.5)), length=51, exclude_grid=False)
    rcomps = curves.components(rmask, min_size=300)
    fuel_comps = [c for c in rcomps if c.x.max() < 1540]
    big = max(rcomps, key=lambda c: c.points.shape[0])

    anchor = (Y_BOT, val_ax.px(0.0))  # all curves pass through (0 units, sea level)

    fpts = np.vstack([c.points for c in fuel_comps])
    ys = fpts[:, 1].astype(int)
    frows = np.array([(yy, np.median(fpts[:, 0][ys == yy])) for yy in np.unique(ys)], float)
    frows = frows[(frows[:, 0] >= Y_TOP) & (frows[:, 0] <= 1412)]
    frows = np.vstack([frows, np.tile(anchor, (30, 1))])
    fuel_fit, f_rms, _ = robust_polyfit(frows[:, 0], frows[:, 1], 2)

    ysb = big.y.astype(int)
    t_rows, d_rows = [], []
    for yy in np.unique(ysb):
        xs = np.sort(big.x[ysb == yy])
        segs = [s for s in np.split(xs, np.flatnonzero(np.diff(xs) > 10) + 1) if len(s) >= 2]
        if len(segs) >= 2 and yy <= 1170:
            t_rows.append((yy, segs[0].mean()))
            d_rows.append((yy, segs[-1].mean()))
        elif len(segs) == 1 and 1175 <= yy <= 1325 and 10 <= segs[0][-1] - segs[0][0] <= 25:
            # time and distance strokes have merged side by side: recover each
            # centerline from the merged run's edges (half stroke width ~2.5 px)
            t_rows.append((yy, segs[0][0] + 2.5))
            d_rows.append((yy, segs[0][-1] - 2.5))
    t_rows, d_rows = np.array(t_rows, float), np.array(d_rows, float)
    t_rows = t_rows[t_rows[:, 0] >= Y_TOP]
    d_rows = d_rows[d_rows[:, 0] >= Y_TOP]
    t_rows = np.vstack([t_rows, np.tile(anchor, (60, 1))])
    d_rows = np.vstack([d_rows, np.tile(anchor, (60, 1))])
    time_fit, t_rms, _ = robust_polyfit(t_rows[:, 0], t_rows[:, 1], 4)
    dist_fit, d_rms, _ = robust_polyfit(d_rows[:, 0], d_rows[:, 1], 4)
    print(f"right curves px-fit rms: fuel {f_rms:.2f}, time {t_rms:.2f}, dist {d_rms:.2f}")

    def val_of_y(fit, y):
        return max(0.0, val_ax.value(np.polyval(fit, y)))

    # ---------------- composition: value(PA, OAT) ----------------
    def y_of(pa, oat):
        """Shared-y for arbitrary PA via linear interpolation between the
        1000-ft family curves (sea level = flat bottom border)."""
        x = oat_ax.px(oat)
        lo = int(np.floor(pa / 1000.0)) * 1000
        hi = lo + 1000

        def curve_y(p):
            if p <= 0:
                return Y_BOT
            f = family[p]
            if not (f["x0"] - 10 <= x <= f["x1"] + 10):
                return None
            return float(np.polyval(f["co"], x))

        ylo, yhi = curve_y(lo), curve_y(min(hi, 11000))
        if ylo is None or yhi is None:
            return None
        return ylo + (yhi - ylo) * (pa - lo) / 1000.0

    def values(pa, oat):
        y = y_of(pa, oat)
        if y is None or not (Y_TOP - 5 <= y <= Y_BOT):
            return None
        return dict(y=y, fuel=val_of_y(fuel_fit, y), time=val_of_y(time_fit, y), dist=val_of_y(dist_fit, y))

    data = []
    for pa in range(1000, 12000, 1000):
        f = family[pa]
        for x in np.arange(f["x0"] + 4, f["x1"] - 4, 10.0):
            oat = oat_ax.value(x)
            y = float(np.polyval(f["co"], x))
            if not (Y_TOP <= y <= 1412):
                continue
            data.append((pa, oat, oat - isa_temp(pa),
                         val_of_y(fuel_fit, y), val_of_y(time_fit, y), val_of_y(dist_fit, y)))
    data = np.array(data)
    PA, OAT, DT, F, T, D = data.T
    print(f"composed dataset: {len(data)} points")

    # ---------------- closed-form model: y = g(PA, OAT) surface + value(y) polys ----------------
    # No simple physical surface (log-in-DA etc.) fits better than ~15%: the
    # drafted family has its own curvature.  The faithful closed form is the
    # nomograph composition itself: a deg-4 polynomial surface for the shared
    # y coordinate, then the right-panel value polynomials.
    def g_basis(p_kft, t_10c, deg=4):
        cols, names = [], []
        for i in range(deg + 1):
            for j in range(deg + 1 - i):
                cols.append(p_kft ** i * t_10c ** j)
                names.append(f"p{i}t{j}")
        return np.column_stack(cols), names

    yfam = []
    for pa in range(1000, 12000, 1000):
        f = family[pa]
        for x in np.arange(f["x0"] + 4, f["x1"] - 4, 10.0):
            y = float(np.polyval(f["co"], x))
            if Y_TOP <= y <= 1412:
                yfam.append((pa, oat_ax.value(x), y))
    yfam = np.array(yfam)
    Ag, g_names = g_basis(yfam[:, 0] / 1000.0, yfam[:, 1] / 10.0)
    g_coef, *_ = np.linalg.lstsq(Ag, yfam[:, 2], rcond=None)
    g_rms = float(np.sqrt(np.mean((Ag @ g_coef - yfam[:, 2]) ** 2)))

    def g_y(pa, oat):
        a, _ = g_basis(np.array([pa / 1000.0]), np.array([oat / 10.0]))
        return float((a @ g_coef)[0])

    # value-space relative rms of the full closed-form chain
    rel_stats = {}
    y_pred = Ag @ g_coef
    for name, fit, floor in (("time", time_fit, 2.0), ("dist", dist_fit, 2.5), ("fuel", fuel_fit, 0.5)):
        vt = np.array([val_of_y(fit, y) for y in yfam[:, 2]])
        vp = np.array([val_of_y(fit, y) for y in y_pred])
        rel = (vp - vt) / np.maximum(vt, floor)
        rel_stats[name] = 100.0 * float(np.sqrt(np.mean(rel ** 2)))
    print(f"g(PA,OAT) deg-4 surface: rms {g_rms:.2f} px; value-space rel-rms "
          f"time {rel_stats['time']:.1f}% dist {rel_stats['dist']:.1f}% fuel {rel_stats['fuel']:.1f}%")

    # implied fuel flow: dF/dT along standard atmosphere
    def v_std(pa):
        r = values(pa, isa_temp(pa))
        return r

    gph = []
    for pa in range(2000, 11001, 2000):
        r1 = v_std(pa - 2000) if pa > 2000 else dict(time=0.0, fuel=0.0)
        r2 = v_std(pa)
        if r1 and r2:
            dtm = r2["time"] - r1["time"]
            if dtm > 0.1:
                gph.append(60.0 * (r2["fuel"] - r1["fuel"]) / dtm)
    print(f"implied fuel flow along std atmosphere: {np.mean(gph):.1f} gph (range {min(gph):.1f}..{max(gph):.1f})")

    # ---------------- integral-consistency vs Fig 5-17 ----------------
    def roc17(h, dt):
        return ROC_C0 + ROC_C1 * (h + ROC_K * dt)

    def integrate(pa, dt, n=200):
        hs = np.linspace(0.0, pa, n + 1)
        rocs = np.maximum(roc17(hs, dt), 1.0)
        t = np.trapezoid(1.0 / rocs, hs)                       # minutes
        tas = 79.0 / np.sqrt(np.array([sigma(h, isa_temp(h) + dt) for h in hs]))
        d = np.trapezoid(tas / 60.0 / rocs, hs)                # nm
        return t, d

    print("integral-consistency check (digitized 5-19 vs integral of 5-17 model):")
    rows_cmp = []
    for pa in (2000, 4000, 6000, 8000, 10000):
        for dt in (-20.0, 0.0, 15.0):
            r = values(pa, isa_temp(pa) + dt)
            if r is None:
                continue
            ti, di = integrate(pa, dt)
            rows_cmp.append((pa, dt, r["time"], ti, r["dist"], di))
            print(f"  PA {pa:5d} dT {dt:+5.0f}: time {r['time']:5.2f} vs {ti:5.2f} min ({100*(r['time']-ti)/max(ti,.1):+5.1f}%)"
                  f"   dist {r['dist']:5.2f} vs {di:5.2f} nm ({100*(r['dist']-di)/max(di,.1):+5.1f}%)")
    rows_cmp = np.array(rows_cmp)
    t_dev = 100 * np.mean((rows_cmp[:, 2] - rows_cmp[:, 3]) / rows_cmp[:, 3])
    d_dev = 100 * np.mean((rows_cmp[:, 4] - rows_cmp[:, 5]) / rows_cmp[:, 5])
    print(f"  mean deviation: time {t_dev:+.1f}%, distance {d_dev:+.1f}%")

    # difference mode (the chart's intended use): cruise minus departure at the
    # same dT — the near-sea-level offset cancels.
    diff_rows = []
    print("difference-mode consistency (climb from 2000 ft):")
    for pa in (4000, 6000, 8000, 10000):
        for dt in (-20.0, 0.0, 15.0):
            r1, r2 = values(2000, isa_temp(2000) + dt), values(pa, isa_temp(pa) + dt)
            if r1 is None or r2 is None:
                continue
            t1, d1 = integrate(2000, dt)
            t2, d2 = integrate(pa, dt)
            dt_dig, dt_int = r2["time"] - r1["time"], t2 - t1
            dd_dig, dd_int = r2["dist"] - r1["dist"], d2 - d1
            diff_rows.append((pa, dt, dt_dig, dt_int, dd_dig, dd_int))
            print(f"  2000->{pa:5d} dT {dt:+5.0f}: time {dt_dig:5.2f} vs {dt_int:5.2f} ({100*(dt_dig-dt_int)/dt_int:+5.1f}%)"
                  f"  dist {dd_dig:5.2f} vs {dd_int:5.2f} ({100*(dd_dig-dd_int)/dd_int:+5.1f}%)")
    diff_rows = np.array(diff_rows)
    t_dev_diff = 100 * np.mean((diff_rows[:, 2] - diff_rows[:, 3]) / diff_rows[:, 3])
    d_dev_diff = 100 * np.mean((diff_rows[:, 4] - diff_rows[:, 5]) / diff_rows[:, 5])
    print(f"  mean difference-mode deviation: time {t_dev_diff:+.1f}%, distance {d_dev_diff:+.1f}%")

    # ---------------- worked example ----------------
    dep = values(1500, 27.0)
    cru = values(5000, 16.0)
    print(f"worked example: departure 1500 ft/27C -> y={dep['y']:.0f}: "
          f"T {dep['time']:.2f} D {dep['dist']:.2f} F {dep['fuel']:.2f} (printed 3/4/1)")
    print(f"                cruise    5000 ft/16C -> y={cru['y']:.0f}: "
          f"T {cru['time']:.2f} D {cru['dist']:.2f} F {cru['fuel']:.2f} (printed 12/16/3)")
    d_time = cru["time"] - dep["time"]
    d_dist = cru["dist"] - dep["dist"]
    d_fuel = cru["fuel"] - dep["fuel"]
    errs = (100 * (d_time - 9) / 9, 100 * (d_dist - 12) / 12, 100 * (d_fuel - 2) / 2)
    print(f"                climb deltas: {d_time:.2f} min ({errs[0]:+.1f}%), "
          f"{d_dist:.2f} nm ({errs[1]:+.1f}%), {d_fuel:.2f} gal ({errs[2]:+.1f}%)  vs printed 9/12/2")

    # ---------------- QA overlays ----------------
    qa.overlay(img, [], vlines=list(oat_px) + list(val_px) + [val_ax.px(0)], hlines=h_majors,
               path="fig_5_19_calibration.png")
    over = []
    for pa, f in family.items():
        xs = np.arange(f["x0"], f["x1"])
        over.append(np.column_stack([xs, np.polyval(f["co"], xs)]))
    yy = np.arange(int(Y_TOP), 1416)
    for fit in (fuel_fit, time_fit, dist_fit):
        over.append(np.column_stack([np.polyval(fit, yy), yy]))
    yy2 = np.arange(527, 1416)
    over.append(np.column_stack([np.polyval(std_xy, yy2), yy2]))
    qa.overlay(img, over, path="fig_5_19_curves.png")

    # ---------------- emit JSON ----------------
    curves_out = []
    for pa in sorted(family):
        f = family[pa]
        pts = []
        for x in np.arange(f["x0"] + 2, f["x1"] - 2, 15.0):
            y = float(np.polyval(f["co"], x))
            if Y_TOP <= y <= Y_BOT:
                pts.append([round(float(oat_ax.value(x)), 2), round(y, 1)])
        curves_out.append({"label": f"PA {pa} ft: [OAT C, y px]", "points": pts})
    ysamp = np.arange(Y_TOP, 1416, 25.0)
    for name, fit in (("FUEL gal", fuel_fit), ("TIME min", time_fit), ("DISTANCE nm", dist_fit)):
        curves_out.append({
            "label": f"{name}: [value, y px]",
            "points": [[round(val_of_y(fit, y), 2), float(y)] for y in ysamp],
        })

    out = {
        "figure": "5-19",
        "pdfPage": PAGE,
        "title": "Fuel, Time and Distance to Climb (2440 lb, flaps 0, full throttle, lean, 79 KIAS, no wind)",
        "calibration": {
            "oat_C": {"px0": oat_ax.px0, "v0": oat_ax.v0, "pxPerUnit": oat_ax.px_per_unit},
            "value_0to80": {"px0": val_ax.px0, "v0": val_ax.v0, "pxPerUnit": val_ax.px_per_unit},
        },
        "deskewDeg": round(float(deskew), 2),
        "model": {
            "form": "two-stage nomograph composition: y_px = sum g[p{i}t{j}] * (PA_ft/1000)^i * (OAT_C/10)^j "
                    "(deg-4 surface), then value = clamp0(polyval(P_curve, y_px) - x0)/pxPerUnit for each of "
                    "time/dist/fuel (P_* are px-space polynomials x(y)); "
                    "climb value = V(cruise PA, cruise OAT) - V(departure PA, departure OAT)",
            "params": {
                "gSurface": {n: round(float(c), 5) for n, c in zip(g_names, g_coef)},
                "yRange": [Y_TOP, Y_BOT],
                "timePoly_x_of_y": [round(float(c), 12) for c in time_fit],
                "distPoly_x_of_y": [round(float(c), 12) for c in dist_fit],
                "fuelPoly_x_of_y": [round(float(c), 12) for c in fuel_fit],
                "impliedFuelFlow_gph": round(float(np.mean(gph)), 1),
            },
            "rmsPct": round(max(rel_stats.values()), 2),
            "gSurfaceRmsPx": round(g_rms, 2),
            "valueRelRmsPct": {k: round(v, 2) for k, v in rel_stats.items()},
        },
        "curves": curves_out,
        "workedExample": {
            "inputs": {"departure": {"pa_ft": 1500, "oat_C": 27}, "cruise": {"pa_ft": 5000, "oat_C": 16}},
            "printed": {"time_min": 9, "dist_nm": 12, "fuel_gal": 2,
                        "gross": {"time": [12, 3], "dist": [16, 4], "fuel": [3, 1]}},
            "model": {
                "departure": {k: round(dep[k], 2) for k in ("time", "dist", "fuel")},
                "cruise": {k: round(cru[k], 2) for k in ("time", "dist", "fuel")},
                "deltas": {"time_min": round(d_time, 2), "dist_nm": round(d_dist, 2), "fuel_gal": round(d_fuel, 2)},
            },
            "errPct": {"time": round(errs[0], 1), "dist": round(errs[1], 1), "fuel": round(errs[2], 1)},
        },
        "envelope": {
            "pa_ft": [0, 11000],
            "oat_C": [-40, 40],
            "note": "family drawn every 1000 ft, labels 1000..12000; the 12000 curve is clipped by the "
                    "title box and unusable; sea level = flat bottom border (all values 0); each curve "
                    "drawn over a limited OAT span (upper altitudes only at cold OAT)",
        },
        "integralConsistency": {
            "against": "fig 5-17 model ROC = 645.8 - 0.048888*(PA + 121*(OAT-ISA))",
            "meanDevPct": {"time": round(float(t_dev), 1), "dist": round(float(d_dev), 1)},
            "meanDevPctDifferenceMode": {"time": round(float(t_dev_diff), 1), "dist": round(float(d_dev_diff), 1)},
            "grid": [
                {"pa_ft": int(r[0]), "dT_C": float(r[1]),
                 "time_digitized": round(float(r[2]), 2), "time_integral": round(float(r[3]), 2),
                 "dist_digitized": round(float(r[4]), 2), "dist_integral": round(float(r[5]), 2)}
                for r in rows_cmp
            ],
        },
        "notes": [
            "Shared nomograph y is unitless px; right-panel curves stored as [value, y px]; "
            "left family as [OAT C, y px]; compose left->y->right.",
            "Curve identity: labels attach from BELOW (as Fig 5-11); confirmed by ISA crossings of the "
            "STANDARD TEMPERATURE line and by the printed example trace (dashed CRUISE ALTITUDE line at "
            "y~1003 = 5000 ft @ 16 C).",
            "ISA crossings measure ~150-400 ft above nominal (drafting); identity unambiguous.",
            "All three curves anchored to (0 units, sea-level bottom border).",
            "Time/dist values assume the departure/cruise lookups each define an ISA+dT atmosphere; "
            "the chart's subtraction rule is exact only when both lookups share dT.",
            "Absolute cumulative values run above the integral of the 5-17 ROC model, most at low "
            "altitude (~+0.6..1.4 min, ~+0.5..1.7 nm; +34% at 2000 ft cold shrinking to +3..7% at "
            "10000 ft) - consistent with a near-sea-level allowance drafted into the curves. In the "
            "chart's intended difference mode the offset cancels (see meanDevPctDifferenceMode).",
        ],
    }
    OUT_FITS.mkdir(parents=True, exist_ok=True)
    with open(OUT_FITS / "fig_5_19.json", "w") as fjson:
        json.dump(out, fjson, indent=1)
    print("wrote out/fits/fig_5_19.json")
    return out


if __name__ == "__main__":
    main()
