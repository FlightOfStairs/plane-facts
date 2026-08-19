"""Fig 5-27 (PDF p.103): Best Economy Mixture Range.

Same layout family as Fig 5-25 (see charts/fig_5_25.py): y = pressure
altitude, x = range (nm) on TWO label scales sharing one 50-nm major
lattice — "45 MIN RESERVE AT 55% POWER" family reads 500..650 and the
"NO RESERVE" family reads 600..750, offset -100 nm from the reserve-scale
continuation at the same px. 75/65/55 percent-power curves per family.

This page is printed bolder (minor gridlines up to 8 px, majors 9-13 px),
so the pure oriented-opening extraction that worked for 5-25 leaves the
steepest curve (~80 deg) fragmented. Method here:
  1. seed fragments via oriented opening (50..72 deg, length 51);
  2. group fragments into curves (combined-fit residual gate, x(y));
  3. refine each curve by corridor tracing against "cells" = ink minus
     true grid (vertical/horizontal runs >= 201 px are unambiguously grid:
     a 77-80 deg curve stroke yields <= ~45-px vertical runs);
  4. recover the one curve the seeds miss (reserve 55%, steepest) by
     scanning the corridor to the right of the reserve 65% curve.

Printed temp correction: ADD 0.7 nm per deg C above standard temperature,
SUBTRACT 1.1 nm per deg C below standard.

Run:  uv run python charts/fig_5_27.py
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

PAGE = 103
FIGURE = "5-27"
TITLE = "Best Economy Mixture Range"
ROI = (slice(245, 1438), slice(1080, 2310))
Y_MAJOR_STEP_PX = 149.1
X_MAJOR_STEP_PX = 151.4
X_MAJOR_MIN_PX = 1100.0  # ignore axis-strip verticals left of the plot
# reserve-scale value of the last lattice line: labeled 750 on the
# no-reserve scale, i.e. 850 on the reserve-scale continuation (offset -100)
RIGHTMOST_MAJOR_RESERVE_NM = 850.0
NO_RESERVE_OFFSET = -100.0
TEMP_CORR = {"perDegAboveStd": 0.7, "perDegBelowStd": 1.1}
WORKED = {
    "inputs": {"pressureAltFt": 5000, "oatC": 16, "power": 0.75},
    "printedReserveNm": 567.0,
    "printedNoReserveNm": 635.0,
}
OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"


def build_axes(ink):
    h = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=700)
    v = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=600)

    # y: anchor SEA LEVEL = bottom long line, ~149-px progression upward
    hm = [ln for ln in h if ln.thickness >= 4 and ln.pos > 300]
    anchor = max(ln.pos for ln in hm if ln.extent > 1300)
    ys, vals = [], []
    for ln in hm:
        k = round((anchor - ln.pos) / Y_MAJOR_STEP_PX)
        if 0 <= k <= 6 and abs(anchor - ln.pos - k * Y_MAJOR_STEP_PX) < 6:
            ys.append(ln.pos)
            vals.append(2000.0 * k)
    y_axis, y_rms = calibrate.fit_axis(ys, vals)

    # x: 50-nm lattice from thick verticals inside the plot; RANSAC anchor
    vm = [ln for ln in v if ln.thickness >= 6 and ln.pos > X_MAJOR_MIN_PX]
    best = None
    for cand in vm:
        inliers = [
            ln.pos
            for ln in vm
            if abs(ln.pos - cand.pos - round((ln.pos - cand.pos) / X_MAJOR_STEP_PX) * X_MAJOR_STEP_PX) < 6
        ]
        if best is None or len(inliers) > len(best):
            best = inliers
    x0 = min(best)
    step0 = X_MAJOR_STEP_PX
    for tol in (8.0, 4.0):
        xs, ks = [], []
        for ln in vm:
            k = round((ln.pos - x0) / step0)
            if abs(ln.pos - x0 - k * step0) < tol:
                xs.append(ln.pos)
                ks.append(k)
        b, a = np.polyfit(ks, xs, 1)
        x0, step0 = a, b
    lat_rms = float(np.sqrt(np.mean((a + b * np.asarray(ks) - np.asarray(xs)) ** 2)))
    k_max = max(ks)
    res_axis = calibrate.Axis(
        px0=a + b * k_max, v0=RIGHTMOST_MAJOR_RESERVE_NM, px_per_unit=b / 50.0
    )
    nores_axis = calibrate.Axis(
        px0=res_axis.px0,
        v0=RIGHTMOST_MAJOR_RESERVE_NM + NO_RESERVE_OFFSET,
        px_per_unit=res_axis.px_per_unit,
    )
    return y_axis, y_rms, res_axis, nores_axis, lat_rms


def cells_mask(ink):
    """Ink minus true grid (long straight runs), the pure-curve pixels."""
    panel = np.zeros_like(ink)
    panel[ROI] = ink[ROI]
    src = panel.astype(np.uint8)
    vgrid = cv2.morphologyEx(src, cv2.MORPH_OPEN, np.ones((201, 1), np.uint8))
    hgrid = cv2.morphologyEx(src, cv2.MORPH_OPEN, np.ones((1, 201), np.uint8))
    grid = cv2.dilate(vgrid | hgrid, np.ones((3, 3), np.uint8))
    return (src & ~grid).astype(bool), panel


def seed_groups(panel):
    mask = curves.curve_mask(
        panel, angles_deg=list(np.arange(50, 72.1, 2)), length=51, exclude_grid=False
    )
    comps = curves.components(mask, min_size=60)
    seeds = [
        c
        for c in comps
        if (c.x.max() - c.x.min()) >= 25 and (c.y.max() - c.y.min()) > 50
    ]
    swapped = [curves.Component(points=c.points[:, ::-1]) for c in seeds]
    groups = curves.group_curves(swapped, deg=2, tol_px=3.5, max_gap=500.0)
    return [g for g in groups if g.points.shape[0] > 800]  # points are (y, x)


def refine(coef, cy, cx, ylo, yhi, n_iter=3, halfwidth=7.0, y_bounds=None):
    """Iterate: corridor around x(y) quadratic, sigma-clip, refit, grow.
    y_bounds, when given, hard-limits the corridor (no growth past it)."""
    rows = None
    for _ in range(n_iter):
        pred = np.polyval(coef, cy)
        m = (np.abs(cx - pred) < halfwidth) & (cy >= ylo - 30) & (cy <= yhi + 30)
        if y_bounds is not None:
            m &= (cy >= y_bounds[0]) & (cy <= y_bounds[1])
        yy, xx = cy[m], cx[m]
        c_new = np.polyfit(yy, xx, 2)
        resid = xx - np.polyval(c_new, yy)
        s = max(1.5, float(resid.std()))
        keep = np.abs(resid) < 2.5 * s
        coef = np.polyfit(yy[keep], xx[keep], 2)
        rows = np.unique(yy[keep])
        ylo, yhi = rows.min(), rows.max()
    return coef, float(ylo), float(yhi)


def recover_right_neighbor(ref_coef, ref_ylo, ref_yhi, cy, cx, gap=(15.0, 75.0)):
    """Find the curve running just right of a refined curve (used for the
    steep reserve-55% line the seeds miss): collect cells in a band right of
    the reference, robust-fit, then corridor-refine."""
    pred = np.polyval(ref_coef, cy)
    m = (cx > pred + gap[0]) & (cx < pred + gap[1]) & (cy > ref_ylo) & (cy < ref_yhi)
    yy, xx = cy[m], cx[m]
    # robust line through the densest ridge: iterate median-offset line
    coef = np.polyfit(yy, xx, 1)
    for _ in range(4):
        resid = xx - np.polyval(coef, yy)
        keep = np.abs(resid - np.median(resid)) < 12.0
        coef = np.polyfit(yy[keep], xx[keep], 1)
    coef2 = np.concatenate([[0.0], coef])  # promote to quadratic
    # hard-bound to the reference curve's extent: above it the printed curve
    # runs under the title boxes and the corridor would chain onto box text
    return refine(
        coef2, cy, cx, yy[keep].min(), yy[keep].max(), y_bounds=(ref_ylo, ref_yhi)
    )


def main():
    img, angle = raster.prepared_page(PAGE)
    ink = raster.binarize(img)
    print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {angle:+.2f} deg")

    y_axis, y_rms, res_axis, nores_axis, lat_rms = build_axes(ink)
    print(
        f"PA axis: SL at y={y_axis.px(0):.1f}, {abs(y_axis.px_per_unit) * 2000:.1f} px per "
        f"2000 ft (rms {y_rms:.2f} px)"
    )
    print(
        f"range lattice: 50 nm per {res_axis.px_per_unit * 50:.2f} px, reserve 750 at "
        f"x={res_axis.px(750):.1f}, no-reserve 700 at x={nores_axis.px(700):.1f} "
        f"(lattice rms {lat_rms:.2f} px)"
    )

    cells, panel = cells_mask(ink)
    cy, cx = np.nonzero(cells)
    cy = cy.astype(np.float64)
    cx = cx.astype(np.float64)

    groups = seed_groups(panel)
    print(f"seed groups: {len(groups)}")
    fitted = []  # (coef, ylo, yhi)
    for g in sorted(groups, key=lambda g: g.points[:, 1].mean()):
        y, x = g.points[:, 0], g.points[:, 1]
        coef = np.polyfit(y, x, 2)
        fitted.append(refine(coef, cy, cx, y.min(), y.max()))

    # recover reserve 55%: right neighbor of the 2nd-from-left curve (65%)
    x_bots = [np.polyval(c, y_axis.px(0)) for c, _, _ in fitted]
    order = np.argsort(x_bots)
    fitted = [fitted[i] for i in order]
    assert len(fitted) == 5, f"expected 5 seeded curves, got {len(fitted)}"
    res65 = fitted[1]
    fitted.insert(2, recover_right_neighbor(res65[0], res65[1], res65[2], cy, cx))

    labels = [
        ("reserve45", "75"), ("reserve45", "65"), ("reserve45", "55"),
        ("noReserve", "75"), ("noReserve", "65"), ("noReserve", "55"),
    ]
    samples = {}
    for (grp, lab), (coef, ylo, yhi) in zip(labels, fitted):
        axis = res_axis if grp == "reserve45" else nores_axis
        alt_hi = y_axis.value(ylo)
        alt_lo = max(0.0, y_axis.value(min(yhi, y_axis.px(0))))
        alts = np.arange(np.ceil(alt_lo / 500) * 500, alt_hi + 1, 500.0)
        xs = np.polyval(coef, [y_axis.px(a) for a in alts])
        samples[(grp, lab)] = np.column_stack([alts, [axis.value(x) for x in xs]])

    model_params = {}
    resid_all = []
    for (grp, lab), pts in samples.items():
        pa, nm = pts[:, 0], pts[:, 1]
        b, a = np.polyfit(pa, nm, 1)
        resid = a + b * pa - nm
        rms_pct = float(np.sqrt(np.mean((resid / nm) ** 2)) * 100)
        resid_all.extend((resid / nm).tolist())
        model_params[f"{grp}_{lab}"] = {
            "R0_nm": round(float(a), 1),
            "slope_nm_per_ft": round(float(b), 6),
            "altMinFt": float(pa.min()),
            "altMaxFt": float(pa.max()),
            "rmsPct": round(rms_pct, 3),
        }
        print(
            f"  {grp:>9} {lab}%: R = {a:6.1f} + {b * 1000:.3f} nm/1000ft * PA, "
            f"PA in [{pa.min():.0f},{pa.max():.0f}], rms {rms_pct:.2f}%"
        )
    rms_pct_all = float(np.sqrt(np.mean(np.array(resid_all) ** 2)) * 100)

    we_alt = WORKED["inputs"]["pressureAltFt"]
    got_res = (
        model_params["reserve45_75"]["R0_nm"]
        + model_params["reserve45_75"]["slope_nm_per_ft"] * we_alt
    )
    got_nores = (
        model_params["noReserve_75"]["R0_nm"]
        + model_params["noReserve_75"]["slope_nm_per_ft"] * we_alt
    )
    err_res = (got_res - WORKED["printedReserveNm"]) / WORKED["printedReserveNm"] * 100
    err_nores = (
        (got_nores - WORKED["printedNoReserveNm"]) / WORKED["printedNoReserveNm"] * 100
    )
    print(
        f"worked example @{we_alt} ft 75%: reserve {got_res:.1f} nm vs printed "
        f"{WORKED['printedReserveNm']} ({err_res:+.2f}%), no-reserve {got_nores:.1f} vs "
        f"{WORKED['printedNoReserveNm']} ({err_nores:+.2f}%)"
    )

    deltas = {}
    for _, lab in labels[:3]:
        pr, pn = model_params[f"reserve45_{lab}"], model_params[f"noReserve_{lab}"]
        lo = max(pr["altMinFt"], pn["altMinFt"])
        hi = min(pr["altMaxFt"], pn["altMaxFt"])
        for alt in (0.0, 5000.0, hi):
            if lo <= alt <= hi:
                d = (pn["R0_nm"] + pn["slope_nm_per_ft"] * alt) - (
                    pr["R0_nm"] + pr["slope_nm_per_ft"] * alt
                )
                deltas[f"{lab}pct_at_{alt:.0f}ft"] = round(d, 1)
    print("no-reserve minus reserve range (nm):", deltas)

    qa_curves = []
    for (grp, lab), pts in samples.items():
        axis = res_axis if grp == "reserve45" else nores_axis
        qa_curves.append(
            np.column_stack(
                [[axis.px(v) for v in pts[:, 1]], [y_axis.px(a) for a in pts[:, 0]]]
            )
        )
    qa.overlay(
        img,
        qa_curves,
        vlines=[res_axis.px(500 + 50 * k) for k in range(6)],
        hlines=[y_axis.px(a) for a in range(0, 12001, 2000)],
        path=f"fig_{FIGURE.replace('-', '_')}_fit.png",
    )

    out = {
        "figure": FIGURE,
        "pdfPage": PAGE,
        "title": TITLE,
        "calibration": {
            "pressureAltFt": {
                "px0": round(y_axis.px0, 1),
                "v0": y_axis.v0,
                "pxPerUnit": round(y_axis.px_per_unit, 5),
            },
            "rangeNmReserve45": {
                "px0": round(res_axis.px0, 1),
                "v0": res_axis.v0,
                "pxPerUnit": round(res_axis.px_per_unit, 4),
            },
            "rangeNmNoReserve": {
                "px0": round(nores_axis.px0, 1),
                "v0": nores_axis.v0,
                "pxPerUnit": round(nores_axis.px_per_unit, 4),
            },
        },
        "deskewDeg": round(angle, 2),
        "model": {
            "form": (
                "range_nm(group, power, PA_ft, OAT_C) = R0[group,power] "
                "+ slope[group,power]*PA_ft + tempCorr; tempCorr = "
                "+0.7*(OAT-Tstd) if OAT>Tstd else +1.1*(OAT-Tstd); "
                "Tstd = 15 - 1.9812*PA_ft/1000. groups: reserve45 "
                "(45 min at 55% power), noReserve. Conditions: 2300 lb, "
                "no wind, 48 gal usable, leaned best economy, wheel "
                "fairings (up to -7% without)."
            ),
            "params": {**model_params, "tempCorr": TEMP_CORR},
            "rmsPct": round(rms_pct_all, 3),
        },
        "curves": [
            {"label": f"{grp} {lab}%", "points": [[round(a, 0), round(v, 1)] for a, v in pts]}
            for (grp, lab), pts in samples.items()
        ],
        "workedExample": {
            "inputs": WORKED["inputs"],
            "printed": {
                "reserveNm": WORKED["printedReserveNm"],
                "noReserveNm": WORKED["printedNoReserveNm"],
                "reserveCorrectedNm": WORKED["printedReserveNm"] + 0.7 * 11,
                "noReserveCorrectedNm": WORKED["printedNoReserveNm"] + 0.7 * 11,
            },
            "model": {
                "reserveNm": round(got_res, 1),
                "noReserveNm": round(got_nores, 1),
                "reserveCorrectedNm": round(got_res + 0.7 * 11, 1),
                "noReserveCorrectedNm": round(got_nores + 0.7 * 11, 1),
            },
            "errPct": round(max(abs(err_res), abs(err_nores)), 2),
        },
        "envelope": {
            "pressureAltFt": [0, 12000],
            "perCurveAltLimits": {
                k: [v["altMinFt"], v["altMaxFt"]] for k, v in model_params.items()
            },
            "weightLb": 2300,
            "windKt": 0,
            "usableFuelGal": 48,
        },
        "notes": [
            "x axis carries two 50-nm lattice scales: no-reserve family reads "
            "100 nm lower than the reserve-scale continuation at the same px.",
            "Dashed worked-example arrows land at px(567 reserve) and "
            "px(635 no-reserve), confirming both scale calibrations.",
            "Range includes distance to climb and descend.",
            "noReserve-reserve45 deltas (nm): " + json.dumps(deltas),
        ],
    }
    OUT_FITS.mkdir(parents=True, exist_ok=True)
    dest = OUT_FITS / f"fig_{FIGURE.replace('-', '_')}.json"
    dest.write_text(json.dumps(out, indent=2))
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
