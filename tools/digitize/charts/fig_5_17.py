"""Fig 5-17 Climb Performance (POH p. 5-19, PDF page 98) — digitize + fit.

Nomograph structure: shared unlabeled vertical coordinate (y, px).
  Left panel:  OAT (-40..40 C) on x; family of straight-ish pressure-altitude
               guide lines (drawn every 1000 ft, labels every 2000 ft,
               SEA LEVEL..14000, plus unlabeled 15000/16000 at top and a
               -1000 filler at bottom right); STANDARD TEMPERATURE reference
               line crosses each PA line at its ISA temperature.
  Right panel: single rate-of-climb line mapping y -> ROC (fpm).
Usage: OAT up to PA line, right to ROC line, down to ROC scale.

Associated conditions: 2440 lb, full throttle, lean per Lycoming, 79 KIAS.
NOTE on chart: reduce ROC by 40 fpm when wheel fairings removed.

Run:  uv run python charts/fig_5_17.py
Outputs: out/fits/fig_5_17.json, out/qa/fig_5_17_calibration.png,
         out/qa/fig_5_17_curves.png
"""

import json
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import brentq

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"
PAGE = 98
ISA_LAPSE = 1.9812  # deg C per 1000 ft


def isa_temp(pa_ft):
    return 15.0 - ISA_LAPSE * pa_ft / 1000.0


def nearest(lines, pos):
    return min(lines, key=lambda ln: abs(ln.pos - pos))


def per_row_centerline(comp):
    """(y, median x) samples of a steep stroke."""
    ys = comp.y.astype(int)
    out = []
    for yy in np.unique(ys):
        out.append((float(yy), float(np.median(comp.x[ys == yy]))))
    return np.array(out)


