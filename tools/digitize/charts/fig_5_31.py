"""Fig 5-31 Fuel, Time and Distance to Descend (PDF page 105, landscape).

Layout: left panel converts (OAT, cruise/destination PA) to a common vertical
coordinate via a family of PA guide curves (SEA LEVEL..10000 labeled, plus two
unlabeled curves above continuing to ~12000); right panel carries three
cumulative curves (fuel gal / time min / distance nm, shared 0-40 x scale)
against the same vertical coordinate. Usage: value(cruise) - value(destination).
Conditions: 2500 RPM, 126 KIAS, no wind.

Extraction notes (hard-won, see report):
- Curve labels sit ~15-20 px ABOVE their own curve, tilted along it. The
  printed worked example (cruise 5000/16C -> 7.5 min; dest 2500/24C -> 4.5 min)
  plus lane counting at x=800 fixes curve identities: there is a curve between
  the "5000" and "7000" ones hidden under the example's dashed transfer line
  (the 6000 curve), and two unlabeled curves (11000, 12000) above 10000.
- The vertical coordinate maps linearly to ISA-anchored pressure altitude:
  y(h at ISA temp) = A + B*h  (B ~ -74.8 px/1000 ft, A ~ bottom axis).
- Left family: warmer than ISA => LOWER effective altitude h_e => less
  time/fuel/distance. dh/dT ~ -10..-60 ft/degC growing with PA.
- Right curves do not pass exactly through the origin as drawn; only
  DIFFERENCES between two readings are meaningful (chart usage subtracts).

Run: uv run python charts/fig_5_31.py
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

img, deskew = raster.prepared_page(105)
ink = raster.binarize(img)
print(f"page 105: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

# ------------------------------------------------------------------ axes
h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=600)
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=500)


def nearest(lines, pos):
    return min(lines, key=lambda ln: abs(ln.pos - pos))


oat_px = [nearest(v_lines, p).pos for p in (539, 687, 837, 987, 1136)]
oat_axis, oat_rms = calibrate.fit_axis(oat_px, [-40, -20, 0, 20, 40])
val_px = [nearest(v_lines, p).pos for p in (1284, 1433, 1584, 1731, 1881)]
val_axis, val_rms = calibrate.fit_axis(val_px, [0, 10, 20, 30, 40])
y_base = nearest(h_lines, 1346).pos
print(f"OAT axis: 0C at x={oat_axis.px(0):.1f}, {oat_axis.px_per_unit:.4f} px/C (rms {oat_rms:.2f})")
print(f"value axis: 0 at x={val_axis.px(0):.1f}, {val_axis.px_per_unit:.4f} px/unit (rms {val_rms:.2f})")
print(f"bottom axis y={y_base:.1f}")

# ------------------------------------------------------- shared trace helper
def col_centroids(m, x, max_run=14):
    col = m[:, x]
    idx = np.flatnonzero(np.diff(np.concatenate(([0], col.view(np.int8), [0]))))
    return [(s + e - 1) / 2 for s, e in zip(idx[0::2], idx[1::2]) if e - s <= max_run]


def trace(m, x0, y0, x_stop, step, gate=4.0, max_gap=90, deg=2, snap=10):
    c0 = [c for c in col_centroids(m, x0) if abs(c - y0) <= snap]
    if c0:
        y0 = min(c0, key=lambda c: abs(c - y0))
    pts = [(float(x0), float(y0))]
    gap = 0
    x = x0
    while (x - x_stop) * step < 0 and gap < max_gap:
        x += step
        arr = np.array(pts[-120:])
        if len(arr) >= 40:
            pred = np.polyval(np.polyfit(arr[:, 0], arr[:, 1], deg), x)
        elif len(arr) >= 8:
            pred = np.polyval(np.polyfit(arr[:, 0], arr[:, 1], 1), x)
        else:
            pred = pts[-1][1]
        cands = [c for c in col_centroids(m, x) if abs(c - pred) <= gate]
        if cands:
            pts.append((float(x), min(cands, key=lambda c: abs(c - pred))))
            gap = 0
        else:
            gap += 1
    return np.array(pts)


def prune(t, deg=3, tol=3.5, rounds=2):
    t = t[np.argsort(t[:, 0])]
    for _ in range(rounds):
        c = np.polyfit(t[:, 0], t[:, 1], deg)
        t = t[np.abs(t[:, 1] - np.polyval(c, t[:, 0])) < tol]
    return t


# ------------------------------------------------- left panel: curve family
roi = np.zeros_like(ink)
roi[295:1345, 525:1160] = ink[295:1345, 525:1160]
# maskShallow includes near-horizontal angles (needed for the flat right ends of
# the low curves); maskSteep excludes them (near the labels, shallow kernels
# latch onto thick horizontal gridlines and the dashed example line).
maskShallow = curves.curve_mask(roi, angles_deg=list(np.arange(-56, -3, 2.5)), length=31)
maskL = curves.curve_mask(roi, angles_deg=list(np.arange(-56, -9, 2.5)), length=31)

# Identity-verified seeds. Lower curves (1000..5000): seed y at x=1100
# (identity via printed example: 5000 curve passes cruise arrow tip
# (955,1013); 3000/2000 bracket the dest transfer at y=1188).
# Upper curves (6000..12000): seed y at x=800 (lane count between labels;
# 6000 is hidden under the dashed transfer line right of x~950).
low_seeds = {1000: 1292, 2000: 1238, 3000: 1181, 4000: 1118, 5000: 1059}
lane_seeds = {6000: 857, 7000: 783, 8000: 716, 9000: 657, 10000: 600,
              11000: 546, 12000: 481}
right_seeds = {7000: 958, 8000: 894, 9000: 859, 10000: 800, 11000: 752, 12000: 711}

family = {}
for pa, sy in low_seeds.items():
    tl = trace(maskShallow, 1100, sy, 528, -1, gate=4.5, max_gap=120)
    tr = trace(maskShallow, 1100, sy, 1158, +1, gate=4.5, max_gap=120)
    family[pa] = prune(np.vstack([tl[::-1], tr[1:]]))
for pa, sy in lane_seeds.items():
    tl = trace(maskL, 800, sy, 528, -1)
    tm = trace(maskL, 800, sy, 905, +1)  # dies at the STANDARD TEMPERATURE banner
    parts = [np.vstack([tl[::-1], tm[1:]])]
    if pa in right_seeds:
        tr = trace(maskL, 1100, right_seeds[pa], 900, -1)
        tr2 = trace(maskL, 1100, right_seeds[pa], 1158, +1)
        right = np.vstack([tr[::-1], tr2[1:]])
        parts.append(right[right[:, 0] >= 905])
    else:  # 6000: right part hides under the dashed example line; clip it
        t6 = trace(maskL, 860, 895, 1158, +1)
        t6 = t6[(t6[:, 0] >= 905) & ~((t6[:, 1] > 1000) & (t6[:, 1] < 1020) & (t6[:, 0] > 1030))]
        parts.append(t6)
    pts = np.vstack([p for p in parts if len(p)])
    pts = pts[pts[:, 0] <= 908] if pa not in right_seeds and False else pts
    family[pa] = prune(pts)

# y <-> ISA-altitude axis from the family's own ISA anchors (1000..10000)
pas, ys = [], []
for pa in range(1000, 10001, 1000):
    t = family[pa]
    c3 = np.polyfit(t[:, 0], t[:, 1], 3)
    pas.append(pa)
    ys.append(float(np.polyval(c3, oat_axis.px(15 - 1.9812 * pa / 1000))))
B, A = np.polyfit(pas, ys, 1)
ladder_rms = float((np.array(ys) - (A + B * np.array(pas))).std())
h_axis = calibrate.Axis(px0=float(A), v0=0.0, px_per_unit=float(B))
print(f"ISA ladder: y(0)={A:.1f} px (axis {y_base:.1f}), {B*1000:.2f} px/1000ft, rms {ladder_rms:.1f} px")

# ------------------------------------------------- left panel surface fit
rows = []
for pa, t in family.items():
    for x, y in t:
        dT = oat_axis.value(x) - (15 - 1.9812 * pa / 1000)
        rows.append((pa, dT, h_axis.value(y)))
rows = np.array(rows)
PA, dT, H = rows[:, 0], rows[:, 1], rows[:, 2]
X = np.column_stack([dT, dT * PA / 1000, dT**2, (dT**2) * PA / 1000, dT**3])
fit_sel = PA <= 10000  # 11000/12000 are unlabeled guide curves with noisier traces
coefs, *_ = np.linalg.lstsq(X[fit_sel], (H - PA)[fit_sel], rcond=None)
surf_rms = float(((H - PA)[fit_sel] - X[fit_sel] @ coefs).std())
print(f"surface h_e = PA + a1 dT + a2 dT PA/1000 + b1 dT^2 + b2 dT^2 PA/1000 + c dT^3")
print(f"  coefs {np.round(coefs, 4)}  rms {surf_rms:.0f} ft")


def h_e(pa, oat):
    d = oat - (15 - 1.9812 * pa / 1000)
    return float(pa + coefs[0] * d + coefs[1] * d * pa / 1000 + coefs[2] * d * d
                 + coefs[3] * d * d * pa / 1000 + coefs[4] * d**3)


# ------------------------------------------------- right panel: three curves
Y0 = 360
roiT = ink[Y0:1350, 1270:1900].T.copy()
maskT = curves.curve_mask(roiT, angles_deg=list(np.arange(4, 34, 1.5)), length=31)

# time: anchor at the printed dest transfer (4.5 min at y=1188); the example's
# vertical drop arrow sits at the same x below y~1190, so trace only upward,
# then add row-probe points above the TIME-MINUTES label and below y=1200.
t_up = trace(maskT, 1188 - Y0, 1351 - 1270, 0, -1, gate=4.5, max_gap=170)
time_xy = np.column_stack([t_up[:, 1] + 1270, t_up[:, 0] + Y0])
time_xy = time_xy[time_xy[:, 1] <= 1185]


def row_probe(y_lo, y_hi, x_lo, x_hi, seed_x, step_dx, min_w=4, gate=5.0):
    """Per-row thick-run centroids walking upward (y decreasing by 2);
    step_dx = expected x change per 2-row step (curves move right going up)."""
    out = []
    pred = float(seed_x)
    for y in range(y_lo, y_hi, -2):
        row = ink[y, x_lo:x_hi]
        idx = np.flatnonzero(np.diff(np.concatenate(([0], row.view(np.int8), [0]))))
        runs = [(s + x_lo, e + x_lo) for s, e in zip(idx[0::2], idx[1::2]) if e - s >= min_w]
        cands = [(s + e - 1) / 2 for s, e in runs if abs((s + e - 1) / 2 - pred) <= gate]
        if cands:
            xc = min(cands, key=lambda v: abs(v - pred))
            out.append((xc, y))
            pred = xc + step_dx
        else:
            pred += step_dx
    return np.array(out) if out else np.zeros((0, 2))


# above the label (label occupies y~650..935 at x~1420-1540): dx/dy ~ -0.12
top_pts = row_probe(935, 462, 1390, 1480, 1406, +0.24)
# bottom segment y 1340..1198 (between example arrows): dx/dy ~ -0.35
bot_pts = row_probe(1340, 1198, 1282, 1360, 1293, +0.70)
time_all = np.vstack([time_xy, top_pts, bot_pts])
time_all = time_all[np.argsort(time_all[:, 1])]

# dist: anchor at printed dest transfer (8 nm at y=1188)
d_up = trace(maskT, 1188 - Y0, 1403 - 1270, 0, -1, gate=4.5, max_gap=170)
d_dn = trace(maskT, 1188 - Y0, 1403 - 1270, 985, +1, gate=4.5, max_gap=170)
dist_xy = np.column_stack([np.concatenate([d_up[::-1][:, 1], d_dn[1:, 1]]) + 1270,
                           np.concatenate([d_up[::-1][:, 0], d_dn[1:, 0]]) + Y0])
dist_xy = dist_xy[(dist_xy[:, 1] >= 445) & (dist_xy[:, 1] <= 1250)]

# fuel: near-vertical, only ~5-20 px right of the 0-axis, tangled with the
# 1-gal minor gridline (~x 1299). Above y~1000 the stroke sits ON/right of the
# minor: use the merged run's RIGHT edge - 2.5 (half stroke width). Below
# y~1120 it sits left of the minor: use the LEFT edge + 2.5, clipped at the
# axis line. The transition band (y 1000-1120) is unresolvable - skipped.
def fuel_runs(y):
    row = ink[y, 1276:1350]
    idx = np.flatnonzero(np.diff(np.concatenate(([0], row.view(np.int8), [0]))))
    rr = [[s + 1276.0, e + 1276.0 - 1] for s, e in zip(idx[0::2], idx[1::2])]
    merged = []
    for s, e in rr:
        if merged and s - merged[-1][1] <= 2:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return merged


fuel_pts = []
for y in range(430, 1001):
    cand = [r for r in fuel_runs(y) if 1296 <= r[1] <= 1312 and r[0] >= 1288 and r[1] - r[0] >= 3]
    if cand:
        fuel_pts.append((max(cand, key=lambda r: r[1])[1] - 2.5, y))
for y in range(1121, 1261):
    cand = [r for r in fuel_runs(y) if r[0] <= 1296 and r[1] >= 1290 and r[1] - r[0] >= 3]
    if cand:
        fuel_pts.append((max(cand[0][0], val_axis.px(0) + 4.2) + 2.5, y))
fuel_xy = np.array(fuel_pts)


def fit_curve(xy, name, deg=2):
    v = np.array([val_axis.value(x) for x in xy[:, 0]])
    h = np.array([h_axis.value(y) for y in xy[:, 1]])
    c = np.polyfit(h, v, deg)
    rms = float((v - np.polyval(c, h)).std())
    print(f"{name}: deg{deg} coeffs(high->low) {np.round(c, 12)} "
          f"(rms {rms:.3f} units, n={len(xy)}, h {h.min():.0f}..{h.max():.0f}, v(0)={np.polyval(c,0):.2f})")
    return c, rms


c_time, rms_time = fit_curve(time_all, "time", deg=3)
c_dist, rms_dist = fit_curve(dist_xy, "dist", deg=2)
c_fuel, rms_fuel = fit_curve(fuel_xy, "fuel", deg=3)

# implied physics
dt_c, dd_c, df_c = np.polyder(c_time), np.polyder(c_dist), np.polyder(c_fuel)
for h in (1000, 4000, 8000, 11500):
    dtdh = np.polyval(dt_c, h)                    # min/ft
    rod = 1 / dtdh if dtdh > 0 else float("nan")  # ft/min
    tas = np.polyval(dd_c, h) / dtdh * 60         # kt
    ff = np.polyval(df_c, h) / dtdh * 60          # gph
    print(f"  at h_e={h}: ROD {rod:.0f} fpm, TAS {tas:.0f} kt, FF {ff:.1f} gph")

# ------------------------------------------------- worked example
h1, h2 = h_e(5000, 16), h_e(2500, 24)
print(f"\nworked example: h_e(5000,16C)={h1:.0f}, h_e(2500,24C)={h2:.0f}")
results = {}
for name, c, pA, pB in (("time", c_time, 7.5, 4.5), ("dist", c_dist, 13.5, 8.0),
                        ("fuel", c_fuel, 1.0, 0.5)):
    vA, vB = float(np.polyval(c, h1)), float(np.polyval(c, h2))
    diff, printed = vA - vB, pA - pB
    err = 100 * (diff - printed) / printed
    results[name] = (vA, vB, diff, err)
    print(f"  {name}: {vA:.2f} - {vB:.2f} = {diff:.2f} (printed {pA}-{pB}={printed:.1f}) err {err:+.1f}%")

# ------------------------------------------------- QA overlays
fit_lines = []
for pa, t in sorted(family.items()):
    c3 = np.polyfit(t[:, 0], t[:, 1], 3)
    xs = np.arange(t[:, 0].min(), t[:, 0].max())
    fit_lines.append(np.column_stack([xs, np.polyval(c3, xs)]))
qa.overlay(img, fit_lines, vlines=oat_px, hlines=[y_base, A], path="fig_5_31_left.png")

right_lines = []
for xy, c in ((time_all, c_time), (dist_xy, c_dist), (fuel_xy, c_fuel)):
    ys = np.arange(455, 1345)
    hs = np.array([h_axis.value(y) for y in ys])
    xs = np.array([val_axis.px(v) for v in np.polyval(c, hs)])
    right_lines.append(np.column_stack([xs, ys]))
    right_lines.append(xy)
qa.overlay(img, right_lines, vlines=val_px, hlines=[y_base], path="fig_5_31_right.png")
print("QA: out/qa/fig_5_31_left.png, out/qa/fig_5_31_right.png")

# ------------------------------------------------- emit JSON
def sample_curve(t, n=40):
    t = t[np.argsort(t[:, 0])]
    return t[:: max(1, len(t) // n)]

out = {
    "figure": "5-31",
    "pdfPage": 105,
    "title": "Fuel, Time and Distance to Descend",
    "conditions": {"rpm": 2500, "speedKIAS": 126, "wind": "none"},
    "calibration": {
        "oatC": {"px0": oat_axis.px0, "v0": oat_axis.v0, "pxPerUnit": oat_axis.px_per_unit},
        "value": {"px0": val_axis.px0, "v0": val_axis.v0, "pxPerUnit": val_axis.px_per_unit},
        "isaAltFt": {"px0": h_axis.px0, "v0": 0.0, "pxPerUnit": h_axis.px_per_unit},
        "bottomAxisY": y_base,
    },
    "deskewDeg": deskew,
    "model": {
        "form": ("h_e = PA + a1*dT + a2*dT*PA/1000 + b1*dT^2 + b2*dT^2*PA/1000 + c3*dT^3, "
                 "dT = OAT - (15 - 1.9812*PA/1000); "
                 "time_min(h)=T0+T1*h+T2*h^2+T3*h^3; dist_nm(h)=D0+D1*h+D2*h^2; "
                 "fuel_gal(h)=F0+F1*h+F2*h^2+F3*h^3; "
                 "usage: value(h_e(cruise PA, cruise OAT)) - value(h_e(dest PA, dest OAT)); "
                 "only differences are meaningful (drawn curves carry small offsets)"),
        "params": {
            "a1": round(float(coefs[0]), 4), "a2": round(float(coefs[1]), 4),
            "b1": round(float(coefs[2]), 4), "b2": round(float(coefs[3]), 4),
            "c3": round(float(coefs[4]), 5),
            "T0": round(float(c_time[3]), 4), "T1": round(float(c_time[2]), 8),
            "T2": round(float(c_time[1]), 12), "T3": round(float(c_time[0]), 16),
            "D0": round(float(c_dist[2]), 4), "D1": round(float(c_dist[1]), 8), "D2": round(float(c_dist[0]), 12),
            "F0": round(float(c_fuel[3]), 4), "F1": round(float(c_fuel[2]), 8),
            "F2": round(float(c_fuel[1]), 12), "F3": round(float(c_fuel[0]), 16),
        },
        "rmsPct": round(100 * surf_rms / 12000, 2),
        "surfaceRmsFt": round(surf_rms, 0),
        "curveRmsUnits": {"time": round(rms_time, 3), "dist": round(rms_dist, 3), "fuel": round(rms_fuel, 3)},
    },
    "curves": (
        [{"label": f"PA {pa} ft",
          "points": [[round(oat_axis.value(x), 1), round(h_axis.value(y), 0)] for x, y in sample_curve(t)]}
         for pa, t in sorted(family.items())]
        + [{"label": lab,
            "points": [[round(val_axis.value(x), 2), round(h_axis.value(y), 0)] for x, y in sample_curve(xy)]}
           for lab, xy in (("time min", time_all), ("dist nm", dist_xy), ("fuel gal", fuel_xy))]
    ),
    "workedExample": {
        "inputs": {"cruisePAft": 5000, "cruiseOatC": 16, "destPAft": 2500, "destOatC": 24},
        "printed": {"timeMin": 3.0, "distNm": 5.5, "fuelGal": 0.5,
                    "readings": {"time": [7.5, 4.5], "dist": [13.5, 8.0], "fuel": [1.0, 0.5]}},
        "model": {"h_e": [round(h1), round(h2)],
                  "timeMin": round(results["time"][2], 2),
                  "distNm": round(results["dist"][2], 2),
                  "fuelGal": round(results["fuel"][2], 2)},
        "errPct": {"time": round(results["time"][3], 1), "dist": round(results["dist"][3], 1),
                   "fuel": round(results["fuel"][3], 1)},
    },
    "envelope": {
        "paFt": [0, 12000], "oatC": [-40, 40],
        "notes": "labels only to 10000 ft; 11000/12000 curves unlabeled, lower confidence; "
                 "h_e below ~1300 ft uses extrapolated curve fits (chart bottom obscured by example arrows)",
    },
    "notes": [
        "Chart is a difference nomograph: absolute curve values contain drafting offsets; "
        "subtract destination reading from cruise reading.",
        "Warmer than ISA lowers effective altitude h_e (dh/dT ~ -8 ft/C at SL to ~-60 ft/C "
        "at 10000 ft): less time/fuel/distance to descend - opposite of density-altitude intuition; "
        "encodes higher power (less power deficit) at a given IAS in warm air? See report.",
        "Implied ROD grows strongly with altitude (~500 fpm near SL to ~1400+ fpm at 10000+ ft) "
        "at 2500 RPM / 126 KIAS.",
        "Hidden 6000-ft curve lies under the example's dashed transfer line; "
        "identities verified against both printed transfer lines.",
    ],
}
dest = Path(__file__).resolve().parents[1] / "out" / "fits" / "fig_5_31.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, indent=2))
print(f"wrote {dest}")
