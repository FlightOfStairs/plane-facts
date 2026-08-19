"""Fig 5-29 (PDF p.104): Endurance (best economy mixture, 48 gal usable).

Layout: y = pressure altitude, majors every 1000 ft (SEA LEVEL..12000,
thicker every 2000). x = endurance in hours on TWO label scales sharing one
continuous minor lattice (15.0 px = 0.2 hr, 1-hr majors every ~75.1 px):
"45 MIN. RESERVE AT 55% POWER" family reads 4..8 hr with 4 hr near px 794,
"NO RESERVE" family reads 4..8 hr with 4 hr near px 1397 (i.e. -8 hr from
the reserve-scale continuation). 75/65/55 percent-power curves per family;
the reserve family is drawn solid, the whole no-reserve family DASHED.

Curves are near-vertical (endurance nearly altitude-independent), so the
oriented-kernel extraction used on 5-25 cannot separate them from vertical
gridlines. Method here:
  1. seed the five bold curves from the thick (>10 px) bands that
     `find_lines` reports on a 71-px vertical opening;
  2. build "cells" = ink minus horizontal grid (runs >= 201 px) minus every
     detected vertical gridline column (thin lines, masked at their own
     detected position/width so dash pixels between columns survive);
  3. corridor-trace each curve on the cells (quadratic x(y), sigma-clip);
  4. recover the dashed no-reserve 55% curve (too broken for find_lines) by
     scanning the band right of the no-reserve 65% curve.

Run:  uv run python charts/fig_5_29.py
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

PAGE = 104
FIGURE = "5-29"
TITLE = "Endurance"
ROI = (slice(300, 1320), slice(630, 2170))
Y_MAJOR_STEP_PX = 74.7  # px per 1000 ft (seed)
X_MAJOR_STEP_PX = 75.1  # px per hour (seed)
X_4HR_RESERVE_NEAR_PX = 794.0  # validated by printed example (4.85 hr)
X_4HR_NORES_NEAR_PX = 1397.0  # validated by printed example (5.45 hr)
FAMILY_SPLIT_PX = 1200.0
Y_TOP_BOUND_PX = 408.0  # 12000 ft: above it curves run under the title box
# Per-curve altitude tops, verified by direct ink-run inspection of the
# raster (see driver history): the 75%-power curves stop early (full-throttle
# limit), the rest run to the title box near 11.9k. Corridor tracing cannot
# find these ends automatically here because a minor gridline absorbed into
# each bold band leaves an unmasked 4-px residue column that is
# indistinguishable, row by row, from the 4-px dashes of the no-reserve
# family.
ALT_CAPS_FT = {
    ("reserve45", "75"): 9400.0,
    ("reserve45", "65"): 11900.0,
    ("reserve45", "55"): 11900.0,
    ("noReserve", "75"): 11800.0,
    ("noReserve", "65"): 11800.0,
    ("noReserve", "55"): 11900.0,
}
# white text boxes inside the plot (x0, x1, y0, y1): their backgrounds erase
# the curves, and their text would otherwise pollute corridor tracing
BOXES = [
    (940, 1335, 555, 645),   # "45 MIN. RESERVE AT 55% POWER"
    (1660, 1960, 585, 650),  # "NO RESERVE"
    (1625, 2155, 815, 1120), # "Example: ..."
]
WORKED = {
    "inputs": {"pressureAltFt": 5000, "power": 0.75},
    "printedReserveHr": 4.85,
    "printedNoReserveHr": 5.45,
}
OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"


def build_y_axis(ink):
    h = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=500)
    hm = [ln for ln in h if ln.thickness >= 3 and ln.pos > 280]
    anchor = max(ln.pos for ln in hm if ln.extent > 1400)  # SEA LEVEL border
    ys, vals = [], []
    for ln in hm:
        k = round((anchor - ln.pos) / Y_MAJOR_STEP_PX)
        if 0 <= k <= 12 and abs(anchor - ln.pos - k * Y_MAJOR_STEP_PX) < 5:
            ys.append(ln.pos)
            vals.append(1000.0 * k)
    return calibrate.fit_axis(ys, vals)


def find_v_lines(ink):
    return calibrate.find_lines(
        calibrate.line_mask(ink, "v", min_len=71), "v", min_extent=550
    )


def build_x_axes(v_lines, band_centers):
    """One continuous 1-hr lattice; two value scales anchored on it."""
    cands = [
        ln
        for ln in v_lines
        if 4 <= ln.thickness <= 10
        and 635 < ln.pos < 2160
        and all(abs(ln.pos - b) > 12 for b in band_centers)
    ]
    x0 = min(
        cands, key=lambda ln: abs(ln.pos - X_4HR_RESERVE_NEAR_PX)
    ).pos
    step0 = X_MAJOR_STEP_PX
    for tol in (5.0, 3.5):
        xs, ks = [], []
        for ln in cands:
            k = round((ln.pos - x0) / step0)
            if abs(ln.pos - x0 - k * step0) < tol:
                xs.append(ln.pos)
                ks.append(k)
        b, a = np.polyfit(ks, xs, 1)
        x0, step0 = a, b
    lat_rms = float(np.sqrt(np.mean((a + b * np.asarray(ks) - np.asarray(xs)) ** 2)))
    res_axis = calibrate.Axis(px0=a, v0=4.0, px_per_unit=b)
    k_nores = round((X_4HR_NORES_NEAR_PX - a) / b)
    nores_axis = calibrate.Axis(px0=a + b * k_nores, v0=4.0, px_per_unit=b)
    return res_axis, nores_axis, lat_rms, len(xs)


def cells_mask(ink, v_lines):
    panel = np.zeros_like(ink)
    panel[ROI] = ink[ROI]
    src = panel.astype(np.uint8)
    hgrid = cv2.morphologyEx(src, cv2.MORPH_OPEN, np.ones((1, 201), np.uint8))
    cells = (src & ~cv2.dilate(hgrid, np.ones((3, 3), np.uint8))).astype(bool)
    for ln in v_lines:
        if ln.thickness <= 10:  # thin verticals = gridlines; mask their column
            lo = int(np.floor(ln.pos - ln.thickness / 2 - 1.5))
            hi = int(np.ceil(ln.pos + ln.thickness / 2 + 1.5))
            cells[:, lo : hi + 1] = False
    # NOTE: minors absorbed into a thick curve band are not detected (and so
    # not masked); their residue above a curve's end is why ALT_CAPS_FT
    # exists — lattice-predicted masking was tried and bit into the curves.
    for x0, x1, y0, y1 in BOXES:
        cells[y0 : y1 + 1, x0 : x1 + 1] = False
    return cells


def refine(coef, cy, cx, ylo, yhi, n_iter=4, halfwidth=9.0, y_bounds=None):
    rows = None
    for _ in range(n_iter):
        pred = np.polyval(coef, cy)
        m = (np.abs(cx - pred) < halfwidth) & (cy >= ylo - 40) & (cy <= yhi + 40)
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


def recover_right_neighbor(ref, cy, cx, y_bounds, gap=(25.0, 75.0)):
    ref_coef, ref_ylo, ref_yhi = ref
    pred = np.polyval(ref_coef, cy)
    m = (cx > pred + gap[0]) & (cx < pred + gap[1]) & (cy > ref_ylo) & (cy < ref_yhi)
    yy, xx = cy[m], cx[m]
    coef = np.polyfit(yy, xx, 1)
    for _ in range(4):
        resid = xx - np.polyval(coef, yy)
        keep = np.abs(resid - np.median(resid)) < 12.0
        coef = np.polyfit(yy[keep], xx[keep], 1)
    coef2 = np.concatenate([[0.0], coef])
    return refine(coef2, cy, cx, yy[keep].min(), yy[keep].max(), y_bounds=y_bounds)


def main():
    img, angle = raster.prepared_page(PAGE)
    ink = raster.binarize(img)
    print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {angle:+.2f} deg")

    y_axis, y_rms = build_y_axis(ink)
    print(
        f"PA axis: SL at y={y_axis.px(0):.1f}, {abs(y_axis.px_per_unit) * 1000:.1f} px per "
        f"1000 ft (rms {y_rms:.2f} px)"
    )

    v_lines = find_v_lines(ink)
    bands = [ln for ln in v_lines if ln.thickness > 10 and 635 < ln.pos < 2160]
    print(f"bold curve bands: {[round(ln.pos, 1) for ln in bands]}")
    res_axis, nores_axis, lat_rms, n_in = build_x_axes(v_lines, [b.pos for b in bands])
    print(
        f"hour lattice: {res_axis.px_per_unit:.2f} px/hr from {n_in} majors "
        f"(rms {lat_rms:.2f} px); reserve 4 hr at x={res_axis.px(4):.1f}, "
        f"no-reserve 4 hr at x={nores_axis.px(4):.1f}"
    )

    cells = cells_mask(ink, v_lines)
    cy, cx = np.nonzero(cells)
    cy = cy.astype(np.float64)
    cx = cx.astype(np.float64)
    y_bounds = (Y_TOP_BOUND_PX, y_axis.px(0) + 8)

    fitted = []
    for b in sorted(bands, key=lambda ln: ln.pos):
        coef0 = np.array([0.0, 0.0, b.pos])
        fitted.append(refine(coef0, cy, cx, 430.0, y_axis.px(0), y_bounds=y_bounds))
    assert len(fitted) == 5, f"expected 5 bold bands, got {len(fitted)}"
    # dashed no-reserve 55%: right neighbor of the no-reserve 65% curve
    fitted.append(recover_right_neighbor(fitted[4], cy, cx, y_bounds))

    labels = [
        ("reserve45", "75"), ("reserve45", "65"), ("reserve45", "55"),
        ("noReserve", "75"), ("noReserve", "65"), ("noReserve", "55"),
    ]

    # clamp each curve to its verified top (see ALT_CAPS_FT) and refit inside
    # the clamped bounds so gridline residue above the end cannot pull the fit
    trimmed = []
    for (grp, lab), (coef, ylo, yhi) in zip(labels, fitted):
        top = max(ylo, y_axis.px(ALT_CAPS_FT[(grp, lab)]))
        trimmed.append(refine(coef, cy, cx, top, yhi, y_bounds=(top, yhi)))
    fitted = trimmed
    samples = {}
    for (grp, lab), (coef, ylo, yhi) in zip(labels, fitted):
        axis = res_axis if grp == "reserve45" else nores_axis
        alt_hi = min(y_axis.value(ylo), 12000.0)
        alt_lo = max(0.0, y_axis.value(yhi))
        alts = np.arange(np.ceil(alt_lo / 500) * 500, alt_hi + 1, 500.0)
        xs = np.polyval(coef, [y_axis.px(a) for a in alts])
        samples[(grp, lab)] = np.column_stack([alts, [axis.value(x) for x in xs]])

    # curves bow slightly (endurance peaks mid-altitude: climb-fuel penalty
    # vs cruise-efficiency gain), so fit quadratic in PA
    def ev(p, alt):
        return p["E0_hr"] + p["b_hr_per_ft"] * alt + p["c_hr_per_ft2"] * alt * alt

    model_params = {}
    resid_all = []
    for (grp, lab), pts in samples.items():
        pa, hr = pts[:, 0], pts[:, 1]
        c, b, a = np.polyfit(pa, hr, 2)
        resid = np.polyval([c, b, a], pa) - hr
        rms_pct = float(np.sqrt(np.mean((resid / hr) ** 2)) * 100)
        resid_all.extend((resid / hr).tolist())
        model_params[f"{grp}_{lab}"] = {
            "E0_hr": round(float(a), 3),
            "b_hr_per_ft": round(float(b), 9),
            "c_hr_per_ft2": round(float(c), 13),
            "altMinFt": float(pa.min()),
            "altMaxFt": float(pa.max()),
            "rmsPct": round(rms_pct, 3),
        }
        print(
            f"  {grp:>9} {lab}%: E = {a:6.3f} {b * 1000:+.4f}*PA/1000 "
            f"{c * 1e6:+.5f}*(PA/1000)^2, PA in [{pa.min():.0f},{pa.max():.0f}], "
            f"rms {rms_pct:.2f}%"
        )
    rms_pct_all = float(np.sqrt(np.mean(np.array(resid_all) ** 2)) * 100)

    we_alt = WORKED["inputs"]["pressureAltFt"]
    got_res = ev(model_params["reserve45_75"], we_alt)
    got_nores = ev(model_params["noReserve_75"], we_alt)
    err_res = (got_res - WORKED["printedReserveHr"]) / WORKED["printedReserveHr"] * 100
    err_nores = (
        (got_nores - WORKED["printedNoReserveHr"]) / WORKED["printedNoReserveHr"] * 100
    )
    print(
        f"worked example @{we_alt} ft 75%: reserve {got_res:.2f} hr vs printed "
        f"{WORKED['printedReserveHr']} ({err_res:+.2f}%), no-reserve {got_nores:.2f} vs "
        f"{WORKED['printedNoReserveHr']} ({err_nores:+.2f}%)"
    )

    deltas = {}
    for _, lab in labels[:3]:
        pr, pn = model_params[f"reserve45_{lab}"], model_params[f"noReserve_{lab}"]
        for alt in (0.0, 5000.0):
            if alt <= min(pr["altMaxFt"], pn["altMaxFt"]):
                deltas[f"{lab}pct_at_{alt:.0f}ft"] = round(ev(pn, alt) - ev(pr, alt), 3)
    print("no-reserve minus reserve endurance (hr):", deltas)

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
        vlines=[res_axis.px(4 + k) for k in range(5)]
        + [nores_axis.px(4 + k) for k in range(5)],
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
            "enduranceHrReserve45": {
                "px0": round(res_axis.px0, 1),
                "v0": res_axis.v0,
                "pxPerUnit": round(res_axis.px_per_unit, 3),
            },
            "enduranceHrNoReserve": {
                "px0": round(nores_axis.px0, 1),
                "v0": nores_axis.v0,
                "pxPerUnit": round(nores_axis.px_per_unit, 3),
            },
        },
        "deskewDeg": round(angle, 2),
        "model": {
            "form": (
                "endurance_hr(group, power, PA_ft) = E0[group,power] "
                "+ b[group,power]*PA_ft + c[group,power]*PA_ft^2. groups: "
                "reserve45 (45 min at 55% power), noReserve. Conditions: "
                "best economy mixture leaned per Section 4, 48 gal usable "
                "fuel; includes time to climb and descend. Endurance is "
                "nearly altitude-independent (curves bow slightly, peak "
                "near mid altitude)."
            ),
            "params": model_params,
            "rmsPct": round(rms_pct_all, 3),
        },
        "curves": [
            {"label": f"{grp} {lab}%", "points": [[round(a, 0), round(v, 3)] for a, v in pts]}
            for (grp, lab), pts in samples.items()
        ],
        "workedExample": {
            "inputs": WORKED["inputs"],
            "printed": {
                "reserveHr": WORKED["printedReserveHr"],
                "noReserveHr": WORKED["printedNoReserveHr"],
            },
            "model": {
                "reserveHr": round(got_res, 3),
                "noReserveHr": round(got_nores, 3),
            },
            "errPct": round(max(abs(err_res), abs(err_nores)), 2),
        },
        "envelope": {
            "pressureAltFt": [0, 12000],
            "perCurveAltLimits": {
                k: [v["altMinFt"], v["altMaxFt"]] for k, v in model_params.items()
            },
            "usableFuelGal": 48,
        },
        "notes": [
            "x axis carries two 1-hr lattice scales on one continuous grid; "
            "the no-reserve family reads 8 hr lower than the reserve-scale "
            "continuation at the same px.",
            "Whole no-reserve family is drawn dashed; reserve family solid.",
            "Endurance includes time to climb and descend.",
            "noReserve-reserve45 deltas (hr): " + json.dumps(deltas),
        ],
    }
    OUT_FITS.mkdir(parents=True, exist_ok=True)
    dest = OUT_FITS / f"fig_{FIGURE.replace('-', '_')}.json"
    dest.write_text(json.dumps(out, indent=2))
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
