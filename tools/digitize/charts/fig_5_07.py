"""Fig 5-7 (PDF p.93): PA-28-161 0-flaps takeoff ground roll.

Same 3-panel nomograph family as the solved Fig 5-11 (25-flap, CLAUDE.md).
Pipeline: deskew -> calibrate axes from thick major gridlines -> extract the
three curve families -> fit
  panel 1: plane   S0 = a + b*PA + c*OAT          (at 2440 lb, zero wind)
  panel 2: power   S  = S0 * (W/2440)^k           (joint k, 5 guide curves)
  panel 3: family  f_head = (1 - Vw/Veff_h)^m_h,  f_tail = (1 + Vw/Veff_t)^m_t
-> validate against the printed worked example (1500 ft, 27 C, 2316 lb,
15 kt HW -> 1150 ft, 50 KIAS) -> emit out/fits/fig_5_07.json + QA overlays.

Run:  uv run python charts/fig_5_07.py
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"
PAGE = 93

# ---------------------------------------------------------------- calibration
img, deskew = raster.prepared_page(PAGE)
ink = raster.binarize(img)
print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=300)
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=200)


def nearest(lines, pos):
    return min(lines, key=lambda ln: abs(ln.pos - pos))


# distance axis: thick 500-ft majors incl. 0-ft bottom border
dist_major_px = [nearest(h_lines, y).pos for y in (536.8, 687.6, 837.5, 985.7, 1135.1, 1286.2, 1435.0)]
dist_major_val = [3000, 2500, 2000, 1500, 1000, 500, 0]
ax_dist, rms_d = calibrate.fit_axis(dist_major_px, dist_major_val)
# OAT axis: thick 20-C majors
oat_major_px = [nearest(v_lines, x).pos for x in (492.4, 639.8, 788.4, 938.6, 1088.3)]
oat_major_val = [-40, -20, 0, 20, 40]
ax_oat, rms_t = calibrate.fit_axis(oat_major_px, oat_major_val)
# weight axis: 2440 ref line + 200-lb majors 2400..1600
wt_major_px = [nearest(v_lines, x).pos for x in (1236.8, 1386.8, 1538.2, 1689.7, 1838.2)]
wt_major_val = [2400, 2200, 2000, 1800, 1600]
ax_wt, rms_w = calibrate.fit_axis(wt_major_px, wt_major_val)
X_REF_W = nearest(v_lines, 1206.3).pos  # 2440-lb reference line
# wind axis: 0-kt ref line + 15-kt border
x_w0 = nearest(v_lines, 1912.9).pos
x_w15 = nearest(v_lines, 2142.0).pos
ax_wind = calibrate.Axis.from_anchors(x_w0, 0.0, x_w15, 15.0)

print(f"dist axis:  0 ft at y={ax_dist.px(0):.1f}, {abs(ax_dist.px_per_unit) * 500:.1f} px/500 ft (rms {rms_d:.2f} px)")
print(f"OAT axis:   0 C at x={ax_oat.px(0):.1f}, {ax_oat.px_per_unit:.3f} px/C (rms {rms_t:.2f} px)")
print(f"weight:     2440 ref x={X_REF_W:.1f}, {abs(ax_wt.px_per_unit):.4f} px/lb (rms {rms_w:.2f} px)")
print(f"            2440 lb extrapolated from majors: x={ax_wt.px(2440):.1f} (ref line {X_REF_W:.1f})")
print(f"wind:       0 kt x={x_w0:.1f}, {ax_wind.px_per_unit:.2f} px/kt")

assert rms_d < 2 and rms_t < 2 and rms_w < 2, "major-gridline calibration failed"
assert abs(ax_wt.px(2440) - X_REF_W) < 4, "2440 ref line inconsistent with weight majors"

Y0 = ax_dist.px(0)
PXFT = abs(ax_dist.px_per_unit)


def dist_of_y(y):
    return (Y0 - np.asarray(y)) / PXFT


def y_of_dist(s):
    return Y0 - np.asarray(s) * PXFT


# ---------------------------------------------------- generic column tracing
def build_cols(mask, x_lo, x_hi, step=3):
    cols = {}
    for x in range(x_lo, x_hi, step):
        col = mask[:, x - 1 : x + 2].any(axis=1)
        ys = np.flatnonzero(col)
        runs = []
        for y in ys:
            if runs and y - runs[-1][-1] <= 4:
                runs[-1].append(y)
            else:
                runs.append([y])
        cols[x] = [float(np.mean(r)) for r in runs]
    return cols


def trace(cols, seed_x, seed_y, slope0, max_miss=25, tol=8.0):
    """Follow one curve through column clusters with local-slope prediction.

    Walks the actual column keys of `cols` outward from the key nearest seed_x.
    """
    keys = np.array(sorted(cols))
    i0 = int(np.argmin(np.abs(keys - seed_x)))
    pts = {int(keys[i0]): seed_y}
    for direction in (+1, -1):
        last_x = int(keys[i0])
        misses = 0
        slope = slope0
        i = i0
        while True:
            i += direction
            if i < 0 or i >= len(keys) or misses > max_miss:
                break
            x = int(keys[i])
            xs = np.array(sorted(pts))
            recent = xs[xs >= last_x - 45] if direction > 0 else xs[xs <= last_x + 45]
            if len(recent) >= 4:
                slope = np.polyfit(recent, [pts[q] for q in recent], 1)[0]
            pred = pts[last_x] + slope * (x - last_x)
            cands = [c for c in cols.get(x, ()) if abs(c - pred) < tol]
            if cands:
                pts[x] = min(cands, key=lambda c: abs(c - pred))
                last_x = x
                misses = 0
            else:
                misses += 1
    xs = np.array(sorted(pts))
    return np.column_stack([xs, [pts[q] for q in xs]])


def sigma_clip_trace(tr, deg=2, iters=4, nsig=2.5):
    for _ in range(iters):
        co = np.polyfit(tr[:, 0], tr[:, 1], deg)
        r = tr[:, 1] - np.polyval(co, tr[:, 0])
        keep = np.abs(r) < nsig * max(r.std(), 1.0)
        if keep.all():
            break
        tr = tr[keep]
    return tr


# ------------------------------------------- panel 1: PA guide curves (7 off)
p1 = np.zeros_like(ink)
p1[520:1440, 495:1090] = ink[520:1440, 495:1090]
mask1 = curves.curve_mask(p1, angles_deg=list(np.arange(5, 61, 2.5)), length=25)
cols1 = build_cols(mask1, 500, 1086)
# seeds at x=930 found by column probing; 7 curves = PA 6000..0 in 1000-ft steps
P1_SEEDS = {6000: 703, 5000: 763, 4000: 826, 3000: 887, 2000: 946, 1000: 1009, 0: 1074}
p1_traces = {}
for pa, sy in P1_SEEDS.items():
    tr = sigma_clip_trace(trace(cols1, 930, float(sy), slope0=-0.75))
    p1_traces[pa] = np.column_stack([ax_oat.value(tr[:, 0]), dist_of_y(tr[:, 1])])

allp = np.vstack([np.column_stack([np.full(len(v), pa), v]) for pa, v in p1_traces.items()])
A = np.column_stack([np.ones(len(allp)), allp[:, 0], allp[:, 1]])
plane, *_ = np.linalg.lstsq(A, allp[:, 2], rcond=None)
pred = A @ plane
plane_rms_pct = 100 * float(np.sqrt(np.mean(((allp[:, 2] - pred) / pred) ** 2)))
print(f"\npanel 1 plane: S0 = {plane[0]:.1f} + {plane[1]:.4f}*PA + {plane[2]:.2f}*OAT  (rms {plane_rms_pct:.2f}%)")


def S0_model(pa, oat):
    return plane[0] + plane[1] * pa + plane[2] * oat


# --------------------------------------- panel 2: weight guide curves (5 off)
p2 = np.zeros_like(ink)
p2[560:1440, 1207:1905] = ink[560:1440, 1207:1905]
mask2 = curves.curve_mask(p2, angles_deg=list(np.arange(-48, -5, 2.0)), length=23)
mask2[984:1002, :] = 0  # dashed worked-example horizontal at ~1477 ft
cols2 = build_cols(mask2, 1210, 1901)
PX_PER_LB = abs(ax_wt.px_per_unit)


def w_of_x(x):
    return 2440 - (np.asarray(x) - X_REF_W) / PX_PER_LB


def refine_power(Sref, k, iters=8):
    """Iterate: predict y(x) from S=Sref*(W/2440)^k, grab nearby clusters, refit."""
    pts = None
    for _ in range(iters):
        got = []
        for x in sorted(cols2):
            W = float(w_of_x(x))
            if W < 1500:
                break
            ypred = y_of_dist(Sref * (W / 2440.0) ** k)
            cand = [c for c in cols2[x] if abs(c - ypred) < 6]
            if cand:
                got.append((x, min(cand, key=lambda c: abs(c - ypred))))
        pts = np.array(got)
        W = w_of_x(pts[:, 0])
        S = dist_of_y(pts[:, 1])
        ok = W >= 1695  # labeled weight range only
        k_, c_ = np.polyfit(np.log(W[ok] / 2440.0), np.log(S[ok]), 1)
        Sref, k = float(np.exp(c_)), float(k_)
    W = w_of_x(pts[:, 0])
    S = dist_of_y(pts[:, 1])
    ok = W >= 1695
    r = np.log(S[ok]) - (k * np.log(W[ok] / 2440.0) + np.log(Sref))
    return Sref, k, pts[ok], 100 * float(r.std())


P2_INITS = [(2727, 2.34), (2256, 2.16), (1891, 2.26), (1502, 2.45), (1089, 2.49)]
p2_fits = []
p2_pts = []
print("\npanel 2 weight guides, S = S_ref*(W/2440)^k:")
for s0, k0 in P2_INITS:
    Sref, k, pts, rms = refine_power(s0, k0)
    p2_fits.append((Sref, k))
    p2_pts.append(pts)
    print(f"  S_ref={Sref:7.1f}  k={k:.3f}  rms {rms:.2f}%  n={len(pts)}")
# joint exponent (shared k, per-curve S_ref)
Wj = np.concatenate([w_of_x(p[:, 0]) for p in p2_pts])
Sj = np.concatenate([dist_of_y(p[:, 1]) for p in p2_pts])
ij = np.concatenate([np.full(len(p), i) for i, p in enumerate(p2_pts)])
Aj = np.zeros((len(Wj), 6))
Aj[np.arange(len(Wj)), ij.astype(int)] = 1.0
Aj[:, 5] = np.log(Wj / 2440.0)
cj, *_ = np.linalg.lstsq(Aj, np.log(Sj), rcond=None)
K_WEIGHT = float(cj[5])
p2_srefs = [float(np.exp(v)) for v in cj[:5]]
wt_rms_pct = 100 * float((np.log(Sj) - Aj @ cj).std())
print(f"  joint k = {K_WEIGHT:.3f}  (rms {wt_rms_pct:.2f}%)   [Fig 5-11: 1.85]")

# ------------------------------------------------- panel 3: wind guide fans
p3h = np.zeros_like(ink)
p3h[560:1440, 1913:2143] = ink[560:1440, 1913:2143]
mask3h = curves.curve_mask(p3h, angles_deg=list(np.arange(-45, -6, 2.0)), length=21)
ys_h, xs_h = np.nonzero(mask3h[640:1440, 1995:2143])
ys_h = ys_h + 640.0
xs_h = xs_h + 1995.0  # headwind-only region (right of tailwind extent)
Vw_h = ax_wind.value(xs_h)
S_h = dist_of_y(ys_h)

p3t = np.zeros_like(ink)
p3t[640:1440, 1913:1997] = ink[640:1440, 1913:1997]
mask3t = curves.curve_mask(p3t, angles_deg=list(np.arange(20, 62, 3.0)), length=17)
ys_t, xs_t = np.nonzero(mask3t)
Vw_t = ax_wind.value(xs_t.astype(float))
S_t = dist_of_y(ys_t.astype(float))
sel = (Vw_t > 0.1) & (Vw_t < 5.3) & (S_t > 100)
Vw_t, S_t = Vw_t[sel], S_t[sel]


def collapse_scan(Vw, S, sign, v_grid, m_grid):
    """Score (Veff, m) by how sharply S/(1 +/- Vw/Veff)^m concentrates."""
    best = None
    for Veff in v_grid:
        for m in m_grid:
            sref = S / (1 + sign * Vw / Veff) ** m
            h, _ = np.histogram(sref, bins=np.arange(200, 3200, 12))
            sc = np.sort(h)[::-1][:10].sum() / len(sref)
            if best is None or sc > best[0]:
                best = (float(sc), float(Veff), float(m))
    return best


sc, VEFF_H, M_H = collapse_scan(Vw_h, S_h, -1, np.arange(60, 200, 4), np.arange(0.8, 2.6, 0.1))
sc, VEFF_H, M_H = collapse_scan(
    Vw_h, S_h, -1, np.arange(VEFF_H - 6, VEFF_H + 6, 1.0), np.arange(M_H - 0.15, M_H + 0.16, 0.02)
)
sc_t, VEFF_T, M_T = collapse_scan(Vw_t, S_t, +1, np.arange(20, 120, 2), np.arange(0.8, 2.6, 0.1))
f_head_15 = (1 - 15 / VEFF_H) ** M_H
f_tail_5 = (1 + 5 / VEFF_T) ** M_T
print(f"\nwind panel: f_head = (1 - Vw/{VEFF_H:.0f})^{M_H:.2f}   f(5)={(1-5/VEFF_H)**M_H:.3f} "
      f"f(10)={(1-10/VEFF_H)**M_H:.3f} f(15)={f_head_15:.3f}")
print(f"            f_tail = (1 + Vw/{VEFF_T:.0f})^{M_T:.2f}   f(5)={f_tail_5:.3f}")


def peak_srefs(Vw, S, sign, Veff, m, exclude=()):
    sref = S / (1 + sign * Vw / Veff) ** m
    h, edges = np.histogram(sref, bins=np.arange(200, 3200, 12))
    tops = sorted(edges[np.argsort(h)[::-1][:24]] + 6)
    merged = []
    for p in tops:
        if merged and p - merged[-1][-1] <= 40:
            merged[-1].append(p)
        else:
            merged.append([p])
    out = [float(np.mean(g)) for g in merged]
    return [p for p in out if all(abs(p - e) > 45 for e in exclude)]


# 1482 ft peak = the dashed worked-example descent, not a printed guide curve
hw_srefs = peak_srefs(Vw_h, S_h, -1, VEFF_H, M_H, exclude=(1482,))
tw_srefs = peak_srefs(Vw_t, S_t, +1, VEFF_T, M_T)

# ------------------------------------------------- lift-off speed strip
# printed labels 52/48/46/43/40 KIAS; label centers measured at x =
# 1202/1384/1534/1692/1876 -> weights 2440/2204/2004/1795/1550 lb.
strip = {2440: 52, 2204: 48, 2004: 46, 1795: 43, 1550: 40}
print("\nlift-off strip vs V = 52*sqrt(W/2440):")
for W, v in strip.items():
    print(f"  W={W}: printed {v} KIAS, sqrt-law {52 * np.sqrt(W / 2440):.1f} KIAS")


def v_lof_kias(W):
    return 52.0 * np.sqrt(W / 2440.0)


# ------------------------------------------------------- assembled model
def sigma(pa_ft, oat_c):
    delta = (1 - 6.87559e-6 * pa_ft) ** 5.2559
    theta = (oat_c + 273.15) / 288.15
    return delta / theta


def ground_roll(pa_ft, oat_c, w_lb, wind_kt):
    s0 = S0_model(pa_ft, oat_c)
    s = s0 * (w_lb / 2440.0) ** K_WEIGHT
    if wind_kt > 0:
        f = (1 - wind_kt / VEFF_H) ** M_H
    elif wind_kt < 0:
        f = (1 + abs(wind_kt) / VEFF_T) ** M_T
    else:
        f = 1.0
    return s0, s, s * f


# ------------------------------------------------------- worked example
ex = dict(pa=1500, oat=27, w=2316, hw=15)
s0, s_w, s_final = ground_roll(ex["pa"], ex["oat"], ex["w"], ex["hw"])
v = v_lof_kias(ex["w"])
err_pct = 100 * (s_final / 1150.0 - 1)
print(f"\nworked example (printed: 1150 ft, 50 KIAS; dashed trace: S0~1665, after weight ~1477):")
print(f"  S0(1500,27)   = {s0:7.1f} ft")
print(f"  x weight      = {s_w:7.1f} ft   ((2316/2440)^{K_WEIGHT:.3f} = {(2316 / 2440.0) ** K_WEIGHT:.4f})")
print(f"  x wind        = {s_final:7.1f} ft   vs printed 1150 -> {err_pct:+.1f}%")
print(f"  V_LOF         = {v:.1f} KIAS (printed 50)")

# ------------------------------------------------------------ QA overlays
model_curves = []
for pa in sorted(p1_traces, reverse=True):
    oats = p1_traces[pa][:, 0]
    o = np.linspace(oats.min(), oats.max(), 40)
    model_curves.append(np.column_stack([ax_oat.px(o), y_of_dist(S0_model(pa, o))]))
for sref, i in zip(p2_srefs, range(5)):
    W = np.linspace(2440, 1600, 40)
    model_curves.append(np.column_stack([ax_wt.px(W), y_of_dist(sref * (W / 2440.0) ** K_WEIGHT)]))
for sref in hw_srefs:
    vw = np.linspace(0, 15, 30)
    yy = y_of_dist(sref * (1 - vw / VEFF_H) ** M_H)
    m = yy < Y0
    model_curves.append(np.column_stack([ax_wind.px(vw[m]), yy[m]]))
for sref in tw_srefs:
    vw = np.linspace(0, 5, 12)
    yy = y_of_dist(sref * (1 + vw / VEFF_T) ** M_T)
    m = yy > ax_dist.px(3000)
    model_curves.append(np.column_stack([ax_wind.px(vw[m]), yy[m]]))
qa.overlay(
    img,
    model_curves,
    vlines=oat_major_px + [X_REF_W] + wt_major_px + [x_w0, x_w15],
    hlines=dist_major_px,
    path="fig_5_07_model.png",
)
qa.overlay(
    img,
    [np.column_stack([ax_oat.px(t[:, 0]), y_of_dist(t[:, 1])]) for t in p1_traces.values()]
    + [p for p in p2_pts],
    vlines=[ax_oat.px(27), X_REF_W, ax_wt.px(2316)],
    hlines=[y_of_dist(1665), y_of_dist(1477)],
    path="fig_5_07_traces.png",
)
print("\nQA: out/qa/fig_5_07_model.png, out/qa/fig_5_07_traces.png")

# ------------------------------------------------------------------ JSON
def sub(arr, n=25):
    arr = np.asarray(arr)
    idx = np.unique(np.linspace(0, len(arr) - 1, n).astype(int))
    return [[round(float(a), 1), round(float(b), 1)] for a, b in arr[idx]]


curves_out = [
    {"label": f"panel1 PA {pa} ft", "points": sub(tr)} for pa, tr in sorted(p1_traces.items())
]
curves_out += [
    {
        "label": f"panel2 weight guide S_ref={p2_srefs[i]:.0f}",
        "points": sub(np.column_stack([w_of_x(p[:, 0]), dist_of_y(p[:, 1])])),
    }
    for i, p in enumerate(p2_pts)
]
curves_out += [
    {"label": "panel3 headwind guide S_ref list", "points": [[0.0, round(s)] for s in hw_srefs]},
    {"label": "panel3 tailwind guide S_ref list", "points": [[0.0, round(s)] for s in tw_srefs]},
]

result = {
    "figure": "5-7",
    "pdfPage": PAGE,
    "title": "0 deg flaps takeoff ground roll",
    "associatedConditions": "paved level dry runway, full power before brake release, flaps 0",
    "deskewDeg": round(float(deskew), 2),
    "calibration": {
        "distanceFt": {"px0": round(Y0, 1), "v0": 0.0, "pxPerUnit": round(ax_dist.px_per_unit, 5)},
        "oatC": {"px0": round(ax_oat.px(0), 1), "v0": 0.0, "pxPerUnit": round(ax_oat.px_per_unit, 4)},
        "weightLb": {"px0": round(X_REF_W, 1), "v0": 2440.0, "pxPerUnit": round(ax_wt.px_per_unit, 5)},
        "windKt": {"px0": round(x_w0, 1), "v0": 0.0, "pxPerUnit": round(ax_wind.px_per_unit, 3)},
    },
    "model": {
        "form": (
            "S_gr[ft] = S0 * (W/2440)^k * f_wind;  "
            "S0 = a + b*PA_ft + c*OAT_C;  "
            "headwind f = (1 - Vw/Veff_h)^m_h;  tailwind f = (1 + Vw/Veff_t)^m_t;  "
            "V_LOF = 52*sqrt(W/2440) KIAS (strip prints 52/48/46/43/40; see notes)"
        ),
        "params": {
            "a": round(float(plane[0]), 1),
            "b": round(float(plane[1]), 4),
            "c": round(float(plane[2]), 2),
            "k": round(K_WEIGHT, 3),
            "Veff_h_kt": round(VEFF_H, 1),
            "m_h": round(M_H, 2),
            "Veff_t_kt": round(VEFF_T, 1),
            "m_t": round(M_T, 2),
            "vLofRefKias": 52.0,
            "wRefLb": 2440.0,
        },
        "rmsPct": round(max(plane_rms_pct, wt_rms_pct), 2),
        "panel1RmsPct": round(plane_rms_pct, 2),
        "panel2RmsPct": round(wt_rms_pct, 2),
        "windFactors": {
            "head5": round((1 - 5 / VEFF_H) ** M_H, 4),
            "head10": round((1 - 10 / VEFF_H) ** M_H, 4),
            "head15": round(float(f_head_15), 4),
            "tail5": round(float(f_tail_5), 4),
        },
    },
    "curves": curves_out,
    "workedExample": {
        "inputs": {"paFt": 1500, "oatC": 27, "weightLb": 2316, "headwindKt": 15},
        "printed": {"groundRollFt": 1150, "liftOffKias": 50},
        "dashedTrace": {"s0Ft": 1665, "afterWeightFt": 1477},
        "model": {
            "s0Ft": round(s0, 0),
            "afterWeightFt": round(s_w, 0),
            "groundRollFt": round(s_final, 0),
            "liftOffKias": round(v, 1),
        },
        "errPct": round(err_pct, 1),
    },
    "envelope": {
        "paFt": [0, 6000],
        "oatC": [-40, 40],
        "weightLb": [1700, 2440],
        "headwindKt": [0, 15],
        "tailwindKt": [0, 5],
        "notes": "curves truncated bottom-left: SL curve drawn only OAT >= ~-13 C, 1000-ft curve >= ~-24 C",
    },
    "notes": [
        "Panel 1 has 7 PA guide curves (SL..6000 ft in 1000-ft steps; 5000/3000/1000 unlabeled); labels attach from BELOW as on Fig 5-11.",
        "Panel-1 plane coefficients vs Fig 5-11 (25 flap): a 860 vs 812, b 0.212 vs 0.188 ft/ft, c 17.8 vs 15.1 ft/C. Temp-to-altitude ratio c/b = 84 ft PA per C (5-11: 80) - same sub-DA anisotropy (carbureted power lapse signature).",
        "Weight exponent k = 2.35 (per-curve 2.26..2.41), distinctly higher than Fig 5-11's 1.85. Confirmed independently by the dashed example trace: 1477/1665 = (2316/2440)^2.30.",
        "Wind fit (Veff, m) sits on a shallow ridge - (93,1.45), (106,1.69) and (126,2.03) all fit equally; robust quantities are the factors f(5/10/15) = 0.923/0.848/0.775 headwind, 1.26 tailwind at 5 kt. At the example's V_TAS 53 kt these read as (1 - 0.57*Vw/V_TAS)^1.45 or (1 - 0.50*Vw/V_TAS)^1.69: slightly stronger headwind credit than 5-11's (1-0.5Vw/V_TAS)^1.55 (f15 0.775 vs 0.791).",
        "Lift-off strip: printed 52/48/46/43/40 KIAS at label-x weights ~2440/2204/2004/1795/1550 lb. Pure V=52*sqrt(W/2440) over-predicts the mid/low labels by 1-1.5 kt (49.4/47.1/44.6/41.4). Printed example 2316->50 vs sqrt-law 50.7. Possibly IAS position-error correction baked in (cf. Fig 5-3); sqrt law retained for the model.",
        "0/25-flap ratio (from fits): panel-1 ratio 1.05-1.12 across envelope (1.10 at the example), grows with PA and OAT; weight-term ratio (W/2440)^0.49 shrinks the 0-flap penalty at light weight (charts cross below ~2000 lb); 15-kt headwind ratio 0.773/0.791 = 0.98.",
        "Wind-panel guide curves are spaced ~200 ft at the ref line (11 headwind, ~10 tailwind); the 1482-ft collapse peak is the dashed worked example, excluded from the family.",
    ],
}
OUT_FITS.mkdir(parents=True, exist_ok=True)
out_path = OUT_FITS / "fig_5_07.json"
out_path.write_text(json.dumps(result, indent=2))
print(f"wrote {out_path}")
