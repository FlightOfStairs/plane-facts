"""Fig 5-5 Stall Speed (PDF p.92, landscape): two-panel nomograph.

Structure (established by probing the raster):
- LEFT panel: 4 curves vs gross weight, drawn from the 2440-lb max-weight
  reference line down to 1600 lb: 0-flap CAS (dash-dot, top), 0-flap IAS
  (solid) and 40-flap CAS (dash-dot) -- these two nearly coincide at 2440
  (~50) and separate at lower weight -- and 40-flap IAS (solid, bottom).
- RIGHT panel: a FAN of five evenly-spaced guide curves (entry values ~34.3,
  38.5, 42.4, 46, 50.2 kt at 0 deg bank), each following V(phi) =
  V0/sqrt(cos phi): the user enters at the left-panel speed and follows the
  fan proportionally (same idiom as Fig 5-11's ratio panels). The fan is NOT
  anchored to specific flap/weight combinations.
- Printed example: 2170 lb, 20 deg bank, 40 flaps -> 44 KTS indicated.

Run:  uv run python charts/fig_5_05.py
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT = Path(__file__).resolve().parents[1] / "out"

img, deskew = raster.prepared_page(92)
ink = raster.binarize(img)
print(f"page 92: {img.shape[1]}x{img.shape[0]}, deskew {deskew:+.2f} deg")

# ---------------------------------------------------------------- calibration
h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=350,
                               roi=(slice(560, 1340), slice(1630, 2070)))
h_pos = [ln.pos for ln in h_lines]
bottom = max(h_pos)
maj_y, maj_v = [], []
for k in range(6):
    want = bottom - k * 149.4
    near = min(h_pos, key=lambda p: abs(p - want))
    assert abs(near - want) < 6, (want, near)
    maj_y.append(near)
    maj_v.append(20 + 10 * k)  # bottom border = 20 kt; labels 30..70
spd_axis, spd_rms = calibrate.fit_axis(maj_y, maj_v)
print(f"speed axis: 30kt at y={spd_axis.px(30):.1f}, {spd_axis.px_per_unit:.3f} px/kt, rms {spd_rms:.2f} px")

v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=250,
                               roi=(slice(1000, 1330), slice(560, 2090)))
v_pos = sorted(ln.pos for ln in v_lines if ln.thickness >= 4)
right = max(v_pos)
bank_x, bank_v = [], []
for k in range(4):
    want = right - k * 151.4
    near = min(v_pos, key=lambda p: abs(p - want))
    assert abs(near - want) < 6, (want, near)
    bank_x.append(near)
    bank_v.append(60 - 20 * k)
bank_axis, bank_rms = calibrate.fit_axis(bank_x, bank_v)
print(f"bank axis: 0deg at x={bank_axis.px(0):.1f}, {bank_axis.px_per_unit:.3f} px/deg, rms {bank_rms:.2f} px")

w_anchor = min(v_pos, key=lambda p: abs(p - 872.2))
wt_x, wt_v = [], []
for k in range(5):
    want = w_anchor + k * 150.35
    near = min(v_pos, key=lambda p: abs(p - want))
    assert abs(near - want) < 6, (want, near)
    wt_x.append(near)
    wt_v.append(2400 - 200 * k)
wt_axis, wt_rms = calibrate.fit_axis(wt_x, wt_v)
x_ref = wt_axis.px(2440)
ref_meas = min(v_pos, key=lambda p: abs(p - x_ref))
print(f"weight axis: 2400lb at x={wt_axis.px(2400):.1f}, {wt_axis.px_per_unit:.4f} px/lb, "
      f"rms {wt_rms:.2f} px; 2440 ref predicted {x_ref:.1f} vs drawn {ref_meas:.1f}")

# Fig 5-3 calibration polynomials (for priors + consistency checks)
f53 = json.loads((OUT / "fits" / "fig_5_03.json").read_text())
Q_UP = f53["model"]["params"]["flapsUp"]
Q_40 = f53["model"]["params"]["flaps40"]

def cas53(ias, q):
    return q["a0"] + q["a1"] * ias + q["a2"] * ias ** 2

def ias53(cas, q):
    if q["a2"] == 0:
        return (cas - q["a0"]) / q["a1"]
    d = q["a1"] ** 2 + 4 * q["a2"] * (cas - q["a0"])
    return (-q["a1"] + np.sqrt(d)) / (2 * q["a2"])

# ------------------------------------------------------------- panel masks
def build_mask(x0, x1, angles, exclusions):
    roi = np.zeros_like(ink)
    roi[445:1332, x0:x1] = ink[445:1332, x0:x1]
    for (ey0, ey1, ex0, ex1) in exclusions:
        roi[ey0:ey1, ex0:ex1] = False
    return curves.curve_mask(roi, angles_deg=list(angles), length=15)

LEGEND = (590, 775, 1015, 1540)
LBL0_TXT = (836, 884, 1376, 1520)
LBL40_TXT = (1138, 1198, 1462, 1672)  # text + arrow tails
ARROW40 = [(int(1015 + 0.316 * (x - 1080)) - 6, int(1015 + 0.316 * (x - 1080)) + 6, x, x + 20)
           for x in range(1140, 1462, 20)]  # long arrow shaft corridor

W_X0, W_X1 = int(ref_meas) + 1, int(wt_axis.px(1600)) + 3
B_X0, B_X1 = int(bank_axis.px(0)) + 3, int(bank_axis.px(60)) - 2

wmask = build_mask(W_X0 - 3, W_X1, np.arange(-24, -3, 2.0),
                   [LEGEND, LBL0_TXT, LBL40_TXT] + ARROW40)
bmask = build_mask(B_X0 - 2, B_X1, np.arange(0, 68, 2.5), [LBL40_TXT])

def col_runs(mask, x, max_h=32, max_runs=25):
    col = np.flatnonzero(mask[:, x])
    if col.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(col) > 3)
    out = []
    for a, b in zip(np.r_[0, breaks + 1], np.r_[breaks, col.size - 1]):
        if col[b] - col[a] + 1 <= max_h:
            out.append((col[a] + col[b]) / 2.0)
    return out if len(out) <= max_runs else []  # pathological columns only

def track(mask, x0, x1, prior, tol=6.0, prior_tol=18.0, max_gap=80, fit_win=18,
          pick="nearest"):
    """Follow one stroke left->right; candidates gated by continuity AND a
    model prior y(x).  During dash gaps the prediction follows the PRIOR's
    shape from the last accepted point (linear extrapolation drifts).
    pick biases the choice among in-tolerance candidates: 'upper' (min y) or
    'lower' (max y) resolves nearly-merged curve pairs and decoration."""
    hist, gap = [], 0
    for x in (range(x0, x1) if x0 < x1 else range(x0, x1, -1)):
        if hist and gap > 12:
            xl, yl = hist[-1]
            pred = yl + prior(x) - prior(xl)
        elif len(hist) >= 6:
            h = np.array(hist[-fit_win:])
            pred = float(np.polyval(np.polyfit(h[:, 0], h[:, 1], 1), x))
        elif hist:
            pred = hist[-1][1]
        else:
            pred = prior(x)
        tol_eff = (tol if hist else 10) + min(0.1 * gap, 5.0)
        cand = [r for r in col_runs(mask, x)
                if abs(r - pred) <= tol_eff and abs(r - prior(x)) <= prior_tol]
        if cand:
            if pick == "upper":
                y = min(cand)
            elif pick == "lower":
                y = max(cand)
            else:
                y = min(cand, key=lambda r: abs(r - pred))
            hist.append((x, y))
            gap = 0
            if y < 455:
                break
        else:
            gap += 1
            if gap > max_gap:
                break
    return np.array(hist)

# ---------------------------------------------------------------- tracking
V0_PRIORS = {"cas0": 55.8, "cas40": 50.2, "ias0": 49.6, "ias40": 44.1}

# power-law priors seeded from a first tracking pass (anchor V0 at 2440 and
# an approximate exponent; the prior only steers stroke selection)
W_PRIOR_POW = {"cas0": (56.4, 0.40), "cas40": (50.6, 0.42),
               "ias0": (50.3, 0.50), "ias40": (44.3, 0.55)}

def w_prior(name):
    v0, e = W_PRIOR_POW[name]
    return lambda x: spd_axis.px(v0 * (wt_axis.value(x) / 2440.0) ** e)

W_PICK = {"cas0": "lower", "cas40": "upper", "ias0": "lower", "ias40": "lower"}
wtracks = {}
for name in V0_PRIORS:
    tf = track(wmask, W_X0, W_X1, w_prior(name), prior_tol=26.0, pick=W_PICK[name])
    tr = track(wmask, W_X1 - 1, W_X0 - 1, w_prior(name), prior_tol=26.0, pick=W_PICK[name])
    tr = tr[np.argsort(tr[:, 0])] if len(tr) else tr
    # reconcile: where both passes cover an x, keep the reverse pass when they
    # disagree (>4 px) in the right half (labels/arrows fork rightward, so the
    # reverse pass rides the true stroke there), else the forward pass.
    byx = {x: y for x, y in tf}
    for x, y in (tr if len(tr) else []):
        if x in byx:
            if abs(byx[x] - y) > 4 and x > (W_X0 + W_X1) / 2:
                byx[x] = y
        else:
            byx[x] = y
    t = np.array(sorted(byx.items()))
    wtracks[name] = t
    print(f"{name}: weight x[{t[0,0]:.0f},{t[-1,0]:.0f}] n={len(t)} "
          f"V[{spd_axis.value(t[0,1]):.2f} -> {spd_axis.value(t[-1,1]):.2f}]")
    for xp in (950, 1100, 1250, 1350, 1450):
        sel = t[(t[:, 0] > xp - 15) & (t[:, 0] < xp + 15)]
        if len(sel):
            print(f"    x~{xp} (W {wt_axis.value(xp):.0f}): V {spd_axis.value(sel[:,1].mean()):.2f}")

FAN_PRIORS = [34.3, 38.5, 42.4, 46.0, 50.2]
btracks = []
for v0 in FAN_PRIORS:
    p = lambda x, v0=v0: spd_axis.px(v0 * np.cos(np.radians(bank_axis.value(x))) ** -0.5)
    t = track(bmask, B_X0, B_X1, p, prior_tol=14.0)
    btracks.append(t)
    print(f"fan {v0}: bank x[{t[0,0]:.0f},{t[-1,0]:.0f}] n={len(t)} "
          f"V[{spd_axis.value(t[0,1]):.2f} -> {spd_axis.value(t[-1,1]):.2f}]")

# ------------------------------------------------------------------ fitting
def vw(t):
    return (np.array([wt_axis.value(x) for x in t[:, 0]]),
            np.array([spd_axis.value(y) for y in t[:, 1]]))

# The drawn curves are shallower than sqrt near the 2440 ref line and steepen
# to ~sqrt below ~2000 lb (local log-log slope ramps ~0.2 -> ~0.55).  A single
# power law biases the anchor, so fit a quadratic in w = W/2440 and report an
# endpoint-effective exponent for cross-chart comparison.
wfits = {}
for name, t in wtracks.items():
    W, V = vw(t)
    w = W / 2440.0
    keep = np.ones(len(W), bool)
    for _ in range(3):
        c = np.polyfit(w[keep], V[keep], 2)
        r = V - np.polyval(c, w)
        keep = np.abs(r) < max(3 * r[keep].std(), 0.5)
    rms = float(np.sqrt(np.mean(r[keep] ** 2)))
    v2440 = float(np.polyval(c, 1.0))
    v1600 = float(np.polyval(c, 1600.0 / 2440.0))
    e_eff = float(np.log(v1600 / v2440) / np.log(1600.0 / 2440.0))
    wfits[name] = dict(coef=[float(x) for x in c], v0=v2440, v1600=v1600, e=e_eff,
                       rmsKt=rms, W=W[keep], V=V[keep])
    print(f"{name}: V(w)={c[2]:.2f}{c[1]:+.2f}w{c[0]:+.2f}w^2 (w=W/2440); "
          f"V(2440)={v2440:.2f}, V(1600)={v1600:.2f}, eff exp {e_eff:.3f}, "
          f"rms {rms:.2f} kt, kept {keep.sum()}/{len(W)}")

def wcurve(name, Wq):
    return np.polyval(wfits[name]["coef"], np.asarray(Wq) / 2440.0)

# fan: shared exponent, per-curve V0
rows, cols_v0, ys = [], [], []
for i, t in enumerate(btracks):
    P = np.array([bank_axis.value(x) for x in t[:, 0]])
    V = np.array([spd_axis.value(y) for y in t[:, 1]])
    for p, v in zip(P, V):
        rows.append((i, -np.log(np.cos(np.radians(p)))))
        ys.append(np.log(v))
M = np.zeros((len(rows), 6))
for r, (i, lc) in enumerate(rows):
    M[r, i] = 1.0
    M[r, 5] = lc
coef, *_ = np.linalg.lstsq(M, np.array(ys), rcond=None)
fan_v0 = [float(np.exp(c)) for c in coef[:5]]
fan_e = float(coef[5])
res = M @ coef - np.array(ys)
fan_rms_kt = float(np.sqrt(np.mean((np.exp(M @ coef) - np.exp(ys)) ** 2)))
print(f"fan: V0s {['%.2f' % v for v in fan_v0]}, shared cos exponent {fan_e:.3f}, rms {fan_rms_kt:.2f} kt")

# --------------------------------------------- implied stall-range conversion
# Pair each IAS curve with its CAS sibling at the same weight.
conv = {}
for flap, (ci, cc, q) in {"0": ("ias0", "cas0", Q_UP), "40": ("ias40", "cas40", Q_40)}.items():
    fi, fc = wfits[ci], wfits[cc]
    cas_model = wcurve(cc, fi["W"])
    delta = cas_model - fi["V"]
    lin = np.polyfit(fi["V"], cas_model, 1)
    conv[flap] = dict(
        deltaMeanKt=float(delta.mean()), deltaStdKt=float(delta.std()),
        b0=float(lin[1]), b1=float(lin[0]),
        iasRange=[float(fi["V"].min()), float(fi["V"].max())])
    print(f"flaps {flap}: CAS-IAS delta {delta.mean():.2f} +/- {delta.std():.2f} kt over "
          f"IAS {fi['V'].min():.1f}-{fi['V'].max():.1f}; linear CAS = {lin[1]:+.2f} + {lin[0]:.3f}*IAS")
    # 5-3 comparison at anchor + low end
    for iasv in (fi["V"].max(), fi["V"].min()):
        print(f"    IAS {iasv:.1f}: 5-5 implies CAS {np.polyval(lin, iasv):.1f}; "
              f"5-3 fit gives {cas53(iasv, q):.1f}")

# ------------------------------------------------------- example trace check
# vertical dashed at 2170 lb; horizontal dashed transfer.
x_ex = int(round(wt_axis.px(2170)))
col = np.flatnonzero(ink[:, x_ex - 2:x_ex + 8].any(axis=1))
col = col[(col > 900) & (col < 1332)]
print(f"example vertical (x~{x_ex}): ink y {col.min()}..{col.max()} "
      f"-> tops out at V={spd_axis.value(col.min()):.2f}")

# ------------------------------------------------------------ worked example
W_EX, PHI_EX = 2170.0, 20.0
entry = float(wcurve("ias40", W_EX))
ias_ex = entry * np.cos(np.radians(PHI_EX)) ** (-fan_e)
err_pct = 100 * (ias_ex - 44.0) / 44.0
print(f"\nworked example (chart procedure): left panel {entry:.2f} KIAS "
      f"-> x cos^-{fan_e:.3f}(20deg) = {ias_ex:.2f} KIAS (printed 44, {err_pct:+.1f}%)")

cas_ex = float(wcurve("cas40", W_EX)) * np.cos(np.radians(PHI_EX)) ** -0.5
ias_via_conv = (cas_ex - conv["40"]["b0"]) / conv["40"]["b1"]
print(f"physics chain: CAS {cas_ex:.2f} -> implied conversion -> {ias_via_conv:.2f} KIAS "
      f"({100 * (ias_via_conv - 44) / 44:+.1f}%)")

# ------------------------------------------------------------------- output
def curve_samples(t, axis_fn, n=15):
    idx = np.linspace(0, len(t) - 1, min(n, len(t))).astype(int)
    return [[round(float(axis_fn(t[i, 0])), 1), round(float(spd_axis.value(t[i, 1])), 2)]
            for i in idx]

out = {
    "figure": "5-5",
    "pdfPage": 92,
    "title": "Stall Speed",
    "deskewDeg": round(deskew, 2),
    "calibration": {
        "speed": {"px0": spd_axis.px0, "v0": spd_axis.v0, "pxPerUnit": spd_axis.px_per_unit},
        "weight": {"px0": wt_axis.px0, "v0": wt_axis.v0, "pxPerUnit": wt_axis.px_per_unit},
        "bank": {"px0": bank_axis.px0, "v0": bank_axis.v0, "pxPerUnit": bank_axis.px_per_unit},
    },
    "model": {
        "form": "Vs(flap,W,phi) = polyval(coef, W/2440) / cos(phi)^bankExponent, "
                "separately for CAS (dash-dot) and IAS (solid) curves; coef is "
                "quadratic [c2,c1,c0] in w=W/2440 (drawn curves run shallower "
                "than sqrt near 2440 and steepen to ~sqrt below ~2000 lb)",
        "params": {
            "flaps0": {"casCoef": [round(v, 3) for v in wfits["cas0"]["coef"]],
                        "iasCoef": [round(v, 3) for v in wfits["ias0"]["coef"]],
                        "vs0Cas2440": round(wfits["cas0"]["v0"], 2),
                        "vs0Ias2440": round(wfits["ias0"]["v0"], 2),
                        "effExpCas": round(wfits["cas0"]["e"], 3),
                        "effExpIas": round(wfits["ias0"]["e"], 3)},
            "flaps40": {"casCoef": [round(v, 3) for v in wfits["cas40"]["coef"]],
                         "iasCoef": [round(v, 3) for v in wfits["ias40"]["coef"]],
                         "vs0Cas2440": round(wfits["cas40"]["v0"], 2),
                         "vs0Ias2440": round(wfits["ias40"]["v0"], 2),
                         "effExpCas": round(wfits["cas40"]["e"], 3),
                         "effExpIas": round(wfits["ias40"]["e"], 3)},
            "bankExponent": round(fan_e, 3),
            "fanV0Kt": [round(v, 2) for v in fan_v0],
        },
        "rmsKt": {**{k: round(f["rmsKt"], 2) for k, f in wfits.items()},
                  "fan": round(fan_rms_kt, 2)},
        "rmsPct": round(100 * max([f["rmsKt"] for f in wfits.values()] + [fan_rms_kt]) / 45.0, 2),
    },
    "stallRangeCalibration": {
        "note": "IAS<->CAS mapping implied by pairing the chart's own CAS and "
                "IAS curves; compare Fig 5-3 (drawn only above ~43 KIAS)",
        "flaps0": conv["0"], "flaps40": conv["40"],
    },
    "curves": (
        [{"label": f"{n} vs weight", "points": curve_samples(t, wt_axis.value)}
         for n, t in wtracks.items()] +
        [{"label": f"bank fan guide ~{FAN_PRIORS[i]} kt", "points": curve_samples(t, bank_axis.value)}
         for i, t in enumerate(btracks)]
    ),
    "workedExample": {
        "inputs": {"weightLb": W_EX, "bankDeg": PHI_EX, "flaps": 40},
        "printed": {"stallIndicatedKt": 44.0},
        "model": {"leftPanelIndicatedKt": round(float(entry), 2),
                  "stallIndicatedKt": round(float(ias_ex), 2),
                  "stallCasKt": round(float(cas_ex), 2),
                  "iasViaImpliedConversion": round(float(ias_via_conv), 2)},
        "errPct": round(float(err_pct), 1),
    },
    "envelope": {"weightLb": [1600, 2440], "bankDeg": [0, 60], "flaps": [0, 40],
                 "note": "no 25-deg flap family; curves drawn 2440 down to 1600 lb"},
    "notes": [
        "Right panel is a fan of five guide curves (~34.3/38.5/42.4/46/50.2 kt at 0 deg), "
        "each V/sqrt(cos phi); it is applied multiplicatively to any entry speed, "
        "not anchored to specific flap/weight cases.",
        "At 2440 lb the CAS/IAS pairs match Fig 5-3 within ~0.5 kt "
        "(0 flap: 55.8<->49.6; 40 flap: 50.2<->44.1).",
        "Below ~43 KIAS Fig 5-3 is extrapolation; Fig 5-5's own curves imply a "
        "near-constant CAS-IAS offset (~5-6 kt) down to 34 KIAS.",
    ],
}
(OUT / "fits").mkdir(parents=True, exist_ok=True)
with open(OUT / "fits" / "fig_5_05.json", "w") as f:
    json.dump(out, f, indent=2)
print("wrote out/fits/fig_5_05.json")

# QA overlays
model_curves = []
for name in wfits:
    xs = np.linspace(ref_meas, wt_axis.px(1600), 120)
    ys = [spd_axis.px(float(wcurve(name, wt_axis.value(x)))) for x in xs]
    model_curves.append(np.column_stack([xs, ys]))
for v0 in fan_v0:
    xs = np.linspace(bank_axis.px(0), bank_axis.px(60), 120)
    ys = np.array([spd_axis.px(v0 * np.cos(np.radians(bank_axis.value(x))) ** -fan_e) for x in xs])
    m = np.column_stack([xs, ys])
    model_curves.append(m[m[:, 1] > 448])
qa.overlay(img, model_curves, vlines=list(wt_x) + [ref_meas] + list(bank_x),
           hlines=maj_y, path="fig_5_05_calibration.png")
qa.overlay(img, [t for t in wtracks.values()] + btracks, vlines=[], hlines=[],
           path="fig_5_05_tracks.png")
print("wrote out/qa/fig_5_05_calibration.png, fig_5_05_tracks.png")
