"""Fig 5-25 (PDF p.102): Best Power Mixture Range.

Layout: y = pressure altitude (SEA LEVEL..12000 ft majors every 2000 ft;
grid continues above 12000). Far-left strip: standard temperature (deg C),
redundant with PA (std lapse). x = range in nautical miles, but with TWO
label scales sharing one 50-nm-major lattice:
  - "45 MIN RESERVE @ 55% POWER" family reads 450/500/550/600 at lattice
    indices k = 4..7,
  - "NO RESERVE" family reads 500/550/600/650 at k = 8..11
  (same pixel lattice; no-reserve value = reserve-scale value - 150 nm).
Each family has 75/65/55 percent-power curves leaning right with altitude.

Printed temp correction (captured as model terms): ADD 0.6 nm per deg C
above standard temperature, SUBTRACT 1 nm per deg C below standard.

Conditions: mixture leaned per Section 4, mid-cruise weight 2300 lb, no
wind, 48 gal usable, wheel fairings (range may be reduced up to 7% without).

Run:  uv run python charts/fig_5_25.py
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

# ----- chart-specific configuration -----------------------------------------
PAGE = 102
FIGURE = "5-25"
TITLE = "Best Power Mixture Range"
# plot ROI (excludes PA/std-temp axis strips at left and title boxes)
ROI = (slice(280, 1465), slice(940, 2350))
# x lattice: 50-nm majors; reserve scale value at lattice index k
RESERVE_K0_VALUE = 250.0  # value on the reserve scale at lattice index 0
NO_RESERVE_OFFSET = -150.0  # no-reserve value = reserve-scale value + this
# family split: components left of this px belong to the 45-min-reserve family
FAMILY_SPLIT_PX = 1700.0
Y_MAJOR_STEP_PX = 149.0  # nominal px per 2000-ft major (seed for filtering)
X_MAJOR_STEP_PX = 150.2  # nominal px per 50-nm major (seed for filtering)
TEMP_CORR = {"perDegAboveStd": 0.6, "perDegBelowStd": 1.0}
WORKED = {
    "inputs": {"pressureAltFt": 5000, "oatC": 16, "power": 0.75},
    "printedReserveNm": 501.0,
    "printedNoReserveNm": 561.0,
}
OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"


def build_axes(ink):
    """Calibrate PA axis (y) and the two range scales (x) from thick majors."""
    h = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=400)
    v = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=300)

    # y: PA majors every 2000 ft, 12000 down to SEA LEVEL. Anchor on the
    # bottom border (SEA LEVEL, thick + long), keep lines on a ~149-px
    # arithmetic progression from it.
    hm = [ln for ln in h if ln.thickness >= 5 and ln.extent >= 900 and ln.pos > 500]
    anchor = max(ln.pos for ln in hm if ln.extent > 1300)
    step = Y_MAJOR_STEP_PX
    ys, vals = [], []
    for ln in hm:
        k = round((anchor - ln.pos) / step)
        if 0 <= k <= 6 and abs(anchor - ln.pos - k * step) < 6:
            ys.append(ln.pos)
            vals.append(2000.0 * k)
    y_axis, y_rms = calibrate.fit_axis(ys, vals)

    # x: thick verticals on the 50-nm lattice; anchor on the leftmost thick
    # line, two-pass progression filter (rejects thick curve strokes).
    vm = [ln for ln in v if ln.thickness >= 6 and ln.extent >= 700]
    x0 = min(ln.pos for ln in vm)
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
    # reserve-scale axis: value = RESERVE_K0_VALUE + 50*k  (k from xs[0])
    res_axis = calibrate.Axis(px0=a, v0=RESERVE_K0_VALUE, px_per_unit=b / 50.0)
    nores_axis = calibrate.Axis(
        px0=a, v0=RESERVE_K0_VALUE + NO_RESERVE_OFFSET, px_per_unit=b / 50.0
    )
    lat_rms = float(np.sqrt(np.mean((a + b * np.asarray(ks) - np.asarray(xs)) ** 2)))
    return y_axis, y_rms, res_axis, nores_axis, lat_rms, ys, xs


def extract_curves(ink):
    """Oriented opening at 50-74 deg: erases grid (incl. 7-px vertical majors,
    too thick for >74 deg kernels to survive but too thin to contain <=74 deg
    ones), text, and boxes; keeps the steep (75-79 deg) range curves, which
    still contain the 74 deg kernel thanks to stroke width."""
    panel = np.zeros_like(ink)
    panel[ROI] = ink[ROI]
    mask = curves.curve_mask(
        panel, angles_deg=list(np.arange(50, 74.1, 2)), length=31, exclude_grid=False
    )
    comps = curves.components(mask, min_size=60)
    sel = [
        c
        for c in comps
        if (c.x.max() - c.x.min()) >= 25 and (c.y.max() - c.y.min()) > 50
    ]
    return sel


def group_family(frags, deg=2):
    """Group fragments of one family into its 3 power curves (x(y) fits —
    curves are steep, so fit sideways)."""
    swapped = [curves.Component(points=c.points[:, ::-1]) for c in frags]
    grouped = curves.group_curves(swapped, deg=deg, tol_px=3.0, max_gap=400.0)
    grouped = [g for g in grouped if g.points.shape[0] > 1500]
    # un-swap; order left->right at max y (sea level) = 75, 65, 55
    out = [curves.Component(points=g.points[:, ::-1]) for g in grouped]

    def x_at_bottom(c):
        yb = c.y.max()
        m = c.y > yb - 60
        return c.x[m].mean()

    return sorted(out, key=x_at_bottom)


def sample_curve(comp, y_axis, x_axis, alt_step=500.0):
    """Return (PA_ft, value) samples along a curve, every alt_step ft."""
    cl = curves.centerline(curves.Component(points=comp.points[:, ::-1]))  # (y, mean x)
    ys, xs = cl[:, 0], cl[:, 1]
    alts = np.array([y_axis.value(y) for y in ys])
    lo = np.ceil(alts.min() / alt_step) * alt_step
    hi = np.floor(alts.max() / alt_step) * alt_step
    grid = np.arange(lo, hi + 1, alt_step)
    order = np.argsort(alts)
    xg = np.interp(grid, alts[order], xs[order])
    return np.column_stack([grid, [x_axis.value(x) for x in xg]])


def main():
    img, angle = raster.prepared_page(PAGE)
    ink = raster.binarize(img)
    print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {angle:+.2f} deg")

    y_axis, y_rms, res_axis, nores_axis, lat_rms, ys_maj, xs_maj = build_axes(ink)
    print(
        f"PA axis: SL at y={y_axis.px(0):.1f}, {abs(y_axis.px_per_unit) * 2000:.1f} px per "
        f"2000 ft (rms {y_rms:.2f} px)"
    )
    print(
        f"range lattice: 50 nm per {res_axis.px_per_unit * 50:.2f} px, reserve 450 at "
        f"x={res_axis.px(450):.1f}, no-reserve 500 at x={nores_axis.px(500):.1f} "
        f"(lattice rms {lat_rms:.2f} px)"
    )

    frags = extract_curves(ink)
    res_frags = [c for c in frags if c.x.mean() < FAMILY_SPLIT_PX]
    nores_frags = [c for c in frags if c.x.mean() >= FAMILY_SPLIT_PX]
    res_curves = group_family(res_frags)
    nores_curves = group_family(nores_frags)
    print(f"reserve family: {len(res_curves)} curves; no-reserve: {len(nores_curves)}")
    assert len(res_curves) == 3 and len(nores_curves) == 3

    labels = ["75", "65", "55"]
    samples = {}  # (group, power) -> N x 2 [PA_ft, nm]
    for grp, curveset, axis in (
        ("reserve45", res_curves, res_axis),
        ("noReserve", nores_curves, nores_axis),
    ):
        for lab, comp in zip(labels, curveset):
            samples[(grp, lab)] = sample_curve(comp, y_axis, axis)

    # ----- fit: value = a + b*PA per curve (check linearity) ----------------
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

    # ----- worked example ---------------------------------------------------
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

    # implied TAS = (R_nores - R_res) / reserve fuel time credit is not
    # available here alone; report the plain range delta per power instead.
    deltas = {}
    for lab in labels:
        lo = max(
            model_params[f"reserve45_{lab}"]["altMinFt"],
            model_params[f"noReserve_{lab}"]["altMinFt"],
        )
        hi = min(
            model_params[f"reserve45_{lab}"]["altMaxFt"],
            model_params[f"noReserve_{lab}"]["altMaxFt"],
        )
        for alt in (0.0, 5000.0, hi):
            if lo <= alt <= hi:
                d = (
                    model_params[f"noReserve_{lab}"]["R0_nm"]
                    + model_params[f"noReserve_{lab}"]["slope_nm_per_ft"] * alt
                ) - (
                    model_params[f"reserve45_{lab}"]["R0_nm"]
                    + model_params[f"reserve45_{lab}"]["slope_nm_per_ft"] * alt
                )
                deltas[f"{lab}pct_at_{alt:.0f}ft"] = round(d, 1)
    print("no-reserve minus reserve range (nm):", deltas)

    # ----- QA overlay -------------------------------------------------------
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
        vlines=[res_axis.px(450 + 50 * k) for k in range(8)],
        hlines=[y_axis.px(a) for a in range(0, 12001, 2000)],
        path=f"fig_{FIGURE.replace('-', '_')}_fit.png",
    )

    # ----- emit -------------------------------------------------------------
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
                "+0.6*(OAT-Tstd) if OAT>Tstd else +1.0*(OAT-Tstd); "
                "Tstd = 15 - 1.9812*PA_ft/1000. groups: reserve45 "
                "(45 min at 55% power best economy), noReserve. "
                "Conditions: 2300 lb, no wind, 48 gal usable, leaned, "
                "wheel fairings (up to -7% without)."
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
                "reserveCorrectedNm": WORKED["printedReserveNm"] + 0.6 * 11,
                "noReserveCorrectedNm": WORKED["printedNoReserveNm"] + 0.6 * 11,
            },
            "model": {
                "reserveNm": round(got_res, 1),
                "noReserveNm": round(got_nores, 1),
                "reserveCorrectedNm": round(got_res + 0.6 * 11, 1),
                "noReserveCorrectedNm": round(got_nores + 0.6 * 11, 1),
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
            "150 nm lower than the reserve-scale continuation at the same px.",
            "75% power curves stop near 8500 ft (full-throttle limit); "
            "65/55% extend past 12000 ft.",
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
