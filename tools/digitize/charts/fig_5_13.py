"""Fig 5-13 (PDF p.96): 25-deg flaps takeoff performance — total distance over a
50 ft barrier. Same 3-panel nomograph family as Fig 5-11 (ground roll).

Pipeline: calibrate axes from thick majors -> trace panel-1 PA fan (8 curves,
SL..7000 ft by 1000) -> fit S0(PA, OAT) plane -> panel-2 weight guides -> weight
exponent k -> panel-3 wind guides -> wind credit exponents -> speed strips ->
validate against the printed worked example -> emit JSON + QA overlays.

Run:  uv run python charts/fig_5_13.py
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"
PAGE = 96

# ---------------------------------------------------------------- calibration
img, deskew = raster.prepared_page(PAGE)
ink = raster.binarize(img)
print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=600)
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=400)


def nearest(lines, pos, tol=5.0):
    ln = min(lines, key=lambda l: abs(l.pos - pos))
    assert abs(ln.pos - pos) <= tol, f"no gridline near {pos} (best {ln.pos:.1f})"
    return ln.pos


# Distance axis (right side, 500-ft majors, 0 at the bottom border).
dist_px = [nearest(h_lines, p) for p in (750.9, 901.1, 974.9, 1049.9, 1122.9, 1198.5, 1348.6)]
dist_v = [4000, 3000, 2500, 2000, 1500, 1000, 0]
ax_dist, rms_d = calibrate.fit_axis(dist_px, dist_v)
# OAT axis: thick majors at -40, 0, +40 C.
oat_px = [nearest(v_lines, p) for p in (651.2, 953.2, 1255.0)]
ax_oat, rms_o = calibrate.fit_axis(oat_px, [-40, 0, 40])
# Weight axis: ref line 2440 + 100-lb majors 2400..1700.
w_ref_px = nearest(v_lines, 1299.8)
w_px = [nearest(v_lines, p) for p in (1329.9, 1406.3, 1481.2, 1555.1, 1706.3, 1855.6)]
w_v = [2400, 2300, 2200, 2100, 1900, 1700]
ax_w, rms_w = calibrate.fit_axis([w_ref_px] + w_px, [2440] + w_v)
# Wind axis: no-wind ref + 5-kt majors to the 15-kt border.
wind_px = [nearest(v_lines, p) for p in (1932.0, 2007.2, 2083.4, 2159.7)]
ax_wind, rms_wd = calibrate.fit_axis(wind_px, [0, 5, 10, 15])
print(f"axis rms px: dist {rms_d:.2f}, oat {rms_o:.2f}, weight {rms_w:.2f}, wind {rms_wd:.2f}")
print(f"dist: 0 ft at y={ax_dist.px(0):.1f}, {-500*ax_dist.px_per_unit:.2f} px/500ft")
print(f"oat: 0C at x={ax_oat.px(0):.1f}, {ax_oat.px_per_unit:.3f} px/C")
print(f"weight: 2440 at x={ax_w.px(2440):.1f}, {-ax_w.px_per_unit:.4f} px/lb (decreasing right)")
print(f"wind: 0 kt at x={ax_wind.px(0):.1f}, {ax_wind.px_per_unit:.2f} px/kt")

X_P1_LO, X_P1_HI = 645, 1258  # panel 1 (OAT)
X_P2_LO, X_P2_HI = int(round(ax_w.px(2440))), int(round(ax_wind.px(0)))  # weight panel
X_P3_LO, X_P3_HI = X_P2_HI, int(round(ax_wind.px(15)))  # wind panel
Y_TOP, Y_BOT = 745, 1352  # 4000-ft line .. below baseline


# ------------------------------------------------------------- curve tracing
def col_bands(mask, x):
    ys = np.flatnonzero(mask[:, x])
    bands = []
    if ys.size:
        s = p = ys[0]
        for y in ys[1:]:
            if y - p > 3:
                bands.append(((s + p) / 2, p - s))
                s = y
            p = y
        bands.append(((s + p) / 2, p - s))
    return bands


def trace(mask, x_hi, x_lo, max_band=18, match_tol=5.0, max_gap=40, min_pts=120, min_span=150):
    """Track parallel curves right-to-left by column-band linking."""
    tracks = []
    for x in range(x_hi, x_lo, -1):
        for yc, w in col_bands(mask, x):
            if w > max_band:
                continue
            best = None
            for t in tracks:
                gap = t["xs"][-1] - x
                if gap > max_gap:
                    continue
                if len(t["xs"]) >= 10:
                    c = np.polyfit(t["xs"][-40:], t["ys"][-40:], 1)
                    yp = np.polyval(c, x)
                else:
                    yp = t["ys"][-1]
                d = abs(yp - yc)
                if d < match_tol and (best is None or d < best[0]):
                    best = (d, t)
            if best:
                best[1]["xs"].append(x)
                best[1]["ys"].append(yc)
            else:
                tracks.append({"xs": [x], "ys": [yc]})
    keep = []
    for t in tracks:
        xs = np.array(t["xs"], float)[::-1]
        ys = np.array(t["ys"], float)[::-1]
        if len(xs) >= min_pts and xs.max() - xs.min() >= min_span:
            keep.append(np.column_stack([xs, ys]))
    return keep


def y_at(tr, x):
    return float(np.interp(x, tr[:, 0], tr[:, 1]))


# ------------------------------------------------- panel 1: PA fan -> S0 plane
panel1 = np.zeros_like(ink)
panel1[Y_TOP:Y_BOT, X_P1_LO:X_P1_HI] = ink[Y_TOP:Y_BOT, X_P1_LO:X_P1_HI]
m1 = curves.curve_mask(panel1, angles_deg=list(np.arange(8, 36, 2)), length=31)
m1 = cv2.dilate(m1.astype(np.uint8), np.ones((5, 7), np.uint8)).astype(bool)
p1_tracks = trace(m1, X_P1_HI - 2, X_P1_LO + 2)


def merge_collinear(tracks, max_gap=140, tol=5.0):
    """Merge track fragments that are continuations of the same curve."""
    tracks = [t.copy() for t in tracks]
    changed = True
    while changed:
        changed = False
        for i in range(len(tracks)):
            for j in range(len(tracks)):
                if i == j:
                    continue
                a, c = tracks[i], tracks[j]  # a left of c?
                gap = c[0, 0] - a[-1, 0]
                if not (-20 <= gap <= max_gap):
                    continue
                ca = np.polyfit(a[-80:, 0], a[-80:, 1], 1)
                cc = np.polyfit(c[:80, 0], c[:80, 1], 1)
                xm = (a[-1, 0] + c[0, 0]) / 2
                if abs(np.polyval(ca, xm) - np.polyval(cc, xm)) <= tol and abs(ca[0] - cc[0]) < 0.25:
                    merged = np.vstack([a, c])
                    merged = merged[np.argsort(merged[:, 0])]
                    tracks = [t for k, t in enumerate(tracks) if k not in (i, j)] + [merged]
                    changed = True
                    break
            if changed:
                break
    return tracks


p1_tracks = merge_collinear(p1_tracks)
for tr in sorted(p1_tracks, key=lambda t: t[0, 1]):
    print(f"  raw track x {tr[0,0]:4.0f}..{tr[-1,0]:4.0f}  yL={tr[0,1]:6.1f} yR={tr[-1,1]:6.1f} n={len(tr)}")
# order top->bottom at x=918, inside every track's span (7000 ends ~922, SL starts ~915);
# evaluate via a quadratic fit over each track's data nearest that column
def key_918(tr):
    xs, ys = tr[:, 0], tr[:, 1]
    sel = np.argsort(np.abs(xs - 918))[:160]
    co = np.polyfit(xs[sel], ys[sel], 2)
    return float(np.polyval(co, 918))


p1_tracks.sort(key=key_918)
print(f"\npanel 1: {len(p1_tracks)} fan curves (expect 8: SL..7000 by 1000)")
assert len(p1_tracks) == 8, "unexpected PA curve count"
PA_OF_TRACK = [7000, 6000, 5000, 4000, 3000, 2000, 1000, 0]

pa_pts = []  # (PA, OAT, dist_ft)
curves_json = []
for pa, tr in zip(PA_OF_TRACK, p1_tracks):
    xs = np.arange(tr[0, 0], tr[-1, 0], 4.0)
    ys = np.interp(xs, tr[:, 0], tr[:, 1])
    o, d = ax_oat.value(xs), np.array([ax_dist.value(y) for y in ys])
    ok = d <= 4020  # clip fragments above the chart top
    for oo, dd in zip(o[ok], d[ok]):
        pa_pts.append((pa, oo, dd))
    curves_json.append(
        {"label": f"PA {pa} ft" if pa else "sea level", "points": [[round(float(a), 2), round(float(b), 1)] for a, b in zip(o[ok], d[ok])]}
    )
    samp = " ".join(
        f"{t:+3.0f}C:{np.interp(t, o, d):4.0f}" if o.min() - 0.5 <= t <= o.max() + 0.5 else f"{t:+3.0f}C: -  "
        for t in (-30, -15, 0, 15, 30, 40)
    )
    print(f"  PA {pa:4d}: OAT {o.min():+.0f}..{o.max():+.0f} C | {samp}")

PAv = np.array([p for p, _, _ in pa_pts])
OATv = np.array([o for _, o, _ in pa_pts])
b = np.array([dd for _, _, dd in pa_pts])
# reference plane (5-11's form) for comparison
Ap = np.column_stack([np.ones_like(PAv), PAv, OATv])
cp, *_ = np.linalg.lstsq(Ap, b, rcond=None)
rms_plane = float(np.sqrt(np.mean(((Ap @ cp - b) / b) ** 2)) * 100)
print(f"S0 plane (5-11 form): {cp[0]:.0f} + {cp[1]:.4f}*PA + {cp[2]:.2f}*OAT   rms {rms_plane:.2f}%")
# full quadratic surface — needed here: fan spacing grows with PA (unlike 5-11)
Aq = np.column_stack([np.ones_like(PAv), PAv, OATv, PAv * OATv, PAv**2, OATv**2])
cq, *_ = np.linalg.lstsq(Aq, b, rcond=None)
rms_quad = float(np.sqrt(np.mean(((Aq @ cq - b) / b) ** 2)) * 100)
print(
    f"S0 quadratic: {cq[0]:.0f} + {cq[1]:.4f}*PA + {cq[2]:.2f}*OAT + {cq[3]:.6f}*PA*OAT"
    f" + {cq[4]:.3e}*PA^2 + {cq[5]:.4f}*OAT^2   rms {rms_quad:.2f}%"
)
per = {}
for (pa, oo, dd), pr in zip(pa_pts, Aq @ cq):
    per.setdefault(pa, []).append((pr - dd) / dd * 100)
for pa in sorted(per):
    r = np.array(per[pa])
    print(f"  PA {pa:4d}: mean {r.mean():+.2f}% rms {np.sqrt((r**2).mean()):.2f}%")


def S0(pa, oat):
    return float(cq[0] + cq[1] * pa + cq[2] * oat + cq[3] * pa * oat + cq[4] * pa**2 + cq[5] * oat**2)


# ------------------------------------------- panel 2: weight guides -> exponent
panel2 = np.zeros_like(ink)
panel2[Y_TOP:Y_BOT, X_P2_LO + 3 : X_P2_HI - 2] = ink[Y_TOP:Y_BOT, X_P2_LO + 3 : X_P2_HI - 2]
m2 = curves.curve_mask(panel2, angles_deg=list(np.arange(-34, -3, 2)), length=31)
m2 = cv2.dilate(m2.astype(np.uint8), np.ones((5, 7), np.uint8)).astype(bool)
p2_tracks = merge_collinear(trace(m2, X_P2_HI - 4, X_P2_LO + 4, min_pts=60, min_span=120), max_gap=200)
p2_tracks.sort(key=lambda tr: y_at(tr, np.clip(1450, tr[0, 0], tr[-1, 0])))
print(f"\npanel 2: {len(p2_tracks)} weight guide lines")
k_vals = []
for tr in p2_tracks:
    if tr[0, 0] > X_P2_LO + 60:
        continue  # must (nearly) anchor at the 2440 ref line
    if abs(tr[-1, 1] - tr[0, 1]) < 0.08 * (tr[-1, 0] - tr[0, 0]):
        continue  # near-horizontal artifact (dashed carry-over)
    if tr[0, 0] > X_P2_LO + 8:
        # extrapolate the first stretch back to the ref line
        c0 = np.polyfit(tr[:60, 0], tr[:60, 1], 1)
        s_ref = ax_dist.value(np.polyval(c0, ax_w.px(2440)))
        w0 = 2440.0
    else:
        s_ref = ax_dist.value(y_at(tr, tr[0, 0]))
        w0 = ax_w.value(tr[0, 0])
    ks = []
    for w in np.arange(2350, 1690, -50):
        x = ax_w.px(w)
        if x > tr[-1, 0] or x < tr[0, 0]:
            continue
        s = ax_dist.value(y_at(tr, x))
        ks.append(np.log(s / s_ref) / np.log(w / w0))
    if len(ks) >= 4:
        k_vals.append(float(np.mean(ks)))
        print(f"  guide S_ref={s_ref:5.0f} ft (W0={w0:.0f}): k = {np.mean(ks):.2f} (spread {np.min(ks):.2f}..{np.max(ks):.2f})")
K_W = float(np.mean(k_vals))
print(f"weight exponent k = {K_W:.2f} (n={len(k_vals)}, sd {np.std(k_vals):.2f})")

# ----------------------------------------------- panel 3: wind guides -> credit
panel3 = np.zeros_like(ink)
panel3[Y_TOP:Y_BOT, X_P3_LO + 3 : X_P3_HI - 2] = ink[Y_TOP:Y_BOT, X_P3_LO + 3 : X_P3_HI - 2]
m3h = curves.curve_mask(panel3, angles_deg=list(np.arange(-40, -6, 2)), length=25)
m3h = cv2.dilate(m3h.astype(np.uint8), np.ones((5, 7), np.uint8)).astype(bool)
hw_tracks = merge_collinear(trace(m3h, X_P3_HI - 4, X_P3_LO + 4, min_pts=50, min_span=80), max_gap=120)
hw_tracks.sort(key=lambda tr: y_at(tr, np.clip(2000, tr[0, 0], tr[-1, 0])))
print(f"\npanel 3: {len(hw_tracks)} headwind guides")
V_REF = 52.0  # KIAS V_LOF at 2440 lb, sigma=1 (same convention as Fig 5-11)
m_vals, hw_slopes = [], []
for tr in hw_tracks:
    if tr[0, 0] > X_P3_LO + 15:
        continue  # must anchor at the no-wind ref line
    if abs(tr[-1, 1] - tr[0, 1]) < 0.08 * (tr[-1, 0] - tr[0, 0]):
        continue  # near-horizontal artifact (dashed carry-over)
    s0w = ax_dist.value(y_at(tr, X_P3_LO + 5))
    vws, ratios = [], []
    for vw in np.arange(2, 15.1, 1.0):
        x = ax_wind.px(vw)
        if x > tr[-1, 0]:
            continue
        vws.append(vw)
        ratios.append(ax_dist.value(y_at(tr, x)) / s0w)
    if len(vws) < 5:
        continue
    vws, ratios = np.array(vws), np.array(ratios)
    m = np.polyfit(np.log(1 - 0.5 * vws / V_REF), np.log(ratios), 1)[0]
    slope_pct = float(np.polyfit(vws, ratios, 1)[0] * 100)
    m_vals.append(float(m))
    hw_slopes.append(slope_pct)
    print(f"  guide S(0)={s0w:5.0f} ft: m={m:.2f}, {slope_pct:+.2f}%/kt, r(15)={ratios[-1]:.3f}")
M_HW = float(np.mean(m_vals))
print(f"headwind exponent m = {M_HW:.2f} (sd {np.std(m_vals):.2f}), mean slope {np.mean(hw_slopes):+.2f}%/kt")

# tailwind guides (up-right, 0..5 kt)
m3t = curves.curve_mask(panel3, angles_deg=list(np.arange(20, 62, 3)), length=21)
m3t = cv2.dilate(m3t.astype(np.uint8), np.ones((7, 5), np.uint8)).astype(bool)
tw_tracks = trace(m3t, int(ax_wind.px(5.5)), X_P3_LO + 4, max_band=25, min_pts=30, min_span=45)
tw_tracks.sort(key=lambda tr: y_at(tr, np.clip(1960, tr[0, 0], tr[-1, 0])))
print(f"panel 3: {len(tw_tracks)} tailwind guide candidates")
mt_vals, tw_slopes = [], []
for tr in tw_tracks:
    if tr[0, 0] > X_P3_LO + 15:
        continue
    s0w = ax_dist.value(y_at(tr, X_P3_LO + 5))
    vws = np.arange(1, min(5.0, ax_wind.value(tr[-1, 0])) + 0.01, 0.5)
    ratios = np.array([ax_dist.value(y_at(tr, ax_wind.px(v))) / s0w for v in vws])
    if len(vws) < 4 or ratios[-1] < 1.02:
        continue
    mt = np.polyfit(np.log(1 + 1.5 * vws / V_REF), np.log(ratios), 1)[0]
    mt_vals.append(float(mt))
    tw_slopes.append(float(np.polyfit(vws, ratios, 1)[0] * 100))
    print(f"  guide S(0)={s0w:5.0f} ft: m={mt:.2f}, {tw_slopes[-1]:+.2f}%/kt, r(5)={ratios[-1]:.3f}")
M_TW = float(np.mean(mt_vals)) if mt_vals else float("nan")
print(f"tailwind exponent m = {M_TW:.2f}, mean slope {np.mean(tw_slopes) if tw_slopes else float('nan'):+.2f}%/kt")


# ------------------------------------------------------------- speed strips
def strip_labels(y0, y1):
    """Centroids of digit clusters in a strip band -> (x_px, text ignored)."""
    band = ink[y0:y1, 1240:1975].astype(np.uint8)
    band = cv2.morphologyEx(band, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    # erase gridlines: keep only dense text blobs
    n, lab, stats, cents = cv2.connectedComponentsWithStats(band, connectivity=8)
    xs = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area > 60 and 8 <= h <= 30 and w <= 60:
            xs.append(cents[i][0] + 1240)
    xs.sort()
    # merge digit pairs into labels
    merged = []
    for x in xs:
        if merged and x - merged[-1][-1] < 30:
            merged[-1].append(x)
        else:
            merged.append([x])
    return [float(np.mean(g)) for g in merged]


bar_x = strip_labels(628, 668)
lof_x = strip_labels(690, 730)
print("\nbarrier strip label x:", [f"{x:.0f}" for x in bar_x])
print("liftoff strip label x:", [f"{x:.0f}" for x in lof_x])
print("as weights:", [f"{ax_w.value(x):.0f}" for x in bar_x])
BAR_V = [57, 53, 50, 47, 44]
LOF_V = [52, 48, 46, 43, 40]
w_marks = [2440, 2200, 2000, 1800, 1600]
# strips are LINEAR in W here (5-11's were V ∝ sqrt(W)) — verify both readings
for name, vals in (("liftoff", LOF_V), (" barrier", BAR_V)):
    sl, ic = np.polyfit(w_marks, vals, 1)
    lin = np.round(np.polyval([sl, ic], w_marks))
    a_sq = np.mean(np.array(vals) / np.sqrt(np.array(w_marks) / 2440.0))
    sq = np.round(a_sq * np.sqrt(np.array(w_marks) / 2440.0))
    print(
        f"{name}: linear V = {vals[0]} - {sl*100:.2f}*(2440-W)/100 -> {lin.astype(int).tolist()}"
        f" | sqrt-W ({a_sq:.1f}*sqrt(W/2440)) -> {sq.astype(int).tolist()} vs printed {vals}"
    )

# ------------------------------------------- dashed worked-example trace check
short_h = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 9), np.uint8))
long_h = cv2.dilate(calibrate.line_mask(ink, "h", 80), np.ones((5, 1), np.uint8))
dash = short_h & ~long_h


def dashed_height(x0, x1):
    prof = dash[900:1200, x0:x1].sum(axis=1).astype(float)
    ys = 900 + np.arange(300)
    pk = int(np.argmax(prof))
    thr = prof.max() * 0.4
    lo = pk
    while lo > 0 and prof[lo - 1] > thr:
        lo -= 1
    hi = pk
    while hi < 299 and prof[hi + 1] > thr:
        hi += 1
    yc = (ys[lo : hi + 1] * prof[lo : hi + 1]).sum() / prof[lo : hi + 1].sum()
    return float(ax_dist.value(yc))


dash_s0 = dashed_height(1170, 1295)
dash_after_w = dashed_height(1520, 1900)
print(f"\ndashed trace: S0 carry {dash_s0:.0f} ft, post-weight carry {dash_after_w:.0f} ft")
print(f"  implied weight exponent from trace: {np.log(dash_after_w / dash_s0) / np.log(2175 / 2440):.2f}")
print(f"  implied wind factor 1500/{dash_after_w:.0f} = {1500 / dash_after_w:.3f} -> m = {np.log(1500 / dash_after_w) / np.log(1 - 7.5 / 52):.2f}")

# ------------------------------------------------------- worked example chain
PA_EX, OAT_EX, W_EX, HW_EX = 1500, 27, 2175, 15
s0_ex = S0(PA_EX, OAT_EX)
s_w = s0_ex * (W_EX / 2440) ** K_W
f_wind = (1 - 0.5 * HW_EX / V_REF) ** M_HW
s_final = s_w * f_wind
err = (s_final - 1500) / 1500 * 100
print(f"\nworked example: S0={s0_ex:.0f} -> xW={s_w:.0f} -> xwind({f_wind:.3f})={s_final:.0f} ft (printed 1500, err {err:+.1f}%)")

# speeds at 2175 lb via linear-in-W strip interpolation (labels at 2440..1600 by ~200-lb steps)
v_lof_ex = float(np.interp(W_EX, w_marks[::-1], LOF_V[::-1]))
v_bar_ex = float(np.interp(W_EX, w_marks[::-1], BAR_V[::-1]))
print(f"speeds at {W_EX} lb: lift-off {v_lof_ex:.1f} (printed 48), barrier {v_bar_ex:.1f} (printed 53)")

# --------------------------------------------------------------- QA overlays
qa.overlay(
    img,
    [tr for tr in p1_tracks] + [tr for tr in p2_tracks] + [tr for tr in hw_tracks] + [tr for tr in tw_tracks],
    vlines=oat_px + [w_ref_px] + w_px + wind_px,
    hlines=dist_px,
    path="fig_5_13_curves.png",
)
# model-vs-chart check curves: predicted S0 lines over panel 1
model_lines = []
for pa in PA_OF_TRACK:
    oats = np.linspace(-40, 40, 30)
    xs = np.array([ax_oat.px(o) for o in oats])
    ys = np.array([ax_dist.px(S0(pa, o)) for o in oats])
    ok = (ys >= Y_TOP) & (ys <= 1349)
    model_lines.append(np.column_stack([xs[ok], ys[ok]]))
qa.overlay(img, model_lines, vlines=[], hlines=[], path="fig_5_13_model_panel1.png")

# ---------------------------------------------------------------------- JSON
result = {
    "figure": "5-13",
    "pdfPage": PAGE,
    "title": "25 deg flaps takeoff performance - total distance over 50 ft barrier",
    "calibration": {
        "distanceFt": {"px0": ax_dist.px0, "v0": ax_dist.v0, "pxPerUnit": ax_dist.px_per_unit},
        "oatC": {"px0": ax_oat.px0, "v0": ax_oat.v0, "pxPerUnit": ax_oat.px_per_unit},
        "weightLb": {"px0": ax_w.px0, "v0": ax_w.v0, "pxPerUnit": ax_w.px_per_unit},
        "windKt": {"px0": ax_wind.px0, "v0": ax_wind.v0, "pxPerUnit": ax_wind.px_per_unit},
    },
    "deskewDeg": round(deskew, 2),
    "model": {
        "form": "S50 = S0 * (W/2440)^k * f_wind; "
        "S0 = a + b*PA + c*OAT + d*PA*OAT + e*PA^2 + f*OAT^2 (PA ft, OAT C); "
        "headwind f = (1 - 0.5*Vw/V)^m_hw, tailwind f = (1 + 1.5*Vw/V)^m_tw, V = 52 kt (V_LOF at 2440 lb, IAS~TAS at SL)",
        "params": {
            "a": round(float(cq[0]), 1),
            "b": round(float(cq[1]), 4),
            "c": round(float(cq[2]), 2),
            "d": round(float(cq[3]), 6),
            "e": round(float(cq[4]), 9),
            "f": round(float(cq[5]), 4),
            "k": round(K_W, 2),
            "m_hw": round(M_HW, 2),
            "m_tw": round(M_TW, 2),
            "V_ref_kias": V_REF,
        },
        "rmsPct": round(rms_quad, 2),
        "planeAlternative": {
            "form": "S0 = a + b*PA + c*OAT (5-11's form, for cross-chart comparison)",
            "a": round(float(cp[0]), 1),
            "b": round(float(cp[1]), 4),
            "c": round(float(cp[2]), 2),
            "rmsPct": round(rms_plane, 2),
        },
    },
    "dashedTrace": {
        "S0Carry": round(dash_s0, 0),
        "postWeightCarry": round(dash_after_w, 0),
        "impliedWeightExp": round(float(np.log(dash_after_w / dash_s0) / np.log(2175 / 2440)), 2),
        "impliedWindExp": round(float(np.log(1500 / dash_after_w) / np.log(1 - 7.5 / 52)), 2),
    },
    "speeds": {
        "liftoffKias": {"weights": w_marks, "values": LOF_V, "form": "linear in W (NOT sqrt-W): 52 - 1.40*(2440-W)/100, reproduces all printed labels on rounding"},
        "barrierKias": {"weights": w_marks, "values": BAR_V, "form": "linear in W: 57 - 1.54*(2440-W)/100, reproduces all printed labels on rounding"},
        "labelXpx": {"barrier": [round(x, 1) for x in bar_x], "liftoff": [round(x, 1) for x in lof_x]},
    },
    "curves": curves_json,
    "workedExample": {
        "inputs": {"paFt": PA_EX, "oatC": OAT_EX, "weightLb": W_EX, "headwindKt": HW_EX},
        "printed": {"distanceOver50Ft": 1500, "liftoffKias": 48, "barrierKias": 53},
        "model": {
            "S0": round(s0_ex, 0),
            "afterWeight": round(s_w, 0),
            "windFactor": round(f_wind, 3),
            "final": round(s_final, 0),
            "liftoffKias": round(v_lof_ex, 1),
            "barrierKias": round(v_bar_ex, 1),
        },
        "errPct": round(err, 1),
    },
    "envelope": {
        "paFt": [0, 7000],
        "oatC": [-40, 40],
        "weightLb": [1700, 2440],
        "headwindKt": [0, 15],
        "tailwindKt": [0, 5],
        "notes": "curves truncated where distance >4000 ft (top) and bottom-left; "
        "SL curve drawn only OAT >= ~-5 C; 7000 curve only OAT <= ~-4 C",
    },
    "notes": [
        "S0 is NOT a plane in (PA, OAT) here (unlike Fig 5-11): fan spacing grows with PA; "
        "full quadratic needed for ~1% rms (plane alone 3.8%)",
        "speed strips are linear in W, not V ∝ sqrt(W) as in 5-11; strip labels sit at "
        "W = 2440/2200/2000/1800/1600 equivalent positions (the last beyond the 1700-lb axis end, "
        "at the no-wind ref line)",
        "barrier speed ≈ 1.10 × lift-off speed at all weights",
        "dashed worked-example trace measured: S0 2345 ft, post-weight 1873 ft — model matches to <1%",
        "tailwind guides are short/cluttered; m_tw poorly constrained (2 usable guides: 1.08, 1.75)",
    ],
}
OUT_FITS.mkdir(parents=True, exist_ok=True)
(OUT_FITS / "fig_5_13.json").write_text(json.dumps(result, indent=2))
print("\nwrote out/fits/fig_5_13.json")
