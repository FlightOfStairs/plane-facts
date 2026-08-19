"""Fig 6-15 "C.G. Range and Weight" (PDF p123) — axis transform + envelope.

Despite its axis caption this is not a Cartesian (C.G., weight) plot. The
printed C.G. rays are spaced 60 px/in at 1400 lb but 108 px/in at 2440, and the
family pivots about C.G. 88 — rays below 88 lean left with increasing weight,
those above lean right. So the abscissa is moment taken about an 88-inch
reference, which is what keeps the chart narrow:

    x = A + k * W * (cg - 88)         y = yAt1200 - pxPerLb * (W - 1200)

A and k are anchored on the rays labelled 88..93 along the 2440-lb top edge —
the equivalent of calibrating from gridlines rather than from label text. The
envelope edges are then *derived*, and come out at C.G. 83.1-83.3 (forward) and
92.9-93.0 (aft), confirming the published 83.0 / 93.0 limits.

Run: uv run python charts/fig_6_15.py
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import raster

PDF_PAGE = 123
CG_REF_IN = 88.0

Y_AT_1200, PX_PER_LB = 1970.9, (1970.9 - 689.1) / (2400 - 1200)
w_to_y = lambda w: Y_AT_1200 - (w - 1200.0) * PX_PER_LB

# Ray positions measured along the 2440-lb top edge (labelled 88..93).
TOP_RAYS = {88: 759.0, 89: 866.0, 90: 972.5, 91: 1081.0, 92: 1192.0, 93: 1299.5}


def edges(ink, w, lo=250, hi=1330, max_run=12):
    """(leftmost, rightmost) thin ink run on the row for this weight."""
    row = ink[int(round(w_to_y(w))), lo:hi]
    runs, n = [], 0
    for i, v in enumerate(row):
        if v:
            n += 1
        elif n:
            if n <= max_run:
                runs.append(lo + i - n / 2 - 0.5)
            n = 0
    return (runs[0], runs[-1]) if len(runs) >= 2 else (None, None)


def main():
    img, angle = raster.prepared_page(PDF_PAGE)
    ink = raster.binarize(img)
    print(f"page {PDF_PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {angle:+.3f} deg")

    cgs = np.array(sorted(TOP_RAYS)), np.array([TOP_RAYS[c] for c in sorted(TOP_RAYS)])
    slope, intercept = np.polyfit(cgs[0], cgs[1], 1)
    A = float(slope * CG_REF_IN + intercept)
    k = float(slope / 2440.0)
    ray_rms = float(np.sqrt(np.mean((np.polyval([slope, intercept], cgs[0]) - cgs[1]) ** 2)))
    print(f"\nA = {A:.2f} px (x at C.G. 88)   k = {k:.6f} px per in-lb   top-ray fit rms {ray_rms:.2f} px")

    def x_of(cg, w):
        return A + k * w * (cg - CG_REF_IN)

    def cg_of(x, w):
        return CG_REF_IN + (x - A) / (k * w)

    print("\nenvelope edges, read back as C.G.:")
    print("   W     fwd x   fwd C.G.    aft x   aft C.G.")
    fwd_cg, aft_cg, slope_pts = [], [], []
    for w in range(1300, 2451, 50):
        f, a = edges(ink, w)
        if f is None:
            continue
        cf, ca = cg_of(f, w), cg_of(a, w)
        if 92.0 < ca < 94.0:
            aft_cg.append(ca)
        tag = ""
        if cf > 83.5:  # onto the sloping forward limit
            slope_pts.append((w, cf))
            tag = "  <- sloping fwd limit"
        elif 82.5 < cf < 83.5:
            fwd_cg.append(cf)
        print(f" {w:5d}  {f:7.1f}   {cf:6.2f}    {a:7.1f}   {ca:6.2f}{tag}")

    print(f"\nforward limit below the break: C.G. {np.mean(fwd_cg):.2f} +/- {np.std(fwd_cg):.2f} (n={len(fwd_cg)})")
    print(f"aft limit:                    C.G. {np.mean(aft_cg):.2f} +/- {np.std(aft_cg):.2f} (n={len(aft_cg)})")

    # Break weight: intersect the sloping forward limit with C.G. 83.
    if len(slope_pts) >= 2:
        ws = np.array([w for w, _ in slope_pts], float)
        cs = np.array([c for _, c in slope_pts], float)
        m, b = np.polyfit(ws, cs, 1)
        w_break = (83.0 - b) / m
        cg_at_max = m * 2440 + b
        print(f"\nsloping fwd limit: C.G. = {m:.5f}*W + {b:.3f}")
        print(f"  meets C.G. 83.0 at W = {w_break:.0f} lb;  at 2440 lb reads C.G. {cg_at_max:.2f}")

    out = {
        "figure": "6-15",
        "pdfPage": PDF_PAGE,
        "title": "C.G. Range and Weight",
        "deskewDeg": round(angle, 3),
        "transform": {
            "form": "x = A + k*W*(cg - 88);  y = yAt1200 - pxPerLb*(W - 1200)",
            "A": round(A, 2),
            "k": round(k, 6),
            "cgRefIn": CG_REF_IN,
            "yAt1200": Y_AT_1200,
            "pxPerLb": round(PX_PER_LB, 6),
            "topRayFitRmsPx": round(ray_rms, 2),
        },
        "measuredTopRays": TOP_RAYS,
        "derivedLimits": {
            "forwardCgBelowBreak": round(float(np.mean(fwd_cg)), 2),
            "forwardCgSd": round(float(np.std(fwd_cg)), 2),
            "aftCg": round(float(np.mean(aft_cg)), 2),
            "aftCgSd": round(float(np.std(aft_cg)), 2),
            "breakWeightLb": round(float(w_break)) if len(slope_pts) >= 2 else None,
            "forwardCgAt2440": round(float(cg_at_max), 2) if len(slope_pts) >= 2 else None,
        },
    }
    Path("out/fits").mkdir(parents=True, exist_ok=True)
    Path("out/fits/fig_6_15.json").write_text(json.dumps(out, indent=1) + "\n")
    print("\nwrote out/fits/fig_6_15.json")


if __name__ == "__main__":
    main()
