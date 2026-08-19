"""Fig 5-3 Airspeed System Calibration (PDF p.91): CAS vs IAS, flaps up + flaps 40.

Load -> calibrate from major gridlines -> extract the solid (FLAPS UP) and
dashed (WING FLAPS 40) diagonal lines -> fit linear/quadratic CAS(IAS) ->
emit out/fits/fig_5_03.json + QA overlay.

Run:  uv run python charts/fig_5_03.py
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT = Path(__file__).resolve().parents[1] / "out"

img, deskew = raster.prepared_page(91)
ink = raster.binarize(img)
print(f"page 91: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

# ---------------------------------------------------------------- calibration
# IAS majors: the 8 full-height verticals (40..180 kt), extent >= 1000 px.
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=400)
v_seed = [ln.pos for ln in v_lines if ln.extent >= 1000]
step_v = (v_seed[-1] - v_seed[0]) / round((v_seed[-1] - v_seed[0]) / 149.7)
v_maj = []
for k in range(8):
    want = v_seed[0] + k * step_v
    near = min(v_lines, key=lambda ln: abs(ln.pos - want))
    assert abs(near.pos - want) < 6, (want, near.pos)
    v_maj.append(near.pos)
sp = np.diff(v_maj)
assert np.all(np.abs(sp - np.mean(sp)) < 4), sp
ias_axis, ias_rms = calibrate.fit_axis(v_maj, list(range(40, 181, 20)))
print(f"IAS axis: 40kt at x={ias_axis.px(40):.1f}, {ias_axis.px_per_unit:.4f} px/kt, rms {ias_rms:.2f} px")

# CAS majors: thick full-width horizontals; seed with t>=6 then fill the
# arithmetic progression (two majors print at minor thickness on this scan).
h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=1000)
seeds = [ln.pos for ln in h_lines if ln.thickness >= 6 and ln.pos > 400]
seeds = sorted(seeds)
step = np.median([d for d in np.diff(seeds) if d < 200])  # ~150 px per 20 kt
grid_positions = []
y = seeds[-1]  # bottom border = CAS 40
while y > seeds[0] - 5:
    near = min(h_lines, key=lambda ln: abs(ln.pos - y))
    assert abs(near.pos - y) < 6, (y, near.pos)
    grid_positions.append(near.pos)
    y -= step
grid_positions = grid_positions[::-1]  # top..bottom
n = len(grid_positions)
cas_vals = [40 + 20 * (n - 1 - i) for i in range(n)]
cas_axis, cas_rms = calibrate.fit_axis(grid_positions, cas_vals)
print(f"CAS axis: 40kt at y={cas_axis.px(40):.1f}, {cas_axis.px_per_unit:.4f} px/kt, "
      f"rms {cas_rms:.2f} px, majors {n} ({cas_vals[0]}..{cas_vals[-1]})")

# ---------------------------------------------------------------- extraction
x0, x1 = int(ias_axis.px(40)) + 5, int(ias_axis.px(180)) - 3
y_top, y_bot = 1100, int(cas_axis.px(40)) - 3
panel = np.zeros_like(ink)
panel[y_top:y_bot, x0:x1] = ink[y_top:y_bot, x0:x1]
mask = curves.curve_mask(panel, angles_deg=list(np.arange(38, 51, 2.0)), length=21)

# per-column ink runs
pts = []  # (x, y_center, run_height)
for x in range(x0, x1):
    col = np.flatnonzero(mask[:, x])
    if col.size == 0:
        continue
    breaks = np.flatnonzero(np.diff(col) > 3)
    for a, b in zip(np.r_[0, breaks + 1], np.r_[breaks, col.size - 1]):
        pts.append((x, (col[a] + col[b]) / 2.0, col[b] - col[a] + 1))
pts = np.array(pts)
pts = pts[pts[:, 2] <= 14]  # drop tall blobs (arrowheads, label collisions)

# Split into the two lines. Below the merge (~x 790, IAS ~103.5 = Vfe) the
# chart draws a solid FLAPS UP line with the dashed WING FLAPS 40 line a few
# px BELOW it; above the merge a single line continues (flaps up only); the
# dashed line alone extends further down-left below x~400.
by_x = {}
for x, y, h in pts:
    by_x.setdefault(x, []).append(y)
pair_cols = [(x, min(ys), max(ys)) for x, ys in by_x.items()
             if len(ys) == 2 and 5 <= max(ys) - min(ys) <= 30]
pair_cols.sort()
# merge point = end of the *dense* run of pair columns (stray pairs from the
# FLAPS UP label arrow appear sparsely further right)
pair_xs = np.array([x for x, _, _ in pair_cols])
MERGE_X = max(x for x in pair_xs if np.sum((pair_xs > x - 40) & (pair_xs <= x)) >= 8)
print(f"clean pair columns: {len(pair_cols)}, merge at x~{MERGE_X:.0f} "
      f"(IAS {ias_axis.value(MERGE_X):.1f})")

up_seed = np.array([(x, yu) for x, yu, yl in pair_cols if x <= MERGE_X] +
                   [(x, y) for (x, y, h) in pts if x > MERGE_X + 40])
lo_seed = np.array([(x, yl) for x, yu, yl in pair_cols if x <= MERGE_X])

def fit(p, deg=2):
    return np.polyfit(p[:, 0], p[:, 1], deg)

c_up, c_lo = fit(up_seed), fit(lo_seed)
for _ in range(4):
    r_up = np.polyval(c_up, pts[:, 0]) - pts[:, 1]
    r_lo = np.polyval(c_lo, pts[:, 0]) - pts[:, 1]
    a_up, a_lo = np.abs(r_up), np.abs(r_lo)
    up_pts = pts[(a_up < 3.5) & ((a_up <= a_lo) | (pts[:, 0] > MERGE_X))]
    tail = (pts[:, 0] < 420) & (a_lo < 9)  # dashed tail rides an extrapolation
    lo_pts = pts[((a_lo < 3.5) | tail) & (a_lo < a_up) & (pts[:, 0] <= MERGE_X)]
    c_up, c_lo = fit(up_pts[:, :2]), fit(lo_pts[:, :2])
print(f"assigned: flaps-up {len(up_pts)} pts x[{up_pts[:,0].min():.0f},{up_pts[:,0].max():.0f}], "
      f"flaps-40 {len(lo_pts)} pts x[{lo_pts[:,0].min():.0f},{lo_pts[:,0].max():.0f}]")

# ------------------------------------------------------------------- fitting
def to_units(p):
    ias = np.array([ias_axis.value(x) for x in p[:, 0]])
    cas = np.array([cas_axis.value(y) for y in p[:, 1]])
    return ias, cas

results = {}
for name, p in [("flapsUp", up_pts), ("flaps40", lo_pts)]:
    ias, cas = to_units(p)
    lin = np.polyfit(ias, cas, 1)
    quad = np.polyfit(ias, cas, 2)
    rms1 = float(np.sqrt(np.mean((np.polyval(lin, ias) - cas) ** 2)))
    rms2 = float(np.sqrt(np.mean((np.polyval(quad, ias) - cas) ** 2)))
    print(f"{name}: IAS range {ias.min():.1f}-{ias.max():.1f} kt")
    print(f"  linear  CAS = {lin[1]:+.3f} + {lin[0]:.4f}*IAS   rms {rms1:.3f} kt")
    print(f"  quad    CAS = {quad[2]:+.3f} + {quad[1]:.4f}*IAS + {quad[0]:.6f}*IAS^2   rms {rms2:.3f} kt")
    results[name] = dict(lin=lin, quad=quad, rms1=rms1, rms2=rms2,
                         iasMin=float(ias.min()), iasMax=float(ias.max()),
                         pts=p, ias=ias, cas=cas)

# choose form: quadratic only if it buys >25% rms
chosen = {}
for name, r in results.items():
    use_quad = r["rms2"] < 0.75 * r["rms1"]
    chosen[name] = ("quad", r["quad"], r["rms2"]) if use_quad else ("lin", r["lin"], r["rms1"])
    print(f"{name}: chose {chosen[name][0]}")

# sample tables every 5 kt for JSON
def sample(name):
    form, coef, _ = chosen[name]
    r = results[name]
    xs = np.arange(np.ceil(r["iasMin"] / 5) * 5, r["iasMax"] + 1e-6, 5.0)
    return [[float(v), round(float(np.polyval(coef, v)), 2)] for v in xs]

# spot checks
for name in ("flapsUp", "flaps40"):
    form, coef, rms = chosen[name]
    for v in (45, 60, 80, 100, 120, 140, 160):
        r = results[name]
        if r["iasMin"] - 1 <= v <= r["iasMax"] + 1:
            print(f"  {name} IAS {v} -> CAS {np.polyval(coef, v):.1f}")

# ---------------------------------------------------------- worked example
# Fig 5-3 prints no example box.  Validation: Fig 5-5 (independently
# digitized) pairs CAS and IAS stall curves at the 2440-lb anchor:
#   40 flap: 50.2 KCAS <-> 44.1 KIAS ;  0 flap: 56.1 KCAS <-> 50.2 KIAS
form40, coef40, _ = chosen["flaps40"]
formUp, coefUp, _ = chosen["flapsUp"]
cas_at_44 = float(np.polyval(coef40, 44.1))
cas_at_50 = float(np.polyval(coefUp, 50.2))
err40 = 100 * (cas_at_44 - 50.2) / 50.2
err0 = 100 * (cas_at_50 - 56.1) / 56.1
print(f"flaps40: 44.1 KIAS -> {cas_at_44:.2f} KCAS (Fig 5-5 anchor 50.2, {err40:+.1f}%)")
print(f"flapsUp: 50.2 KIAS -> {cas_at_50:.2f} KCAS (Fig 5-5 anchor 56.1, {err0:+.1f}%)")

# ------------------------------------------------------------------- output
def coefs_out(name):
    form, coef, rms = chosen[name]
    if form == "lin":
        return {"a0": round(float(coef[1]), 3), "a1": round(float(coef[0]), 5), "a2": 0.0}
    return {"a0": round(float(coef[2]), 3), "a1": round(float(coef[1]), 5),
            "a2": round(float(coef[0]), 7)}

merge_ias = float(results["flaps40"]["iasMax"])
out = {
    "figure": "5-3",
    "pdfPage": 91,
    "title": "Airspeed System Calibration",
    "deskewDeg": round(deskew, 2),
    "calibration": {
        "ias": {"px0": ias_axis.px0, "v0": ias_axis.v0, "pxPerUnit": ias_axis.px_per_unit},
        "cas": {"px0": cas_axis.px0, "v0": cas_axis.v0, "pxPerUnit": cas_axis.px_per_unit},
    },
    "model": {
        "form": "KCAS = a0 + a1*KIAS + a2*KIAS^2 per flap setting; "
                "flaps-40 line drawn only up to its iasMax (~Vfe 103), "
                "beyond which use flapsUp",
        "params": {name: {**coefs_out(name),
                          "iasMin": round(results[name]["iasMin"], 1),
                          "iasMax": round(results[name]["iasMax"], 1)}
                   for name in ("flapsUp", "flaps40")},
        "rmsPct": round(100 * max(chosen[n][2] for n in chosen) / 100.0, 3),  # rms in kt relative to a 100-kt scale
        "rmsKt": {n: round(chosen[n][2], 3) for n in chosen},
        "casEqualsIasKt": {"flapsUp": 87, "flaps40": 71},
    },
    "typescript": {
        "note": "iasToCas(ias, flaps): evaluate polynomial; casToIas: invert "
                "(linear: (cas-a0)/a1; quad: positive root). Clamp warnings "
                "outside [iasMin, iasMax].",
        "flapsUp": coefs_out("flapsUp"),
        "flaps40": coefs_out("flaps40"),
        "flaps40IasMax": round(merge_ias, 1),
    },
    "curves": [
        {"label": "FLAPS UP (solid)", "points": sample("flapsUp")},
        {"label": "WING FLAPS 40 (dashed)", "points": sample("flaps40")},
    ],
    "workedExample": {
        "inputs": {"note": "Fig 5-3 prints no example box; validated against the "
                            "independently digitized Fig 5-5 CAS<->IAS stall anchors "
                            "at 2440 lb",
                   "kias": 44.1, "flaps": 40},
        "printed": {"kcasFromFig5_5": 50.2},
        "model": {"kcas": round(cas_at_44, 2),
                  "flapsUpCheck": {"kias": 50.2, "kcasFromFig5_5": 56.1,
                                    "kcas": round(cas_at_50, 2),
                                    "errPct": round(err0, 2)}},
        "errPct": round(err40, 2),
    },
    "envelope": {"iasKt": [results["flapsUp"]["iasMin"], results["flapsUp"]["iasMax"]],
                 "flaps40IasKt": [results["flaps40"]["iasMin"], merge_ias]},
    "notes": [
        "FLAPS UP is the solid line (upper, higher CAS at a given IAS); WING "
        "FLAPS 40 is the dashed line, drawn only ~43-103 KIAS (ends at Vfe 103 "
        "where it merges into the flaps-up line).",
        "CAS=IAS crossing: ~87 KIAS flaps up, ~71 KIAS flaps 40; above that CAS < IAS.",
        "Below ~43 KIAS the quadratics are extrapolation; Fig 5-5's stall curves "
        "imply a near-constant CAS-IAS offset (~6-7 kt) there instead.",
        "CAS majors: two of ten print at minor stroke width; progression-filled.",
    ],
}
(OUT / "fits").mkdir(parents=True, exist_ok=True)
with open(OUT / "fits" / "fig_5_03.json", "w") as f:
    json.dump(out, f, indent=2)
print("wrote out/fits/fig_5_03.json")

# QA overlay: calibration majors + fitted lines
def curve_px(name):
    form, coef, _ = chosen[name]
    r = results[name]
    xs = np.linspace(r["pts"][:, 0].min(), r["pts"][:, 0].max(), 200)
    return np.column_stack([xs, np.polyval(np.polyfit(r["pts"][:, 0], r["pts"][:, 1], 2), xs)])

qa.overlay(img, [curve_px("flapsUp"), curve_px("flaps40")],
           vlines=v_maj, hlines=grid_positions, path="fig_5_03_calibration.png")
print("wrote out/qa/fig_5_03_calibration.png")
