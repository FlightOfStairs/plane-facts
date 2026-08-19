"""Fig 5-33 Glide Performance (PDF page 106, portrait).

Single panel: y = pressure altitude (0..12000+ ft), x = glide range (nm).
One straight line ~through origin. Conditions: 2440 lb, prop windmilling,
flaps 0, 73 KIAS, no wind.

Deliverables: out/fits/fig_5_33.json, out/qa/fig_5_33_overlay.png.
Run: uv run python charts/fig_5_33.py
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

FT_PER_NM = 6076.115

img, deskew = raster.prepared_page(106)
ink = raster.binarize(img)
print(f"page 106: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

# ---------------------------------------------------------------- calibration
h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=400)
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=400)


def nearest(lines, pos):
    return min(lines, key=lambda ln: abs(ln.pos - pos))


# Altitude majors every 2000 ft (thick, t=5 in this raster).
alt_anchor_px = [nearest(h_lines, y).pos for y in (1062, 1213, 1362, 1511, 1660, 1811, 1962)]
alt_anchor_v = [12000, 10000, 8000, 6000, 4000, 2000, 0]
y_axis, y_rms = calibrate.fit_axis(alt_anchor_px, alt_anchor_v)
print(f"alt axis: 0 ft at y={y_axis.px(0):.1f}, {y_axis.px_per_unit*2000:+.2f} px/2000 ft, rms {y_rms:.2f} px")

# Glide-range majors every 5 nm.
rng_anchor_px = [nearest(v_lines, x).pos for x in (372, 520, 670, 819, 967, 1115, 1264, 1413)]
rng_anchor_v = [0, 5, 10, 15, 20, 25, 30, 35]
x_axis, x_rms = calibrate.fit_axis(rng_anchor_px, rng_anchor_v)
print(f"range axis: 0 nm at x={x_axis.px(0):.1f}, {x_axis.px_per_unit*5:+.2f} px/5 nm, rms {x_rms:.2f} px")

# ---------------------------------------------------------------- extraction
# Glide line runs lower-left -> upper-right at ~53 deg from horizontal.
roi = np.zeros_like(ink)
roi[1040:1975, 360:1110] = ink[1040:1975, 360:1110]
# exclude_grid=False: the dense minor grid (~15 px pitch) would slice the
# 3-px line into sub-min_size crumbs; the 31-px oriented opening alone
# already erases the h/v grid.
mask = curves.curve_mask(roi, angles_deg=list(np.arange(35, 71, 1.5)), length=31,
                         exclude_grid=False)
comps = [c for c in curves.components(mask, min_size=100) if c.points.shape[0] > 800]
print(f"curve groups >800 px: {len(comps)} (expect 1)")
assert len(comps) >= 1
glide = max(comps, key=lambda c: c.points.shape[0])
cl = curves.centerline(glide)
print(f"glide line: x {cl[:,0].min():.0f}..{cl[:,0].max():.0f}, y {cl[:,1].min():.0f}..{cl[:,1].max():.0f}")

# ---------------------------------------------------------------- fit
d_nm = np.array([x_axis.value(x) for x in cl[:, 0]])
h_ft = np.array([y_axis.value(y) for y in cl[:, 1]])
# h = slope*d + intercept
slope_ft_per_nm, intercept_ft = np.polyfit(d_nm, h_ft, 1)
resid = h_ft - (slope_ft_per_nm * d_nm + intercept_ft)
rms_ft = float(np.sqrt(np.mean(resid**2)))
glide_ratio = FT_PER_NM / slope_ft_per_nm
d0 = -intercept_ft / slope_ft_per_nm  # x-intercept, nm
print(f"h = {slope_ft_per_nm:.1f} ft/nm * d + {intercept_ft:+.1f} ft  (rms {rms_ft:.1f} ft)")
print(f"glide ratio = {glide_ratio:.2f}:1, x-intercept {d0:+.3f} nm")
# quadratic check for curvature
q = np.polyfit(d_nm, h_ft, 2)
print(f"quadratic term {q[0]:+.2f} ft/nm^2 over {d_nm.max()-d_nm.min():.1f} nm span "
      f"(max bow {abs(q[0])*(d_nm.max()-d_nm.min())**2/8:.0f} ft)")

# ------------------------------------------------- drag polar point @73 KIAS
# L/D = glide_ratio (no wind, still air, angle small). CAS~IAS at 73 kt
# (Fig 5-3 correction is ~+1 kt; noted, not applied).
S_ft2 = 170.0
W_lb = 2440.0
rho0 = 0.0023769  # slug/ft^3
V_fps = 73.0 * 1.687810
q_psf = 0.5 * rho0 * V_fps**2
CL = W_lb / (q_psf * S_ft2)
CD = CL / glide_ratio
print(f"@73 KCAS: q={q_psf:.2f} psf, CL={CL:.3f}, CD={CD:.4f} (prop windmilling)")

# ---------------------------------------------------------------- worked example
# cruise 5000 ft, terrain 2000 ft -> printed 9.5 - 3.9 = 5.6 nm
def range_at(h):
    return (h - intercept_ft) / slope_ft_per_nm

r5000, r2000 = range_at(5000), range_at(2000)
model_glide = r5000 - r2000
printed = 5.6
err_pct = 100 * (model_glide - printed) / printed
print(f"worked example: d(5000)={r5000:.2f} nm (printed 9.5), d(2000)={r2000:.2f} nm "
      f"(printed 3.9), diff {model_glide:.2f} vs 5.6 -> {err_pct:+.1f}%")

# ---------------------------------------------------------------- QA overlay
fit_line = np.array(
    [[x_axis.px(range_at(h)), y_axis.px(h)] for h in np.linspace(0, 12000, 50)]
)
qa.overlay(
    img,
    [cl, fit_line],
    vlines=rng_anchor_px,
    hlines=alt_anchor_px,
    path="fig_5_33_overlay.png",
)
print("QA overlay: out/qa/fig_5_33_overlay.png")

# ---------------------------------------------------------------- emit
pts = cl[:: max(1, len(cl) // 60)]
out = {
    "figure": "5-33",
    "pdfPage": 106,
    "title": "Glide Performance",
    "conditions": {"weightLb": 2440, "prop": "windmilling", "flapsDeg": 0,
                   "speedKIAS": 73, "wind": "none"},
    "calibration": {
        "glideRangeNm": {"px0": x_axis.px0, "v0": x_axis.v0, "pxPerUnit": x_axis.px_per_unit},
        "pressureAltFt": {"px0": y_axis.px0, "v0": y_axis.v0, "pxPerUnit": y_axis.px_per_unit},
    },
    "deskewDeg": deskew,
    "model": {
        "form": "glide_range_nm(h) = (h_ft - b) / m;  m ft/nm, b ft; "
                "usage: range = glide_range(cruise PA) - glide_range(terrain PA); "
                "L/D = 6076.115/m",
        "params": {
            "m_ft_per_nm": round(slope_ft_per_nm, 2),
            "b_ft": round(intercept_ft, 1),
            "glideRatio": round(glide_ratio, 3),
            "xInterceptNm": round(d0, 3),
            "CL_73KCAS": round(CL, 4),
            "CD_73KCAS": round(CD, 5),
        },
        "rmsPct": round(100 * rms_ft / 12000, 3),
        "rmsFt": round(rms_ft, 1),
    },
    "curves": [{
        "label": "glide",
        "points": [[round(x_axis.value(x), 3), round(y_axis.value(y), 1)] for x, y in pts],
    }],
    "workedExample": {
        "inputs": {"cruisePAft": 5000, "terrainPAft": 2000},
        "printed": {"rangeCruiseNm": 9.5, "rangeTerrainNm": 3.9, "glideNm": 5.6},
        "model": {"rangeCruiseNm": round(r5000, 2), "rangeTerrainNm": round(r2000, 2),
                  "glideNm": round(model_glide, 2)},
        "errPct": round(err_pct, 2),
    },
    "envelope": {"pressureAltFt": [0, 12000]},
    "notes": [
        "Single straight line; quadratic curvature term negligible "
        f"({q[0]:+.2f} ft/nm^2).",
        "L/D applies at 73 KIAS, 2440 lb, prop windmilling, flaps 0. Best-glide "
        "IAS scales as sqrt(W); still-air ground range is altitude*L/D "
        "independent of density (TAS and sink rate scale together).",
        "CD includes windmilling-prop drag; power-off/feathered polar would be cleaner.",
        "CAS assumed = IAS at 73 kt (Fig 5-3 correction ~+1 kt not applied).",
    ],
}
dest = Path(__file__).resolve().parents[1] / "out" / "fits" / "fig_5_33.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, indent=2))
print(f"wrote {dest}")
