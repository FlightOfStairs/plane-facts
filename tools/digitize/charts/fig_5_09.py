"""Fig 5-9 (PDF p.94): PA-28-161 0-deg flaps takeoff performance -
TOTAL DISTANCE OVER A 50 FT BARRIER. Three-panel nomograph, same family as
Fig 5-11 (solved; see CLAUDE.md), plus TWO speed strips (lift-off and
50-ft-barrier speed).

Run:  uv run python charts/fig_5_09.py
Writes out/fits/fig_5_09.json and out/qa/fig_5_09_*.png.

Layout (deskewed 300-dpi raster, page 94):
  panel 1  x ~ [457, 1062]  OAT -40..+40 C; PA guide curves 0..7000 ft
           (1000-ft steps; only 6000/4000/2000/SL labeled; identity of the
           unlabeled top curve = 7000 confirmed via STD-TEMP (ISA) crossings)
  panel 2  x ~ [1106, 1660]  weight 2440..1700 lb; 5 unlabeled guide curves
           (curves continue past the 1700-lb gridline to the no-wind ref
           line at x~1735.6, i.e. to ~1600 lb equivalent)
  panel 3  x ~ [1736, 1962]  wind 0..15 kt; 8 headwind guides (origins at
           round 500..4000 ft levels) + tailwind guides 0..5 kt
  speed strips: numerals from the 2440-lb ref line to the no-wind ref line;
           barrier 57..44 KIAS, lift-off 52..40 KIAS.
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT = Path(__file__).resolve().parents[1] / "out"

# ----------------------------------------------------------------- page + axes
img, deskew = raster.prepared_page(94)
ink = raster.binarize(img)
print(f"page 94: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=300)
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=200)


def nearest(lines, pos):
    return min(lines, key=lambda ln: abs(ln.pos - pos))


# distance axis: bottom border = 0 ft, majors every 1000 ft (labels 500..4000
# are printed ~25-40 px BELOW their gridlines; calibrate from lines only)
dist_px = [nearest(h_lines, p).pos for p in (1315.9, 1167.6, 1017.4, 866.2, 716.4, 566.9)]
ax_dist, rms_d = calibrate.fit_axis(dist_px, [0, 1000, 2000, 3000, 4000, 5000])
# OAT axis majors every 10 C
oat_px = [nearest(v_lines, p).pos for p in (456.8, 534.2, 607.1, 758.3, 834.4, 910.2, 986.5, 1061.5)]
ax_oat, rms_t = calibrate.fit_axis(oat_px, [-40, -30, -20, 0, 10, 20, 30, 40])
# weight axis: 2440 ref line + 100-lb majors (2300 major is contaminated by
# the dashed example vertical at W=2316 -> skipped)
w_px = [nearest(v_lines, p).pos for p in (1106.4, 1359.6, 1435.2, 1510.2, 1585.6, 1659.9)]
ax_w, rms_w = calibrate.fit_axis(w_px, [2440, 2100, 2000, 1900, 1800, 1700])
# wind axis majors every 5 kt
wind_px = [nearest(v_lines, p).pos for p in (1735.6, 1809.8, 1886.6, 1961.8)]
ax_wind, rms_wd = calibrate.fit_axis(wind_px, [0, 5, 10, 15])

X_REF_W = ax_w.px(2440)
X_REF_WIND = ax_wind.px(0)
X_WIND_15 = ax_wind.px(15)
print(f"dist axis: 0 ft @ y={ax_dist.px(0):.1f}, {abs(ax_dist.px_per_unit)*1000:.1f} px/1000 ft (rms {rms_d:.2f}px)")
print(f"OAT axis: 0 C @ x={ax_oat.px(0):.1f}, {ax_oat.px_per_unit:.3f} px/C (rms {rms_t:.2f}px)")
print(f"weight: 2440 @ x={X_REF_W:.1f}, {abs(ax_w.px_per_unit):.4f} px/lb (rms {rms_w:.2f}px)")
print(f"wind: 0 kt @ x={X_REF_WIND:.1f}, {ax_wind.px_per_unit:.3f} px/kt (rms {rms_wd:.2f}px)")

qa.overlay(img, [], vlines=oat_px + w_px + wind_px, hlines=dist_px, path="fig_5_09_cal.png")


# ------------------------------------------------------------ shared utilities
def run_centers(mask, col):
    ys = np.flatnonzero(mask[:, col])
    if ys.size == 0:
        return []
    out, start, prev = [], ys[0], ys[0]
    for y in ys[1:]:
        if y - prev > 2:
            out.append((start + prev) / 2)
            start = y
        prev = y
    out.append((start + prev) / 2)
    return out


def track(mask, seed_col, seed_ys, x_lo, x_hi, slope0, clip, gate=7.0, gapmax=130):
    """Multi-curve tracker: predict each curve column-by-column from its local
    slope, greedily match run centers (unique assignment), coast over gaps."""
    tracks = [dict(pts=[(seed_col, float(y))], slope=slope0) for y in seed_ys]
    for direction in (+1, -1):
        for t in tracks:
            t["gap"], t["alive"] = 0, True
        for col in range(seed_col + direction, (x_hi if direction > 0 else x_lo), direction):
            for t in tracks:
                pts = sorted(t["pts"])
                near = [p for p in pts if abs(p[0] - col) < 60]
                if len(near) >= 8:
                    t["slope"] = float(np.clip(np.polyfit([p[0] for p in near], [p[1] for p in near], 1)[0], *clip))
                edge = pts[-1] if direction > 0 else pts[0]
                t["pred"] = edge[1] + t["slope"] * (col - edge[0])
            cands = []
            for ti, t in enumerate(tracks):
                if t["alive"]:
                    for r in run_centers(mask, col):
                        d = abs(r - t["pred"])
                        if d < gate:
                            cands.append((d, ti, r))
            cands.sort()
            used_t, used_r = set(), set()
            for d, ti, r in cands:
                if ti in used_t or r in used_r:
                    continue
                used_t.add(ti)
                used_r.add(r)
                tracks[ti]["pts"].append((col, float(r)))
                tracks[ti]["gap"] = 0
            for ti, t in enumerate(tracks):
                if t["alive"] and ti not in used_t:
                    t["gap"] += 1
                    if t["gap"] > gapmax:
                        t["alive"] = False
    return [np.array(sorted(t["pts"])) for t in tracks]


def thin(pts, step=4):
    """Per-column mean, every `step`th column."""
    pts = np.asarray(pts, float)
    out = []
    for x in np.unique(pts[:, 0].astype(int))[::step]:
        out.append((float(x), float(pts[pts[:, 0].astype(int) == x][:, 1].mean())))
    return np.array(out)


def dashed_row(x0, x1, y0, y1):
    """y of a dashed horizontal: densest non-grid row band (grid rows are
    ~15 px apart and denser; dashed rows sit between grid rows)."""
    sub = ink[y0:y1, x0:x1]
    dens = sub.sum(axis=1).astype(float)
    grid = calibrate.line_mask(ink, "h")[y0:y1, x0:x1].sum(axis=1)
    dens[grid > 30] = 0  # kill true gridline rows
    # also kill rows adjacent to gridline rows
    g = np.flatnonzero(grid > 30)
    for i in g:
        dens[max(0, i - 2):i + 3] = 0
    band = np.argmax(dens)
    w = dens[max(0, band - 3):band + 4]
    idx = np.arange(max(0, band - 3), band + 4)
    return float((idx * w).sum() / w.sum()) + y0


# ------------------------------------------------- panel 1: PA x OAT -> S0
P1 = (slice(555, 1316), slice(445, 1075))
panel1 = np.zeros_like(ink)
panel1[P1] = ink[P1]
mask1 = curves.curve_mask(panel1, angles_deg=list(np.arange(10, 61, 2.5)), length=25)

seed1 = run_centers(mask1, 900)  # 7 curves: 6000..0 top-to-bottom (7000 exits ROI top before x=900)
assert len(seed1) == 7, f"panel1 seed expects 7 runs at x=900, got {len(seed1)}"
tracks1 = track(mask1, 900, seed1, 458, 1062, -0.6, (-1.0, -0.2))

# 7000-ft curve: straight; collect mask inliers around its Hough line
m7 = (925.5 - 644.0) / (461.5 - 842.5)
ys, xs = np.nonzero(mask1)
sel = (np.abs(ys - (925.5 + m7 * (xs - 461.5))) < 5) & (xs >= 455) & (xs <= 855)
pts7 = np.column_stack([xs[sel], ys[sel]]).astype(float)

# 3000-ft curve (tracks1[3]) is interrupted by the PRESSURE ALTITUDE banner
# left of x~830; recover the left part from mask inliers around its line
m3 = -0.52
sel3 = (np.abs(ys - (1090.0 + m3 * (xs - 464.0))) < 6) & (xs >= 458) & (xs <= 900)
pts3_left = np.column_stack([xs[sel3], ys[sel3]]).astype(float)
tracks1[3] = np.vstack([pts3_left, tracks1[3]])

fam1 = [(7000, thin(pts7))] + [(6000 - 1000 * i, thin(tracks1[i])) for i in range(7)]

# refine each curve: quadratic fit + inlier re-collection (kills stray text hits)
fam1_fit = []
for pa, pts in fam1:
    co = np.polyfit(pts[:, 0], pts[:, 1], 2)
    keep = np.abs(np.polyval(co, pts[:, 0]) - pts[:, 1]) < 4
    pts = pts[keep]
    fam1_fit.append((pa, pts))

samples1 = []
for pa, pts in fam1_fit:
    for x, y in pts:
        samples1.append((pa, ax_oat.value(x), ax_dist.value(y)))
samples1 = np.array(samples1)
PA, T, D = samples1.T
A1 = np.column_stack([np.ones_like(PA), PA, PA**2, T, PA * T])
c1, *_ = np.linalg.lstsq(A1, D, rcond=None)
rms1 = float(np.sqrt(np.mean(((A1 @ c1 - D) / D) ** 2)) * 100)
e0, e1, e2, f0, f1 = c1
print(f"\npanel 1 (n={len(samples1)}): S0 = ({e0:.1f} + {e1:.4f}*PA + {e2:.3e}*PA^2) + ({f0:.2f} + {f1:.4e}*PA)*OAT")
print(f"  rms {rms1:.2f}%")


def S0(pa, t):
    return (e0 + e1 * pa + e2 * pa * pa) + (f0 + f1 * pa) * t


qa.overlay(img, [pts for _, pts in fam1_fit], vlines=[ax_oat.px(-40), ax_oat.px(40)],
           hlines=dist_px, path="fig_5_09_p1.png")

# ---------------------------------------------- panel 2: weight guide curves
P2 = (slice(600, 1316), slice(1112, 1732))
panel2 = np.zeros_like(ink)
panel2[P2] = ink[P2]
mask2 = curves.curve_mask(panel2, angles_deg=list(np.arange(-55, -4, 2.5)), length=25)
# erase the dashed worked-example horizontal (y~933) so tracks can't lock on
y_dash_w = dashed_row(1230, 1700, 900, 990)
mask2[int(y_dash_w) - 7:int(y_dash_w) + 8, 1180:1732] = 0

seed2 = [s for s in run_centers(mask2, 1700) if 1000 < s < 1280]
assert len(seed2) == 5, f"panel2 expects 5 guide curves at x=1700, got {len(seed2)}"
tracks2 = track(mask2, 1700, seed2, 1113, 1731, +0.55, (0.0, 1.2))

# weight model: lnD = lnD_ref + a*u + b*u^2, u = ln(W/2440), fitted on the
# labeled span W in [1700, 2440]
rows = []
for t in tracks2:
    pts = thin(t, 3)
    x0 = pts[np.argmin(np.abs(pts[:, 0] - X_REF_W))]
    d_ref = ax_dist.value(np.interp(X_REF_W, pts[:, 0], pts[:, 1]))
    for x, y in pts:
        w = ax_w.value(x)
        if w < 1700 or w > 2440:
            continue
        rows.append((d_ref, np.log(w / 2440.0), np.log(ax_dist.value(y) / d_ref)))
rows = np.array(rows)
DREF, U, LR = rows.T
LD = np.log(DREF / 2500.0)
A2 = np.column_stack([U, U**2, U**3, U * LD])
c2w, *_ = np.linalg.lstsq(A2, LR, rcond=None)
kw_a, kw_b, kw_d, kw_c = c2w
pred = A2 @ c2w
rms2 = float(np.sqrt(np.mean((np.exp(pred - LR) - 1) ** 2)) * 100)
print(f"\npanel 2 (n={len(rows)}): ln(D/D_ref) = ({kw_a:.3f} {kw_c:+.3f}*ln(Dref/2500))*u {kw_b:+.3f}*u^2 {kw_d:+.3f}*u^3, u=ln(W/2440); rms {rms2:.2f}%")
# per-curve endpoint exponents for the report
for t in tracks2:
    pts = thin(t, 3)
    d0 = ax_dist.value(np.interp(ax_w.px(2440), pts[:, 0], pts[:, 1]))
    d17 = ax_dist.value(np.interp(ax_w.px(1700), pts[:, 0], pts[:, 1]))
    print(f"  guide D_ref={d0:6.0f} -> D(1700)={d17:6.0f}  end-to-end k={np.log(d17 / d0) / np.log(1700 / 2440):.2f}")


def f_weight(w, d_ref):
    u = np.log(w / 2440.0)
    return np.exp((kw_a + kw_c * np.log(d_ref / 2500.0)) * u + kw_b * u**2 + kw_d * u**3)


qa.overlay(img, [thin(t, 2) for t in tracks2], vlines=[X_REF_W, ax_w.px(1700), X_REF_WIND],
           hlines=[y_dash_w], path="fig_5_09_p2.png")

# ------------------------------------------------ panel 3: wind guide curves
P3 = (slice(600, 1316), slice(1655, 1975))
panel3 = np.zeros_like(ink)
panel3[P3] = ink[P3]
# long steep-only kernels: the wind-panel grid is dense and slightly wavy, so
# the library's grid exclusion leaks; length-31 kernels at >=14 deg never fit
# pure h/v gridlines.
mask_hw = curves.curve_mask(panel3, angles_deg=list(np.arange(-40, -13.9, 2.5)), length=31, exclude_grid=False)
mask_hw[int(y_dash_w) - 7:int(y_dash_w) + 8, 1655:1765] = 0  # dashed example entry
# the dashed example CURVE descends through the headwind fan just above the
# 2500-ft guide (converging to it at 15 kt) - erase a thin band along its
# straight-line path so the guide track cannot lock onto the dashes
y15_dash = ax_dist.px(2100.0)
for col in range(int(X_REF_WIND), 1963):
    yc = y_dash_w + (y15_dash - y_dash_w) * (col - X_REF_WIND) / (X_WIND_15 - X_REF_WIND)
    mask_hw[int(yc) - 5:int(yc) + 3, col] = 0
mask_tw = curves.curve_mask(panel3, angles_deg=list(np.arange(40, 71, 2.5)), length=31, exclude_grid=False)

seed3 = run_centers(mask_hw, 1745)
seed3 = [s for s in seed3 if s < 1300]
# merge close pairs (curve + dashed remnants)
merged = []
for s in seed3:
    if merged and s - merged[-1] < 12:
        merged[-1] = (merged[-1] + s) / 2
    else:
        merged.append(s)
seed3 = merged
assert len(seed3) == 8, f"panel3 expects 8 headwind guides at x=1745, got {len(seed3)}: {seed3}"
tracks3h = track(mask_hw, 1745, seed3, 1737, 1962, +0.5, (0.1, 0.9), gate=6, gapmax=60)

seed3t = run_centers(mask_tw, 1740)
merged = []
for s in seed3t:
    if merged and s - merged[-1] < 12:
        merged[-1] = (merged[-1] + s) / 2
    else:
        merged.append(s)
seed3t = merged
tracks3t = track(mask_tw, 1740, seed3t, 1736, 1812, -1.5, (-2.5, -0.7), gate=6, gapmax=25)
tracks3t = [t for t in tracks3t if t[:, 0].max() - t[:, 0].min() > 40]

# headwind fit: r = (1 - 0.5*Vw/V_REF)^m, V_REF = 57 kt (barrier speed at max
# weight; the guides are drawn once for all conditions)
V_REF = 57.0
hw_rows = []
for t in tracks3h:
    pts = thin(t, 2)
    d0 = ax_dist.value(np.interp(X_REF_WIND, pts[:, 0], pts[:, 1]))
    for x, y in pts:
        vw = ax_wind.value(x)
        if vw < 0.3:
            continue
        hw_rows.append((d0, vw, ax_dist.value(y) / d0))
hw_rows = np.array(hw_rows)
D0H, VW, R = hw_rows.T
# the bottom (500-ft) guide is a strong outlier (15-kt ratio 0.60 vs 0.79-0.85
# for all others) - exclude it from the policy fit, keep it digitized
good = D0H > 700
xh = np.log(1 - 0.5 * VW[good] / V_REF)
ldh = np.log(D0H[good] / 2500.0)
Ah = np.column_stack([xh, xh * ldh])
ch, *_ = np.linalg.lstsq(Ah, np.log(R[good]), rcond=None)
m_hw0, m_hw1 = ch
rms3h = float(np.sqrt(np.mean((np.exp(Ah @ ch) / R[good] - 1) ** 2)) * 100)
print(f"\npanel 3 headwind (n={int(good.sum())}, bottom guide excluded): "
      f"r = (1 - 0.5*Vw/{V_REF:.0f})^({m_hw0:.2f} {m_hw1:+.2f}*ln(D/2500)), rms {rms3h:.2f}%")
for t in tracks3h:
    pts = thin(t, 2)
    d0 = ax_dist.value(np.interp(X_REF_WIND, pts[:, 0], pts[:, 1]))
    d15 = ax_dist.value(np.interp(X_WIND_15, pts[:, 0], pts[:, 1]))
    print(f"  guide D0={d0:6.0f} -> D(15kt)={d15:6.0f}  ratio {d15 / d0:.3f}")

tw_rows = []
tw_report = []
for t in tracks3t:
    pts = thin(t, 2)
    d0 = ax_dist.value(np.interp(X_REF_WIND, pts[:, 0], pts[:, 1]))
    for x, y in pts:
        vw = ax_wind.value(x)
        if vw < 0.3:
            continue
        tw_rows.append((vw, ax_dist.value(y) / d0, d0))
    xe = pts[:, 0].max()
    de = ax_dist.value(np.interp(xe, pts[:, 0], pts[:, 1]))
    tw_report.append((d0, ax_wind.value(xe), de))
tw_rows = np.array(tw_rows)
xt = np.log(1 + 1.5 * tw_rows[:, 0] / V_REF)
ldt = np.log(tw_rows[:, 2] / 2500.0)
At = np.column_stack([xt, xt * ldt])
ct, *_ = np.linalg.lstsq(At, np.log(tw_rows[:, 1]), rcond=None)
m_tw0, m_tw1 = ct
rms3t = float(np.sqrt(np.mean((np.exp(At @ ct) / tw_rows[:, 1] - 1) ** 2)) * 100)
print(f"panel 3 tailwind (n={len(tw_rows)}, {len(tracks3t)} guides): "
      f"r = (1 + 1.5*Vw/{V_REF:.0f})^({m_tw0:.2f} {m_tw1:+.2f}*ln(D/2500)), rms {rms3t:.2f}%")
for d0, vwe, de in tw_report:
    print(f"  guide D0={d0:6.0f} -> D({vwe:.1f}kt tail)={de:6.0f}  ratio {de / d0:.3f}")


def f_wind(vw_kt, d_in):
    """vw_kt > 0 headwind, < 0 tailwind; d_in = distance entering the panel."""
    ld = np.log(d_in / 2500.0)
    if vw_kt >= 0:
        return (1 - 0.5 * vw_kt / V_REF) ** (m_hw0 + m_hw1 * ld)
    return (1 + 1.5 * (-vw_kt) / V_REF) ** (m_tw0 + m_tw1 * ld)


qa.overlay(img, [thin(t, 2) for t in tracks3h] + [thin(t, 2) for t in tracks3t],
           vlines=[X_REF_WIND, X_WIND_15], hlines=[], path="fig_5_09_p3.png")

# ------------------------------------------------------------- speed strips
grid = calibrate.line_mask(ink, "h") | calibrate.line_mask(ink, "v")
grid = cv2.dilate(grid.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
txt = ink & ~grid


def strip_numerals(y0, y1, values):
    band = np.zeros_like(txt)
    band[y0:y1, 1050:1790] = txt[y0:y1, 1050:1790]
    n, lab, stats, cent = cv2.connectedComponentsWithStats(band.astype(np.uint8), connectivity=8)
    comps = sorted((cent[i][0], stats[i][4], stats[i][3]) for i in range(1, n)
                   if stats[i][4] > 100 and stats[i][3] > 12)  # digit-sized
    groups = []
    for cx, area, h in comps:
        if groups and cx - groups[-1][-1] < 25:
            groups[-1].append(cx)
        else:
            groups.append([cx])
    assert len(groups) == len(values), f"strip: {len(groups)} numerals vs {len(values)} expected"
    return [(float(np.mean(g)), v) for g, v in zip(groups, values)]


bar_strip = strip_numerals(520, 575, [57, 53, 50, 47, 44])
lof_strip = strip_numerals(580, 635, [52, 48, 46, 43, 40])
print("\nbarrier strip (x_px, KIAS, implied W):")
for x, v in bar_strip:
    print(f"  {x:7.1f}  {v}  W={ax_w.value(x):6.0f}")
print("lift-off strip:")
for x, v in lof_strip:
    print(f"  {x:7.1f}  {v}  W={ax_w.value(x):6.0f}")

# linear V(W) fits (sqrt(W) does NOT fit these strips - see report)
def fit_strip(strip):
    W = np.array([ax_w.value(x) for x, _ in strip])
    V = np.array([v for _, v in strip], float)
    sl, ic = np.polyfit(W, V, 1)
    res = sl * W + ic - V
    # power-law comparison
    p = np.polyfit(np.log(W / 2440.0), np.log(V), 1)[0]
    vp = V[0] * (W / W[0]) ** 0.5
    return sl, ic, float(np.abs(res).max()), float(p), float(np.abs(vp - V).max())


sl_b, ic_b, e_b, p_b, es_b = fit_strip(bar_strip)
sl_l, ic_l, e_l, p_l, es_l = fit_strip(lof_strip)
print(f"barrier: V = {ic_b:.2f} + {sl_b:.5f}*W  (max err {e_b:.2f} kt); power-law p={p_b:.2f}; sqrt(W) max err {es_b:.2f} kt")
print(f"liftoff: V = {ic_l:.2f} + {sl_l:.5f}*W  (max err {e_l:.2f} kt); power-law p={p_l:.2f}; sqrt(W) max err {es_l:.2f} kt")

# --------------------------------------------------- worked example validation
# printed: PA 1500 ft, 27 C, 2316 lb, 15 kt headwind -> 2100 ft; LOF 50, barrier 55
s0 = S0(1500, 27)
sw = s0 * f_weight(2316, s0)
sfin = sw * f_wind(15, sw)


def interp_guides(tracks_px, x_at, d_in, x_ref):
    """Chart-faithful step: interpolate between digitized guide curves.
    Enter at distance d_in on the ref line x_ref, read result at x_at."""
    pairs = []
    for t in tracks_px:
        pts = thin(t, 2)
        if not (pts[:, 0].min() <= x_at <= pts[:, 0].max() + 4):
            continue
        d_ref = ax_dist.value(np.interp(x_ref, pts[:, 0], pts[:, 1]))
        d_out = ax_dist.value(np.interp(x_at, pts[:, 0], pts[:, 1]))
        pairs.append((d_ref, d_out))
    pairs.sort()
    dr = [p[0] for p in pairs]
    do = [p[1] for p in pairs]
    return float(np.exp(np.interp(np.log(d_in), np.log(dr), np.log(do))))


# chart-faithful chain: interpolate the digitized guide families directly
s0_c = float(np.interp(1500, [1000, 2000],
                       [np.polyval(np.polyfit([ax_oat.value(x) for x, y in fam1_fit[6][1]],
                                              [ax_dist.value(y) for x, y in fam1_fit[6][1]], 1), 27),
                        np.polyval(np.polyfit([ax_oat.value(x) for x, y in fam1_fit[5][1]],
                                              [ax_dist.value(y) for x, y in fam1_fit[5][1]], 1), 27)]))
sw_c = interp_guides(tracks2, ax_w.px(2316), s0_c, X_REF_W)
sfin_c = interp_guides(tracks3h, X_WIND_15, sw_c, X_REF_WIND)
v_lof = ic_l + sl_l * 2316
v_bar = ic_b + sl_b * 2316
err = (sfin / 2100 - 1) * 100
# the chart's own dashed trace intermediates
y_dash_p1 = dashed_row(1000, 1100, 850, 940)
d_dash_p1 = ax_dist.value(y_dash_p1)
d_dash_w = ax_dist.value(y_dash_w)
print("\nworked example: PA1500/27C/2316lb/15kt HW")
print(f"  S0 = {s0:.0f} ft   (chart dashed trace: {d_dash_p1:.0f})")
print(f"  x weight -> {sw:.0f} ft (chart dashed trace: {d_dash_w:.0f})")
print(f"  x wind   -> {sfin:.0f} ft vs printed 2100 ({err:+.1f}%)")
err_c = (sfin_c / 2100 - 1) * 100
print(f"  chart-faithful chain (direct guide interpolation): {s0_c:.0f} -> {sw_c:.0f} -> {sfin_c:.0f} ({err_c:+.1f}%)")
print(f"  V_LOF = {v_lof:.1f} KIAS (printed 50), V_barrier = {v_bar:.1f} KIAS (printed 55)")

# --------------------------------------------------------------------- emit
digitized = []
for pa, pts in fam1_fit:
    digitized.append({"label": f"PA {pa} ft", "points": [[round(ax_oat.value(x), 1), round(ax_dist.value(y))] for x, y in thin(pts, 8)]})
for t in tracks2:
    pts = thin(t, 8)
    d0 = ax_dist.value(np.interp(X_REF_W, pts[:, 0], pts[:, 1]))
    digitized.append({"label": f"weight guide Dref={d0:.0f}", "points": [[round(ax_w.value(x)), round(ax_dist.value(y))] for x, y in pts]})
for t in tracks3h:
    pts = thin(t, 6)
    d0 = ax_dist.value(np.interp(X_REF_WIND, pts[:, 0], pts[:, 1]))
    digitized.append({"label": f"headwind guide D0={d0:.0f}", "points": [[round(ax_wind.value(x), 2), round(ax_dist.value(y))] for x, y in pts]})
for t in tracks3t:
    pts = thin(t, 4)
    d0 = ax_dist.value(np.interp(X_REF_WIND, pts[:, 0], pts[:, 1]))
    digitized.append({"label": f"tailwind guide D0={d0:.0f}", "points": [[round(ax_wind.value(x), 2), round(ax_dist.value(y))] for x, y in pts]})

result = {
    "figure": "5-9",
    "pdfPage": 94,
    "title": "0 deg flaps takeoff performance - total distance over 50 ft barrier",
    "deskewDeg": round(deskew, 2),
    "calibration": {
        "distanceFt": {"px0": round(ax_dist.px(0), 1), "v0": 0, "pxPerUnit": round(ax_dist.px_per_unit, 5)},
        "oatC": {"px0": round(ax_oat.px(0), 1), "v0": 0, "pxPerUnit": round(ax_oat.px_per_unit, 4)},
        "weightLb": {"px0": round(ax_w.px(2440), 1), "v0": 2440, "pxPerUnit": round(ax_w.px_per_unit, 5)},
        "windKt": {"px0": round(ax_wind.px(0), 1), "v0": 0, "pxPerUnit": round(ax_wind.px_per_unit, 4)},
    },
    "model": {
        "form": ("S50_ft = S0 * fW * fwind;  "
                 "S0 = (e0 + e1*PA + e2*PA^2) + (f0 + f1*PA)*OAT  [PA ft, OAT C];  "
                 "fW = exp((kwA + kwC*ln(S0/2500))*u + kwB*u^2 + kwD*u^3), u = ln(W/2440);  "
                 "headwind fwind = (1 - 0.5*Vw/57)^(mHw0 + mHw1*ln(Din/2500));  "
                 "tailwind fwind = (1 + 1.5*Vw/57)^(mTw0 + mTw1*ln(Din/2500));  "
                 "V_LOF_KIAS = lofIc + lofSl*W;  V_50ft_KIAS = barIc + barSl*W"),
        "params": {
            "e0": round(e0, 1), "e1": round(e1, 5), "e2": round(e2, 9),
            "f0": round(f0, 3), "f1": round(f1, 7),
            "kwA": round(kw_a, 3), "kwB": round(kw_b, 3), "kwC": round(kw_c, 3), "kwD": round(kw_d, 3),
            "mHw0": round(m_hw0, 3), "mHw1": round(m_hw1, 3),
            "mTw0": round(m_tw0, 3), "mTw1": round(m_tw1, 3), "vRefKt": V_REF,
            "lofIc": round(ic_l, 2), "lofSl": round(sl_l, 5),
            "barIc": round(ic_b, 2), "barSl": round(sl_b, 5),
        },
        "rmsPct": {"panel1": round(rms1, 2), "panel2": round(rms2, 2),
                   "panel3headwind": round(rms3h, 2), "panel3tailwind": round(rms3t, 2)},
    },
    "curves": digitized,
    "workedExample": {
        "inputs": {"paFt": 1500, "oatC": 27, "weightLb": 2316, "headwindKt": 15},
        "printed": {"distanceOver50ftFt": 2100, "liftOffKIAS": 50, "barrierKIAS": 55},
        "model": {"S0": round(s0), "afterWeight": round(sw), "final": round(sfin),
                  "liftOffKIAS": round(v_lof, 1), "barrierKIAS": round(v_bar, 1)},
        "chartDashedTrace": {"S0": round(d_dash_p1), "afterWeight": round(d_dash_w)},
        "chartFaithfulChain": {"S0": round(s0_c), "afterWeight": round(sw_c), "final": round(sfin_c),
                               "errPct": round(err_c, 1)},
        "errPct": round(err, 1),
    },
    "envelope": {
        "paFt": [0, 7000], "oatC": [-40, 40], "weightLb": [1700, 2440],
        "headwindKt": [0, 15], "tailwindKt": [0, 5],
        "distanceFt": [500, 4700],
        "notes": "PA curves truncated bottom-left below ~1500 ft distance; SL curve only drawn OAT >= ~-6 C; "
                 "weight guides and speed strips extend past the 1700-lb gridline to ~1600 lb at the no-wind ref line",
    },
    "notes": [
        "8 PA guide curves 0..7000 ft in 1000-ft steps; only 6000/4000/2000/SL labeled. Top (7000) curve identity "
        "confirmed by STD TEMP (ISA) line crossings: each curve crosses STD TEMP within ~1.5 C of its ISA temperature.",
        "Weight correction is NOT a constant power law: local exponent d(lnD)/d(lnW) drifts from ~1.9 near 2440 lb "
        "to ~2.6 at 1700 lb; quadratic-in-ln(W) form used. (5-11 ground roll had constant 1.85.)",
        "8 headwind guide curves originate at round 500..4000 ft distances on the no-wind ref line. 15-kt ratios "
        "0.79..0.83 with a real trend (stronger relative wind effect at shorter distances) -> distance-dependent "
        "exponent. The bottom (500-ft) guide is an extreme outlier (ratio 0.60, implied V_ref ~25 kt) and is "
        "excluded from the fit; its digitized points are kept in curves[].",
        "The dashed worked-example curve in the wind panel runs just above the 2500-ft headwind guide and converges "
        "with it at 15 kt; it is erased from the extraction mask before tracking (else the guide reads ~0.846).",
        "Tailwind guides (5 tracked, origins ~1500..3500 ft) rise steeply over 0..5 kt; bottom guide again "
        "stronger (+31% per 5 kt vs +21% for the others).",
        "Worked example: the printed chain (2803 -> 2553 -> 2100 per its own dashed trace) sits ~+1..+2.5% above "
        "the digitized guide midlines at each step; the smooth model therefore lands -3.4% vs the printed 2100 "
        "while direct interpolation of the digitized curves lands -1.1%.",
        "Speed strips are LINEAR in weight (max err ~0.3-0.5 kt), not V ~ sqrt(W): the 5-numeral anchors imply "
        "power-law exponent ~0.61-0.64. Strips span the 2440-lb ref line to the no-wind ref line (~1600 lb).",
        "Distance-axis labels (500..4000) are printed 25-40 px below their gridlines; calibrated from gridlines.",
    ],
}
(OUT / "fits").mkdir(parents=True, exist_ok=True)
with open(OUT / "fits" / "fig_5_09.json", "w") as fh:
    json.dump(result, fh, indent=1)
print("\nwrote out/fits/fig_5_09.json")
