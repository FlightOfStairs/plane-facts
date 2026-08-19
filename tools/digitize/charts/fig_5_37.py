"""Fig 5-37 (PDF p.108): Landing ground roll distance.
Power off, flaps 40 deg, paved level dry runway, maximum braking.

Same 3-panel nomograph family as Fig 5-35 (landing over 50 ft):
panel 1 PA guide fan (SL/2000/4000/6000/7000) vs OAT -> S0 at the weight
ref line (2440 lb, printed correctly on this chart); panel 2 weight guides;
panel 3 wind guides (0-15 kt headwind solid, 0-5 kt tailwind dashed).

Run:  uv run python charts/fig_5_37.py
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from digitize import calibrate, curves, qa, raster
from landing_common import merge_collinear, trace, y_at

OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"
PAGE = 108

# ---------------------------------------------------------------- calibration
img, deskew = raster.prepared_page(PAGE)
ink = raster.binarize(img)
print(f"page {PAGE}: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=600)
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=400)


def nearest(lines, pos, tol=6.0):
    ln = min(lines, key=lambda l: abs(l.pos - pos))
    assert abs(ln.pos - pos) <= tol, f"no gridline near {pos} (best {ln.pos:.1f})"
    return ln.pos


# Distance axis (100-ft majors, chart bottom border = 300 ft).
dist_px = [nearest(h_lines, p) for p in (572.1, 720.1, 869.0, 1019.2, 1167.9, 1316.3)]
dist_v = [800, 700, 600, 500, 400, 300]
ax_dist, rms_d = calibrate.fit_axis(dist_px, dist_v)
# OAT axis: thick majors at -40, 0, +40 C.
oat_px = [nearest(v_lines, p) for p in (663.9, 965.7, 1268.1)]
ax_oat, rms_o = calibrate.fit_axis(oat_px, [-40, 0, 40])
# Weight axis: 100-lb majors 2400..1700.
w_px = [nearest(v_lines, p) for p in (1343.3, 1419.6, 1493.9, 1568.8, 1645.0, 1719.9, 1794.9, 1869.7)]
w_v = [2400, 2300, 2200, 2100, 2000, 1900, 1800, 1700]
ax_w, rms_w = calibrate.fit_axis(w_px, w_v)
w_ref_px = nearest(v_lines, 1312.1)
W_REF_VALUE = ax_w.value(w_ref_px)
# Wind axis: no-wind ref + 5-kt majors to the 15-kt border.
wind_px = [nearest(v_lines, p) for p in (1946.3, 2021.8, 2098.5, 2174.0)]
ax_wind, rms_wd = calibrate.fit_axis(wind_px, [0, 5, 10, 15])
print(f"axis rms px: dist {rms_d:.2f}, oat {rms_o:.2f}, weight {rms_w:.2f}, wind {rms_wd:.2f}")
print(f"dist: 300 ft at y={ax_dist.px(300):.1f}, {-100*ax_dist.px_per_unit:.2f} px/100ft")
print(f"oat: 0C at x={ax_oat.px(0):.1f}, {ax_oat.px_per_unit:.3f} px/C")
print(f"weight: 2400 at x={ax_w.px(2400):.1f}, {-ax_w.px_per_unit:.4f} px/lb")
print(f"REF LINE at x={w_ref_px:.1f} -> {W_REF_VALUE:.0f} lb (label says 2440)")
print(f"wind: 0 kt at x={ax_wind.px(0):.1f}, {ax_wind.px_per_unit:.2f} px/kt")
W0 = 2440.0

X_P1_LO, X_P1_HI = 655, int(round(w_ref_px))   # panel 1 (OAT fan)
X_P2_LO, X_P2_HI = int(round(w_ref_px)), int(round(ax_wind.px(0)))
X_P3_LO, X_P3_HI = X_P2_HI, int(round(ax_wind.px(15)))
Y_TOP, Y_BOT = 460, 1320  # curves reach ~y=467 near the ref line .. bottom border


# ------------------------------------------------- panel 1: PA fan -> S0 model
panel1 = np.zeros_like(ink)
panel1[Y_TOP:Y_BOT, X_P1_LO:X_P1_HI - 4] = ink[Y_TOP:Y_BOT, X_P1_LO:X_P1_HI - 4]
m1 = curves.curve_mask(panel1, angles_deg=list(np.arange(8, 44, 2)), length=31)
m1 = cv2.dilate(m1.astype(np.uint8), np.ones((5, 7), np.uint8)).astype(bool)
p1_tracks = merge_collinear(
    trace(m1, X_P1_HI - 8, X_P1_LO + 2, min_pts=70, min_span=90), max_gap=220
)
for tr in sorted(p1_tracks, key=lambda t: t[0, 1]):
    print(f"  raw p1 track x {tr[0,0]:4.0f}..{tr[-1,0]:4.0f}  yL={tr[0,1]:6.1f} yR={tr[-1,1]:6.1f} n={len(tr)}")

def med_slope(tr):
    return float(np.polyfit(tr[:, 0], tr[:, 1], 1)[0])

p1_tracks = [tr for tr in p1_tracks if -0.9 < med_slope(tr) < -0.1 and tr[-1, 0] - tr[0, 0] > 250]

def key_col(tr, x=970):
    xs, ys = tr[:, 0], tr[:, 1]
    sel = np.argsort(np.abs(xs - x))[:160]
    co = np.polyfit(xs[sel], ys[sel], 2)
    return float(np.polyval(co, x))

p1_tracks.sort(key=key_col)
print(f"panel 1: {len(p1_tracks)} fan curves (expect 5: 7000/6000/4000/2000/SL top->bottom)")
assert len(p1_tracks) == 5, "unexpected PA curve count"
PA_OF_TRACK = [7000, 6000, 4000, 2000, 0]

pa_pts = []
curves_json = []
for pa, tr in zip(PA_OF_TRACK, p1_tracks):
    xs = np.arange(tr[0, 0], tr[-1, 0], 4.0)
    ys = np.interp(xs, tr[:, 0], tr[:, 1])
    o, d = ax_oat.value(xs), np.array([ax_dist.value(y) for y in ys])
    keep = (o >= -40.3) & (o <= 40.3)
    o, d = o[keep], d[keep]
    for oo, dd in zip(o, d):
        pa_pts.append((pa, oo, dd))
    curves_json.append({
        "label": f"PA {pa} ft" if pa else "sea level",
        "points": [[round(float(a), 2), round(float(b), 1)] for a, b in zip(o, d)],
    })
    samp = " ".join(
        f"{t:+3.0f}C:{np.interp(t, o, d):4.0f}" if o.min() - 0.5 <= t <= o.max() + 0.5 else f"{t:+3.0f}C: -  "
        for t in (-30, -15, 0, 15, 30, 40)
    )
    print(f"  PA {pa:4d}: OAT {o.min():+.0f}..{o.max():+.0f} C | {samp}")

PAv = np.array([p for p, _, _ in pa_pts])
OATv = np.array([o for _, o, _ in pa_pts])
b = np.array([dd for _, _, dd in pa_pts])
Ap = np.column_stack([np.ones_like(PAv), PAv, OATv])
cp, *_ = np.linalg.lstsq(Ap, b, rcond=None)
rms_plane = float(np.sqrt(np.mean(((Ap @ cp - b) / b) ** 2)) * 100)
print(f"S0 plane: {cp[0]:.0f} + {cp[1]:.4f}*PA + {cp[2]:.2f}*OAT   rms {rms_plane:.2f}%")
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
    print(f"  PA {pa:4d}: quad mean {r.mean():+.2f}% rms {np.sqrt((r**2).mean()):.2f}%")

def sigma(pa, oat):
    return (1 - 6.87559e-6 * pa) ** 5.2559 / ((oat + 273.15) / 288.15)

sig = np.array([sigma(p, o) for p, o, _ in pa_pts])
n_sig, lnA = np.polyfit(np.log(sig), np.log(b), 1)
pred = np.exp(lnA) * sig ** n_sig
rms_sig = float(np.sqrt(np.mean(((pred - b) / b) ** 2)) * 100)
print(f"sigma power law: S0 = {np.exp(lnA):.0f} * sigma^{n_sig:.2f}   rms {rms_sig:.2f}%")


def S0(pa, oat):
    return float(cq[0] + cq[1] * pa + cq[2] * oat + cq[3] * pa * oat + cq[4] * pa**2 + cq[5] * oat**2)


# ------------------------------------------- panel 2: weight guides -> exponent
panel2 = np.zeros_like(ink)
panel2[Y_TOP:Y_BOT, X_P2_LO + 3 : X_P2_HI - 2] = ink[Y_TOP:Y_BOT, X_P2_LO + 3 : X_P2_HI - 2]
m2 = curves.curve_mask(panel2, angles_deg=list(np.arange(-40, -4, 2)), length=31)
m2 = cv2.dilate(m2.astype(np.uint8), np.ones((5, 7), np.uint8)).astype(bool)
p2_tracks = merge_collinear(trace(m2, X_P2_HI - 4, X_P2_LO + 4, min_pts=60, min_span=120), max_gap=200)
p2_tracks.sort(key=lambda tr: y_at(tr, np.clip(1600, tr[0, 0], tr[-1, 0])))
print(f"\npanel 2: {len(p2_tracks)} weight guide candidates")
for tr in p2_tracks:
    print(f"    cand x {tr[0,0]:4.0f}..{tr[-1,0]:4.0f} y {tr[0,1]:6.1f}..{tr[-1,1]:6.1f} n={len(tr)} "
          f"slope {np.polyfit(tr[:,0],tr[:,1],1)[0]:+.2f}")
k_vals = []
for tr in p2_tracks:
    if tr[0, 0] > X_P2_LO + 200:
        continue  # anchor (or back-extrapolate) to the ref line
    if tr[0, 0] > X_P2_LO + 90 and tr[-1, 0] - tr[0, 0] < 250:
        continue  # far-from-ref fragments need a long span to extrapolate safely
    if abs(tr[-1, 1] - tr[0, 1]) < 0.06 * (tr[-1, 0] - tr[0, 0]):
        continue
    if tr[0, 0] > X_P2_LO + 8:
        c0 = np.polyfit(tr[:60, 0], tr[:60, 1], 1)
        s_ref = ax_dist.value(np.polyval(c0, w_ref_px))
    else:
        s_ref = ax_dist.value(y_at(tr, tr[0, 0]))
    ks = []
    for w in np.arange(2350, 1590, -50):
        x = ax_w.px(w)
        if x > tr[-1, 0] or x < tr[0, 0]:
            continue
        s = ax_dist.value(y_at(tr, x))
        ks.append(np.log(s / s_ref) / np.log(w / W0))
    if len(ks) >= 4:
        k_vals.append(float(np.mean(ks)))
        print(f"  guide S_ref={s_ref:5.0f} ft: k = {np.mean(ks):.2f} (spread {np.min(ks):.2f}..{np.max(ks):.2f})")
K_W = float(np.mean(k_vals))
print(f"weight exponent k = {K_W:.2f} (n={len(k_vals)}, sd {np.std(k_vals):.2f})")

# ----------------------------------------------- panel 3: wind guides -> credit
V_TD = 45.0  # touchdown KIAS at 2440 lb
panel3 = np.zeros_like(ink)
panel3[Y_TOP:Y_BOT, X_P3_LO + 3 : X_P3_HI - 2] = ink[Y_TOP:Y_BOT, X_P3_LO + 3 : X_P3_HI - 2]
m3h = curves.curve_mask(panel3, angles_deg=list(np.arange(-55, -10, 2)), length=25)
m3h = cv2.dilate(m3h.astype(np.uint8), np.ones((5, 7), np.uint8)).astype(bool)
hw_tracks = merge_collinear(trace(m3h, X_P3_HI - 4, X_P3_LO + 4, min_pts=50, min_span=80), max_gap=120)
hw_tracks.sort(key=lambda tr: y_at(tr, np.clip(X_P3_LO + 80, tr[0, 0], tr[-1, 0])))
print(f"\npanel 3: {len(hw_tracks)} headwind guide candidates")
m_vals, hw_slopes = [], []
for tr in hw_tracks:
    if tr[0, 0] > X_P3_LO + 15:
        continue
    if abs(tr[-1, 1] - tr[0, 1]) < 0.06 * (tr[-1, 0] - tr[0, 0]):
        continue
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
    m = np.polyfit(np.log(1 - 0.5 * vws / V_TD), np.log(ratios), 1)[0]
    slope_pct = float(np.polyfit(vws, ratios, 1)[0] * 100)
    m_vals.append(float(m))
    hw_slopes.append(slope_pct)
    print(f"  guide S(0)={s0w:5.0f} ft: m={m:.2f}, {slope_pct:+.2f}%/kt, r(15)={ratios[-1]:.3f}")
M_HW = float(np.mean(m_vals))
print(f"headwind exponent m = {M_HW:.2f} (sd {np.std(m_vals):.2f}), mean slope {np.mean(hw_slopes):+.2f}%/kt "
      f"(vs V_TD={V_TD:.0f} kt, 50% credit)")

# Tailwind guides: dashed steep lines, parametric line-scoring (as in fig 5-35).
h_grid_d = cv2.dilate(calibrate.line_mask(ink, "h", 81), np.ones((3, 1), np.uint8))
v_grid_d = cv2.dilate(calibrate.line_mask(ink, "v", 81), np.ones((1, 3), np.uint8))
resid = (ink.astype(np.uint8) & ~h_grid_d & ~v_grid_d).astype(np.uint8)
resid = cv2.dilate(resid, np.ones((2, 2), np.uint8)).astype(bool)
tw_x0 = ax_wind.px(0) + 2
tw_xs = np.arange(tw_x0, ax_wind.px(5.0), 0.5)


def tw_score(y0, dydx):
    ys = y0 + (tw_xs - tw_x0) * dydx
    ok = (ys > Y_TOP - 60) & (ys < Y_BOT + 40)
    xi = np.round(tw_xs[ok]).astype(int)
    yi = np.round(ys[ok]).astype(int)
    return float(resid[yi, xi].mean()) if len(xi) > 100 else 0.0


coarse = []
for y0 in np.arange(560.0, Y_BOT - 5.0, 1.0):
    sc, sl = max((tw_score(y0, s), s) for s in np.arange(-4.3, -1.9, 0.1))
    coarse.append((y0, sc, sl))
coarse = np.array(coarse)
tw_lines, tw_tracks = [], []
for i in range(len(coarse)):
    y0, sc, sl = coarse[i]
    lo, hi = max(0, i - 12), min(len(coarse), i + 13)
    if sc < 0.50 or sc < coarse[lo:hi, 1].max():
        continue
    fine = max(
        ((tw_score(yy, ss), yy, ss)
         for yy in np.arange(y0 - 4, y0 + 4.01, 0.5)
         for ss in np.arange(-4.4, -1.9, 0.02)),
    )
    tw_lines.append(fine)
tw_lines.sort(key=lambda t: t[1])
dedup = []
for sc, yy, ss in tw_lines:
    if dedup and abs(yy - dedup[-1][1]) < 25:
        if sc > dedup[-1][0]:
            dedup[-1] = (sc, yy, ss)
    else:
        dedup.append((sc, yy, ss))
print(f"panel 3: {len(dedup)} tailwind guide candidates (dashed, line-scored)")
mt_vals, tw_slopes = [], []
for sc, y0, dydx in dedup:
    s0w = ax_dist.value(y0)
    y5 = y0 + (ax_wind.px(5.0) - tw_x0) * dydx
    s5 = ax_dist.value(y5)
    r5 = s5 / s0w
    if abs(dydx) < 2.5:
        print(f"  guide S(0)={s0w:5.0f} ft: score {sc:.2f} slope {dydx:+.2f} REJECT (too shallow: TAIL WIND label corridor artifact)")
        continue
    mt = np.log(r5) / np.log(1 + 1.5 * 5.0 / V_TD)
    mt_vals.append(float(mt))
    tw_slopes.append(float((r5 - 1) / 5.0 * 100))
    print(f"  guide S(0)={s0w:5.0f} ft: score {sc:.2f} m={mt:.2f}, {tw_slopes[-1]:+.2f}%/kt, r(5)={r5:.3f}")
    tw_tracks.append(np.column_stack([tw_xs, y0 + (tw_xs - tw_x0) * dydx]))
# robust filter: a guide whose m sits far off the family median rode the
# TAIL WIND label corridor instead of a dashed guide - drop it
if mt_vals:
    med = float(np.median(mt_vals))
    keep_i = [i for i, m_ in enumerate(mt_vals) if abs(m_ - med) <= 0.6]
    for i in range(len(mt_vals)):
        if i not in keep_i:
            print(f"  dropped off-trend guide m={mt_vals[i]:.2f} (median {med:.2f}): label-corridor artifact")
    mt_vals = [mt_vals[i] for i in keep_i]
    tw_slopes = [tw_slopes[i] for i in keep_i]
    tw_tracks = [tw_tracks[i] for i in keep_i]
M_TW = float(np.mean(mt_vals)) if mt_vals else float("nan")
print(f"tailwind exponent m = {M_TW:.2f} (sd {np.std(mt_vals):.2f}), mean slope {np.mean(tw_slopes) if tw_slopes else float('nan'):+.2f}%/kt")


# ------------------------------------------------------------- speed strip
def strip_labels(y0, y1, x0=1270, x1=2080):
    band = ink[y0:y1, x0:x1].astype(np.uint8)
    band = cv2.morphologyEx(band, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, lab, stats, cents = cv2.connectedComponentsWithStats(band, connectivity=8)
    xs = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area > 60 and 8 <= h <= 30 and w <= 60:
            xs.append(cents[i][0] + x0)
    xs.sort()
    merged = []
    for x in xs:
        if merged and x - merged[-1][-1] < 30:
            merged[-1].append(x)
        else:
            merged.append([x])
    return [float(np.mean(g)) for g in merged]


td_x = strip_labels(440, 490)
print("\ntouchdown strip label x:", [f"{x:.0f}" for x in td_x], "-> W:", [f"{ax_w.value(x):.0f}" for x in td_x])
TD_V = [45, 42, 40, 39, 37]
w_marks = [2440, 2200, 2000, 1800, 1600]
sl, ic = np.polyfit(w_marks, TD_V, 1)
cq2 = np.polyfit(w_marks, TD_V, 2)
print(f"touchdown: quad -> {np.round(np.polyval(cq2, w_marks)).astype(int).tolist()} vs printed {TD_V}")

# ------------------------------------------- dashed worked-example trace check
short_h = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 9), np.uint8))
long_h = cv2.dilate(calibrate.line_mask(ink, "h", 80), np.ones((5, 1), np.uint8))
dash = short_h & ~long_h


def dashed_height(x0, x1, y0=600, y1=1000):
    prof = dash[y0:y1, x0:x1].sum(axis=1).astype(float)
    ys = y0 + np.arange(y1 - y0)
    pk = int(np.argmax(prof))
    thr = prof.max() * 0.4
    lo = pk
    while lo > 0 and prof[lo - 1] > thr:
        lo -= 1
    hi = pk
    while hi < len(prof) - 1 and prof[hi + 1] > thr:
        hi += 1
    yc = (ys[lo : hi + 1] * prof[lo : hi + 1]).sum() / prof[lo : hi + 1].sum()
    return float(ax_dist.value(yc))


dash_s0 = dashed_height(1180, 1305)
dash_after_w = dashed_height(1660, 1930)
print(f"\ndashed trace: S0 carry {dash_s0:.0f} ft, post-weight carry {dash_after_w:.0f} ft (printed answer 625)")
print(f"  implied weight exponent from trace: {np.log(dash_after_w / dash_s0) / np.log(2179 / W0):.2f}")

# ------------------------------------------------------- worked example chain
PA_EX, OAT_EX, W_EX, WIND_EX = 2500, 24, 2179, 0
s0_ex = S0(PA_EX, OAT_EX)
s_w = s0_ex * (W_EX / W0) ** K_W
s_final = s_w  # zero wind
err = (s_final - 625) / 625 * 100
print(f"\nworked example: S0={s0_ex:.0f} -> xW={s_w:.0f} -> xwind(1.000)={s_final:.0f} ft (printed 625, err {err:+.1f}%)")

# --------------------------------------------------------------- QA overlays
qa.overlay(
    img,
    list(p1_tracks) + list(p2_tracks) + list(hw_tracks) + list(tw_tracks),
    vlines=oat_px + [w_ref_px] + w_px + wind_px,
    hlines=dist_px,
    path="fig_5_37_curves.png",
)
model_lines = []
for pa in PA_OF_TRACK:
    oats = np.linspace(-40, 40, 30)
    xs = np.array([ax_oat.px(o) for o in oats])
    ys = np.array([ax_dist.px(S0(pa, o)) for o in oats])
    ok = (ys >= Y_TOP) & (ys <= Y_BOT)
    model_lines.append(np.column_stack([xs[ok], ys[ok]]))
qa.overlay(img, model_lines, vlines=[], hlines=[], path="fig_5_37_model_panel1.png")

# ---------------------------------------------------------------------- JSON
result = {
    "figure": "5-37",
    "pdfPage": PAGE,
    "title": "Landing ground roll distance - power off, flaps 40, paved level dry, max braking",
    "calibration": {
        "distanceFt": {"px0": ax_dist.px0, "v0": ax_dist.v0, "pxPerUnit": ax_dist.px_per_unit},
        "oatC": {"px0": ax_oat.px0, "v0": ax_oat.v0, "pxPerUnit": ax_oat.px_per_unit},
        "weightLb": {"px0": ax_w.px0, "v0": ax_w.v0, "pxPerUnit": ax_w.px_per_unit},
        "windKt": {"px0": ax_wind.px0, "v0": ax_wind.v0, "pxPerUnit": ax_wind.px_per_unit},
    },
    "deskewDeg": round(deskew, 2),
    "model": {
        "form": "S_gr = S0 * (W/2440)^k * f_wind; "
        "S0 = a + b*PA + c*OAT + d*PA*OAT + e*PA^2 + f*OAT^2 (PA ft, OAT C); "
        "headwind f = (1 - 0.5*Vw/V)^m_hw, tailwind f = (1 + 1.5*Vw/V)^m_tw, "
        "V = 45 kt (touchdown KIAS at 2440 lb, IAS~TAS at SL)",
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
            "V_ref_kias": V_TD,
        },
        "rmsPct": round(rms_quad, 2),
        "planeAlternative": {
            "form": "S0 = a + b*PA + c*OAT",
            "a": round(float(cp[0]), 1),
            "b": round(float(cp[1]), 4),
            "c": round(float(cp[2]), 2),
            "rmsPct": round(rms_plane, 2),
        },
        "sigmaAlternative": {
            "form": "S0 = A * sigma^n",
            "A": round(float(np.exp(lnA)), 1),
            "n": round(float(n_sig), 2),
            "rmsPct": round(rms_sig, 2),
        },
    },
    "refLineWeight": {"printedLabel": 2440, "geometricValue": round(W_REF_VALUE, 0)},
    "dashedTrace": {
        "S0Carry": round(dash_s0, 0),
        "postWeightCarry": round(dash_after_w, 0),
        "impliedWeightExp": round(float(np.log(dash_after_w / dash_s0) / np.log(2179 / W0)), 2),
    },
    "speeds": {
        "touchdownKias": {"weights": w_marks, "values": TD_V, "quadFit": [float(c) for c in cq2]},
        "labelXpx": {"touchdown": [round(x, 1) for x in td_x]},
        "form": "same touchdown strip as Fig 5-35; neither linear-in-W nor V*sqrt(W/2440); table interpolation",
    },
    "curves": curves_json,
    "workedExample": {
        "inputs": {"paFt": PA_EX, "oatC": OAT_EX, "weightLb": W_EX, "windKt": WIND_EX},
        "printed": {"groundRollFt": 625},
        "model": {"S0": round(s0_ex, 0), "afterWeight": round(s_w, 0), "windFactor": 1.0, "final": round(s_final, 0)},
        "errPct": round(err, 1),
    },
    "envelope": {
        "paFt": [0, 7000],
        "oatC": [-40, 40],
        "weightLb": [1700, 2440],
        "headwindKt": [0, 15],
        "tailwindKt": [0, 5],
    },
    "notes": [
        "ref line printed 2440 LBS and measures 2440 geometrically (5-35's label is the misprint)",
        "tailwind guides are dashed; extracted by parametric line-scoring against a grid-removed residual; "
        "the two guides above ~600 ft are obscured by the TAIL WIND label (one scored candidate rode the "
        "label corridor and was rejected as off-trend), so m_tw rests on the three lowest guides",
        "6000-ft fan curve drawn only to ~+32 C, 2000-ft to ~+37 C (right ends stop at the panel edge)",
        "S0 fan is nearly a sigma^-0.95 power law (rms 0.27%) - power-off landing scales ~1/sigma "
        "(touchdown TAS^2), no engine-lapse anisotropy",
    ],
}
OUT_FITS.mkdir(parents=True, exist_ok=True)
(OUT_FITS / "fig_5_37.json").write_text(json.dumps(result, indent=2))
print("\nwrote out/fits/fig_5_37.json")