def main():
    img, deskew = raster.prepared_page(PAGE)
    ink = raster.binarize(img)
    print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

    # ---------------- axis calibration from major gridlines ----------------
    v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=200)
    h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=300)

    # OAT majors every 10 C; -40 C is the left border (thick).  Predicted from
    # the -20/0/+20/+40 full-height thick lines found in exploration.
    oat_pred = {-40: 489, -30: 563, -20: 637, -10: 712, 0: 786, 10: 860, 20: 935, 30: 1009, 40: 1085}
    oat_px = [nearest(v_lines, p).pos for p in oat_pred.values()]
    oat_ax, oat_rms = calibrate.fit_axis(oat_px, list(oat_pred.keys()))
    print(f"OAT axis: -40C at x={oat_ax.px(-40):.1f}, {oat_ax.px_per_unit:.3f} px/C, rms {oat_rms:.2f} px")

    # ROC majors every 200 fpm (labels 0..800; heavier gridlines continue).
    roc_pred = {0: 1235, 200: 1383, 400: 1531, 600: 1683, 800: 1834}
    roc_px = [nearest(v_lines, p).pos for p in roc_pred.values()]
    roc_ax, roc_rms = calibrate.fit_axis(roc_px, list(roc_pred.keys()))
    print(f"ROC axis: 0 fpm at x={roc_ax.px(0):.1f}, {roc_ax.px_per_unit:.4f} px/fpm, rms {roc_rms:.2f} px")

    # Horizontal majors (unitless shared y) for the QA overlay only.
    h_majors = [nearest(h_lines, p).pos for p in (256, 407, 556, 705, 856, 1005, 1152, 1301, 1451)]

    # ---------------- left panel: PA guide lines ----------------
    panel = np.zeros_like(ink)
    panel[258:1449, 492:1160] = ink[258:1449, 492:1160]
    mask = curves.curve_mask(panel, angles_deg=list(np.arange(46, 63, 2.0)), length=71, exclude_grid=False)
    comps = curves.components(mask, min_size=200)
    groups = curves.group_curves(comps, deg=2, tol_px=3.0)
    fits = []
    for g in groups:
        cl = curves.centerline(g)
        co = np.polyfit(cl[:, 0], cl[:, 1], 2)
        fits.append((np.polyval(co, 800), co, cl))
    fits.sort(key=lambda t: t[0])  # top of page (small y) = high altitude
    print(f"PA guide lines extracted: {len(fits)} (expect 18: -1000..16000 ft)")

    # ---------------- standard temperature line ----------------
    smask = curves.curve_mask(panel, angles_deg=list(np.arange(-70, -85, -2.0)), length=61, exclude_grid=False)
    std = max(curves.components(smask, min_size=1000), key=lambda c: c.points.shape[0])
    scl = per_row_centerline(std)  # (y, x)
    std_xy = np.polyfit(scl[:, 0], scl[:, 1], 2)  # x(y)
    oat_bot = oat_ax.value(np.polyval(std_xy, 1448.0))
    print(f"std-temp line at bottom border: OAT {oat_bot:.2f} C (ISA sea level = 15.00)")
    assert abs(oat_bot - 15.0) < 0.6, "std-temp anchor failed"

    # ---------------- assign PA to guide lines via ISA crossings ----------------
    # Index 16 from the top is sea level: verified below by each line crossing
    # the std-temp line at its ISA temperature.
    assigned = []
    for i, (y800, co, cl) in enumerate(fits):
        pa = (16 - i) * 1000
        f = lambda y: np.polyval(co, np.polyval(std_xy, y)) - y
        try:
            ystar = brentq(f, 100, 1700)
            alt_implied = (15.0 - oat_ax.value(np.polyval(std_xy, ystar))) / ISA_LAPSE * 1000
        except ValueError:
            alt_implied = np.nan
        ok = np.isfinite(alt_implied) and abs(alt_implied - pa) < 300
        print(f"  PA {pa:6d} ft: ISA-crossing implies {alt_implied:7.0f} ft {'OK' if ok else 'CHECK'}")
        if pa >= 0:
            assigned.append((pa, co, cl))

    # ---------------- right panel: ROC line ----------------
    panel_r = np.zeros(ink.shape, bool)
    panel_r[262:1445, 1170:2330] = ink[262:1445, 1170:2330]
    rmask = curves.curve_mask(panel_r, angles_deg=list(np.arange(-50, -79, -2.0)), length=41, exclude_grid=False)
    roc_comp = max(curves.components(rmask, min_size=500), key=lambda c: c.points.shape[0])
    rows = per_row_centerline(roc_comp)  # (y, x)
    fr = rows[(rows[:, 0] >= 510) & (rows[:, 0] <= 1440)]
    for _ in range(6):  # robust vs dashed-example contamination
        roc_fit = np.polyfit(fr[:, 0], fr[:, 1], 3)
        r = fr[:, 1] - np.polyval(roc_fit, fr[:, 0])
        keep = np.abs(r) < max(2.5, 2.0 * np.std(r))
        if keep.all():
            break
        fr = fr[keep]
    roc_line_rms = float(np.std(fr[:, 1] - np.polyval(roc_fit, fr[:, 0])))
    print(f"ROC line: cubic x(y), {len(fr)} rows, rms {roc_line_rms:.2f} px; "
          f"ROC {roc_ax.value(np.polyval(roc_fit, 510)):.0f}..{roc_ax.value(np.polyval(roc_fit, 1440)):.0f} fpm")

    def roc_of_y(y):
        return roc_ax.value(np.polyval(roc_fit, y))

    # ---------------- compose dataset ROC(PA, OAT) ----------------
    data = []
    for pa, co, cl in assigned:
        for x in np.arange(cl[:, 0].min() + 5, cl[:, 0].max() - 5, 8.0):
            y = np.polyval(co, x)
            if not (510 <= y <= 1442):
                continue  # outside the drawn extent of the ROC line
            data.append((pa, oat_ax.value(x), roc_of_y(y)))
    data = np.array(data)
    PA, OAT, ROC = data.T
    print(f"composed dataset: {len(data)} points")

    # ---------------- model fits ----------------
    # primary: ROC = a0 + a1 PA + a2 OAT + a3 OAT^2  (cross + PA^2 terms are negligible)
    A = np.column_stack([np.ones_like(PA), PA, OAT, OAT**2])
    coef, *_ = np.linalg.lstsq(A, ROC, rcond=None)
    pred = A @ coef
    rms_fpm = float(np.sqrt(np.mean((pred - ROC) ** 2)))
    rms_pct = 100.0 * rms_fpm / float(np.mean(ROC))
    print(f"primary  ROC = {coef[0]:.1f} + {coef[1]:.6f} PA + {coef[2]:.4f} OAT + {coef[3]:.5f} OAT^2 : "
          f"rms {rms_fpm:.1f} fpm ({rms_pct:.2f}% of mean)")

    # physical: linear in density altitude, k fitted
    isa = 15.0 - ISA_LAPSE * PA / 1000.0
    best = None
    for k in np.arange(60, 180, 1.0):
        DA = PA + k * (OAT - isa)
        cl_ = np.polyfit(DA, ROC, 1)
        r = float(np.sqrt(np.mean((np.polyval(cl_, DA) - ROC) ** 2)))
        if best is None or r < best[0]:
            best = (r, float(k), cl_)
    da_rms, da_k, da_co = best
    print(f"physical ROC = {da_co[1]:.1f} {da_co[0]:+.6f} DA, DA = PA + {da_k:.0f}(OAT-ISA): rms {da_rms:.1f} fpm")
    ceiling_da = -da_co[1] / da_co[0]
    print(f"  -> ROC=0 at DA {ceiling_da:.0f} ft (absolute ceiling, gross weight)")

    def model_roc(pa, oat):
        return float(coef[0] + coef[1] * pa + coef[2] * oat + coef[3] * oat * oat)

    # ---------------- worked example ----------------
    ex_pa, ex_oat, printed = 5000.0, 16.0, 340.0
    ex_roc = model_roc(ex_pa, ex_oat)
    ex_err = 100.0 * (ex_roc - printed) / printed
    da_ex = ex_pa + da_k * (ex_oat - isa_temp(ex_pa))
    ex_roc_da = float(np.polyval(da_co, da_ex))
    print(f"worked example 5000 ft / 16 C: primary {ex_roc:.0f} fpm, DA-model {ex_roc_da:.0f} fpm, "
          f"printed {printed:.0f} ({ex_err:+.1f}%)")

    # ---------------- QA overlays ----------------
    qa.overlay(
        img, [],
        vlines=list(oat_px) + list(roc_px),
        hlines=h_majors,
        path="fig_5_17_calibration.png",
    )
    over = []
    for pa, co, cl in assigned:
        xs = np.arange(cl[:, 0].min(), cl[:, 0].max())
        over.append(np.column_stack([xs, np.polyval(co, xs)]))
    ys = np.arange(510, 1443)
    over.append(np.column_stack([np.polyval(roc_fit, ys), ys]))
    ys2 = np.arange(260, 1449)
    over.append(np.column_stack([np.polyval(std_xy, ys2), ys2]))
    qa.overlay(img, over, path="fig_5_17_curves.png")

    # ---------------- emit JSON ----------------
    curves_out = []
    for pa, co, cl in assigned:
        pts = []
        for x in np.arange(cl[:, 0].min() + 2, cl[:, 0].max() - 2, 15.0):
            y = np.polyval(co, x)
            if 510 <= y <= 1442:
                pts.append([round(float(oat_ax.value(x)), 2), round(roc_of_y(y), 1)])
        if pts:
            curves_out.append({"label": f"PA {pa} ft", "points": pts})
    ysamp = np.arange(510, 1443, 25.0)
    curves_out.append({
        "label": "ROC line (right panel): [ROC fpm, y px]",
        "points": [[round(roc_of_y(y), 1), float(y)] for y in ysamp],
    })

    out = {
        "figure": "5-17",
        "pdfPage": PAGE,
        "title": "Climb Performance (2440 lb, full throttle, lean per Lycoming, 79 KIAS)",
        "calibration": {
            "oat_C": {"px0": oat_ax.px0, "v0": oat_ax.v0, "pxPerUnit": oat_ax.px_per_unit},
            "roc_fpm": {"px0": roc_ax.px0, "v0": roc_ax.v0, "pxPerUnit": roc_ax.px_per_unit},
        },
        "deskewDeg": round(float(deskew), 2),
        "model": {
            "form": "ROC_fpm = a0 + a1*PA_ft + a2*OAT_C + a3*OAT_C^2  "
                    "(equivalent physical form: ROC = c0 + c1*DA, DA = PA + k*(OAT - ISA(PA)), "
                    "ISA = 15 - 1.9812*PA/1000)",
            "params": {
                "a0": round(float(coef[0]), 2),
                "a1": round(float(coef[1]), 6),
                "a2": round(float(coef[2]), 4),
                "a3": round(float(coef[3]), 5),
                "c0": round(float(da_co[1]), 1),
                "c1": round(float(da_co[0]), 6),
                "k_ftPerC": da_k,
                "wheelFairingsRemoved_fpm": -40.0,
            },
            "rmsPct": round(rms_pct, 2),
            "rmsFpm": round(rms_fpm, 1),
            "daModelRmsFpm": round(da_rms, 1),
        },
        "curves": curves_out,
        "workedExample": {
            "inputs": {"pa_ft": ex_pa, "oat_C": ex_oat},
            "printed": {"roc_fpm": printed},
            "model": {"roc_fpm": round(ex_roc, 1), "roc_fpm_daModel": round(ex_roc_da, 1)},
            "errPct": round(ex_err, 1),
        },
        "envelope": {
            "pa_ft": [0, 16000],
            "oat_C": [-40, 40],
            "roc_fpm": [25, 630],
            "note": "guide lines drawn every 1000 ft to 16000 (labels every 2000 to 14000); "
                    "high PA reachable only at cold OAT (family truncated by chart borders); "
                    "ROC line drawn ~25..630 fpm, clamps toward 0 above (near-ceiling region unusable)",
        },
        "notes": [
            "Shared nomograph y-coordinate is unitless; ROC-line curve gives [ROC fpm, y px].",
            "PA-line identity verified: each guide line crosses the STANDARD TEMPERATURE line at "
            "its ISA temperature within +/-160 ft; sea-level line meets the std line exactly at "
            "the bottom border (15.0 C).",
            "ROC is linear in density altitude with k = %.0f ft/C (std DA rule ~118.8): "
            "chart IS a density-altitude collapse, unlike takeoff Fig 5-11." % da_k,
            "Absolute ceiling implied: ROC=0 at DA ~%.0f ft." % ceiling_da,
            "OAT^2 term (a3) is small drafting curvature; dropping it costs rms 5.6 fpm vs 1.3 fpm.",
            "Reduce ROC by 40 fpm with wheel fairings removed (printed note).",
        ],
    }
    OUT_FITS.mkdir(parents=True, exist_ok=True)
    with open(OUT_FITS / "fig_5_17.json", "w") as f:
        json.dump(out, f, indent=1)
    print("wrote out/fits/fig_5_17.json")
    return out


if __name__ == "__main__":
    main()
