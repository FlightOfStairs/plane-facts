"""Fig 5-21 (PDF p.100) Best Power Cruise Performance — digitize + fit.

Also provides the shared pipeline for Fig 5-23 (best economy, PDF p.101):
both charts share the same nomograph geometry (left panel: OAT vs PA guide
lines with STANDARD TEMPERATURE diagonal on an internal density-altitude
ordinate; right panel: TAS 90-130 kt vs the same ordinate for 55/65/75%
power plus a FULL THROTTLE boundary).

Run:  uv run python charts/fig_5_21.py
"""

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

OUT_FITS = Path(__file__).resolve().parents[1] / "out" / "fits"

# ISA / atmosphere helpers (used for physics cross-checks only; the fitted
# model itself is purely empirical in (PA, OAT)).
def isa_temp_c(pa_ft: float) -> float:
    return 15.0 - 1.9812 * pa_ft / 1000.0


def sigma_of(pa_ft, oat_c):
    """Density ratio from pressure altitude + OAT."""
    pa_ft = np.asarray(pa_ft, float)
    oat_c = np.asarray(oat_c, float)
    delta = (1.0 - 6.87559e-6 * pa_ft) ** 5.2559
    theta = (oat_c + 273.15) / 288.15
    return delta / theta


def da_of_sigma(sigma):
    """Density altitude (ft) from density ratio (ISA inversion)."""
    return (1.0 - np.asarray(sigma, float) ** (1.0 / 4.2559)) / 6.87559e-6


@dataclass
class CruiseChartCfg:
    figure: str
    pdf_page: int
    title: str
    fuel_gph: dict
    example_tas: float  # printed worked example answer (5000 ft, 16 C, 75%)
    # calibration seeds (approximate x of major gridlines; snapped to detected)
    oat_major_seed: dict = field(default_factory=dict)  # value C -> approx x
    tas_major_seed: dict = field(default_factory=dict)  # value kt -> approx x
    hmajor_seed: list = field(default_factory=list)  # approx y of horizontal majors (unlabeled ordinate)
    panel_left: tuple = (0, 0)  # x range of left panel
    panel_right: tuple = (0, 0)  # x range of right panel
    rows: tuple = (0, 0)  # y range inside chart border
    # right-panel curve seeds: (TAS kt, ordinate u) point on each curve
    # (u=0 when the curve reaches the bottom axis; 5-23's FT boundary doesn't)
    seed_tas: dict = field(default_factory=dict)  # label -> (approx kt, u)


CFG_5_21 = CruiseChartCfg(
    figure="5-21",
    pdf_page=100,
    title="Best Power Cruise Performance",
    fuel_gph={"75": 10.0, "65": 8.8, "55": 7.8},
    example_tas=122.5,
    oat_major_seed={-40: 501, -20: 649, 0: 799, 40: 1097},
    tas_major_seed={90: 1544, 100: 1695, 110: 1845, 120: 1995, 130: 2145},
    hmajor_seed=[253, 402, 553, 702, 851, 1000, 1150, 1300, 1447],
    panel_left=(501, 1097),
    panel_right=(1500, 2340),
    rows=(253, 1448),
    seed_tas={"55": (95.4, 0.0), "65": (104.9, 0.0), "75": (113.2, 0.0), "FT": (127.3, 0.0)},
)


def detect_calibration(ink, cfg):
    """Snap seed gridline positions to detected thick lines."""
    v_mask = calibrate.line_mask(ink, "v", min_len=151)
    band = (slice(1050, cfg.rows[1] - 8), slice(cfg.panel_left[0] - 40, cfg.panel_right[1] + 60))
    v_lines = calibrate.find_lines(v_mask, "v", min_extent=250, roi=band)
    thick = [ln for ln in v_lines if ln.thickness >= 3.0]

    def snap(seed, tol=12.0):
        cand = [ln for ln in thick if abs(ln.pos - seed) <= tol]
        if not cand:
            raise RuntimeError(f"no thick vline near x={seed}")
        return max(cand, key=lambda ln: ln.thickness).pos

    oat_pts = {v: snap(x) for v, x in cfg.oat_major_seed.items()}
    tas_pts = {v: snap(x) for v, x in cfg.tas_major_seed.items()}
    oat_axis, oat_rms = calibrate.fit_axis(list(oat_pts.values()), list(oat_pts.keys()))
    tas_axis, tas_rms = calibrate.fit_axis(list(tas_pts.values()), list(tas_pts.keys()))

    h_mask = calibrate.line_mask(ink, "h", min_len=151)
    h_lines = calibrate.find_lines(
        h_mask, "h", min_extent=500, roi=(slice(cfg.rows[0] - 15, cfg.rows[1] + 15), slice(*cfg.panel_left))
    )
    hthick = [ln for ln in h_lines if ln.thickness >= 2.5]
    hpos, hidx = [], []
    for i, seed in enumerate(cfg.hmajor_seed):
        cand = [ln for ln in hthick if abs(ln.pos - seed) <= 5]
        if cand:
            hpos.append(max(cand, key=lambda ln: ln.thickness).pos)
            hidx.append(i)
    # seed list holds ALL majors top..bottom (some hidden by text boxes may go
    # undetected); index i counts majors downward from chart top.
    n_total = len(cfg.hmajor_seed) - 1
    slope, intercept = np.polyfit(hidx, hpos, 1)  # y = intercept + slope*i
    y_bottom = intercept + slope * n_total
    dy = slope
    return oat_axis, oat_rms, tas_axis, tas_rms, y_bottom, dy, oat_pts, tas_pts, hpos


def extract_left_panel(ink, cfg, oat_axis, u_of_y):
    """PA guide-line family + std-temp line. Returns (pa_lines, std_line).

    pa_lines: list of (pa_ft, centerline Nx2 (x,y), poly y(x)); std_line: poly x(y).
    """
    r0, r1 = cfg.rows
    c0, c1 = cfg.panel_left
    left = np.zeros_like(ink)
    left[r0:r1, c0:c1] = ink[r0:r1, c0:c1]
    er = cv2.erode(left.astype(np.uint8), np.ones((2, 2), np.uint8))
    mask = curves.curve_mask(er.astype(bool), angles_deg=list(np.arange(20, 51, 2.5)), length=31)
    comps = curves.components(mask, min_size=100)
    groups = [g for g in curves.group_curves(comps, deg=2, tol_px=3.0) if g.points.shape[0] > 250]

    trm = curves.curve_mask(left.T, angles_deg=list(np.arange(-26, -7, 2.0)), length=31)
    g2 = max(curves.group_curves(curves.components(trm, min_size=100), deg=2, tol_px=3.0),
             key=lambda g: g.points.shape[0])
    cl2 = curves.centerline(g2)  # (y, x)
    std_coef = np.polyfit(cl2[:, 0], cl2[:, 1], 2)  # x_std(y)

    # label each guide line by its crossing with the std-temp diagonal:
    # crossing OAT ~= 15 - 2*PA/1000 (chart ISA), crossing u ~= PA/2000.
    pa_lines = []
    ys = np.linspace(r0 + 2, r1 - 2, 600)
    xs = np.polyval(std_coef, ys)
    for g in groups:
        cl = curves.centerline(g)
        if cl.shape[0] < 40:
            continue
        coef = np.polyfit(cl[:, 0], cl[:, 1], 2)
        ok = (xs >= cl[:, 0].min() - 45) & (xs <= cl[:, 0].max() + 45)
        diff = np.abs(np.polyval(coef, xs) - ys)
        diff[~ok] = 1e9
        i = int(np.argmin(diff))
        if diff[i] > 30:
            continue  # no crossing in extent (corner hatching)
        pa_est_t = (15.0 - oat_axis.value(xs[i])) / 2.0 * 1000.0  # from temperature
        pa_est_u = u_of_y(ys[i]) * 2000.0  # from ordinate
        pa = round(np.mean([pa_est_t, pa_est_u]) / 1000.0) * 1000.0
        if abs(pa_est_u - pa) > 400 or abs(pa_est_t - pa) > 700 or pa < 0:
            continue
        pa_lines.append((pa, cl, coef, pa_est_t, pa_est_u))
    pa_lines.sort(key=lambda t: t[0])
    return pa_lines, std_coef


def trace_right_curves(ink, cfg, tas_axis, y_bottom, dy, erase=()):
    """Seeded snake trace of the 55/65/75/FT curves.

    Each curve is seeded at (TAS, u) from cfg.seed_tas and traced in 6-px y
    strips both upward and downward from the seed (5-23's FT boundary starts
    mid-chart, never reaching the bottom axis).
    erase: list of (y0, y1, x0, x1) pixel rects removed from the mask first
    (the chart's dashed worked-example trace runs within px of the 75 curve).
    Returns dict label -> centerline Nx2 (x, y) samples.
    """
    r0, r1 = cfg.rows
    c0, c1 = cfg.panel_right
    right = np.zeros_like(ink)
    right[r0:r1, c0:c1] = ink[r0:r1, c0:c1]
    mask = curves.curve_mask(right.T, angles_deg=list(np.arange(-45, 31, 2.5)), length=31).T
    for y0, y1, x0, x1 in erase:
        mask[int(y0):int(y1), int(x0):int(x1)] = 0
    ys_all, xs_all = np.nonzero(mask)

    strip = 6
    y_hi = int(min(y_bottom, r1 - 1))

    def march(x_seed, y_start, step, stop_on_x_drop=False):
        """Trace from (x_seed, y_start) in y-direction `step` (+down/-up).

        stop_on_x_drop: used for the down-march of a mid-chart-seeded FT
        boundary — marching down, FT's TAS (x) rises monotonically to its
        maximum at the 75%-curve junction where the boundary ends; without
        this stop the snake would round the corner and follow the 75% curve.
        """
        pts = []
        pred = x_seed
        slope = 0.0
        miss = 0
        x_max = -1e9
        for y_top in range(y_start, r0 if step < 0 else y_hi - strip, step):
            gate = 7 if pts else 22  # wide gate until first lock
            sel = (ys_all >= y_top) & (ys_all < y_top + strip)
            xs = np.sort(xs_all[sel])
            best = None
            if xs.size:
                brk = np.flatnonzero(np.diff(xs) > 5)
                for a, b in zip(np.r_[0, brk + 1], np.r_[brk, xs.size - 1]):
                    if b - a + 1 < 3:
                        continue
                    ctr = float(xs[a : b + 1].mean())
                    if abs(ctr - pred) <= gate and (best is None or abs(ctr - pred) < abs(best - pred)):
                        best = ctr
            if best is not None:
                x_max = max(x_max, best)
                if stop_on_x_drop and best < x_max - 3.0:
                    break  # rounded the junction corner onto the 75% curve
                pts.append((y_top + strip / 2.0, best))
                miss = 0
                if len(pts) >= 5:
                    p = np.array(pts[-12:])
                    slope = np.polyfit(p[:, 0], p[:, 1], 1)[0]
                pred = best + slope * step
            else:
                miss += 1
                pred += slope * step
                if miss * strip > 130:
                    break
        return pts

    out = {}
    for label, (tas0, u0) in cfg.seed_tas.items():
        x_seed = tas_axis.px(tas0)
        y_seed = int(round(y_bottom - u0 * dy))
        pts = march(x_seed, min(y_seed - strip, y_hi - strip), -strip)  # upward
        if y_seed < y_hi - 2 * strip:  # seed mid-chart: also trace downward
            pts += march(x_seed, y_seed, strip, stop_on_x_drop=True)
        if len(pts) < 10:
            raise RuntimeError(f"trace failed for {label} (seed {tas0} kt @u={u0}): {len(pts)} strips")
        arr = np.array([(x, y) for y, x in pts])
        arr = arr[np.argsort(arr[:, 1])]
        out[label] = arr[np.concatenate([[True], np.diff(arr[:, 1]) > 0.1])]  # dedupe strips
    return out


def run(cfg: CruiseChartCfg):
    tag = cfg.figure.replace("-", "_")
    img, angle = raster.prepared_page(cfg.pdf_page)
    ink = raster.binarize(img)
    print(f"=== Fig {cfg.figure} (page {cfg.pdf_page}), deskew {angle:+.2f} deg ===")

    oat_axis, oat_rms, tas_axis, tas_rms, y_bottom, dy, oat_pts, tas_pts, hpos = detect_calibration(ink, cfg)
    print(f"OAT axis: 0C at x={oat_axis.px(0):.1f}, {oat_axis.px_per_unit:.3f} px/C (rms {oat_rms:.2f} px)")
    print(f"TAS axis: 90kt at x={tas_axis.px(90):.1f}, {tas_axis.px_per_unit:.3f} px/kt (rms {tas_rms:.2f} px)")
    print(f"ordinate: bottom major y={y_bottom:.1f}, {dy:.2f} px per major (2000 ft DA)")

    def u_of_y(y):
        return (y_bottom - np.asarray(y, float)) / dy

    def y_of_u(u):
        return y_bottom - np.asarray(u, float) * dy

    # ---- left panel ----
    pa_lines, std_coef = extract_left_panel(ink, cfg, oat_axis, u_of_y)
    print(f"\nleft panel: {len(pa_lines)} PA guide lines labeled:")
    for pa, cl, coef, pt, pu in pa_lines:
        print(f"  PA {pa:6.0f}: std-cross T-> {pt:7.0f} u-> {pu:7.0f}  x [{cl[:,0].min():.0f},{cl[:,0].max():.0f}]")

    # fit u = f(PA, OAT): plane + optional quadratic refinement
    rows_fit = []
    for pa, cl, coef, *_ in pa_lines:
        xs = np.linspace(cl[:, 0].min(), cl[:, 0].max(), 40)
        for x in xs:
            rows_fit.append((pa, oat_axis.value(x), u_of_y(np.polyval(coef, x))))
    F = np.array(rows_fit)
    PA_, T_, U_ = F[:, 0], F[:, 1], F[:, 2]
    A1 = np.column_stack([np.ones_like(PA_), PA_, T_])
    c1, *_ = np.linalg.lstsq(A1, U_, rcond=None)
    r1_ = U_ - A1 @ c1
    A2 = np.column_stack([np.ones_like(PA_), PA_, T_, PA_ * T_, PA_**2, T_**2])
    c2, *_ = np.linalg.lstsq(A2, U_, rcond=None)
    r2_ = U_ - A2 @ c2
    print(f"\nleft fit: plane rms {np.sqrt(np.mean(r1_**2)):.4f} u  | quad rms {np.sqrt(np.mean(r2_**2)):.4f} u")
    print(f"  plane: u = {c1[0]:.4f} + {c1[1]*1e3:.5f}e-3*PA + {c1[2]:.5f}*OAT")
    print(f"  quad:  c = {c2}")

    def u_model(pa, oat, coefv=None):
        coefv = c2 if coefv is None else coefv
        pa = np.asarray(pa, float)
        oat = np.asarray(oat, float)
        return (coefv[0] + coefv[1] * pa + coefv[2] * oat + coefv[3] * pa * oat
                + coefv[4] * pa**2 + coefv[5] * oat**2)

    # std temp line in chart units: OAT_std(u)
    ys = np.linspace(cfg.rows[0] + 2, min(y_bottom, cfg.rows[1] - 2), 100)
    std_pts = np.column_stack([u_of_y(ys) * 2000.0, oat_axis.value(np.polyval(std_coef, ys))])  # (DA, OAT)
    std_lin = np.polyfit(std_pts[:, 0], std_pts[:, 1], 1)
    print(f"std-temp line: OAT = {std_lin[1]:.2f} {std_lin[0]*1000:+.3f}/1000ft * DA  (ISA: 15 -1.981)")

    # ---- right panel ----
    # erase the dashed worked-example trace (vertical drop at the printed TAS,
    # horizontal run at the example's ordinate) before tracing
    ex_u = float(u_model(5000.0, 16.0))
    ex_x = tas_axis.px(cfg.example_tas)
    ex_y = float(y_of_u(ex_u))
    erase = [(ex_y - 16, y_bottom, ex_x - 7, ex_x + 7), (ex_y - 7, ex_y + 7, 0, ink.shape[1])]
    traces = trace_right_curves(ink, cfg, tas_axis, y_bottom, dy, erase=erase)

    # The printed constant-power curves TERMINATE on the full-throttle
    # boundary (75% ends where FT crosses it; FT itself ends on the 65 curve).
    # The snake traces run on past the merge point (they follow the FT hook),
    # so truncate each power curve where its trace first merges with FT, and
    # truncate FT where it merges with the next power curve down.
    inter = {}

    def merge_u(a, b, tol=5.0):
        """Lowest u where traces a and b come within tol px (None if never)."""
        ya = a[:, 1]
        xb = np.interp(ya, b[:, 1], b[:, 0])  # traces are sorted by ascending y
        close = np.abs(a[:, 0] - xb) < tol
        idx = np.nonzero(close)[0]
        if idx.size == 0:
            return None
        y_first = ya[idx].max()  # bottom-most merge (largest y = lowest u)
        return float(u_of_y(y_first))

    for label in ("75", "65", "55"):
        um = merge_u(traces[label], traces["FT"])
        if um is not None:
            inter[label] = {"u": um, "da_ft": um * 2000.0}
        keep_u = um - 0.06 if um is not None else 99.0
        arr = traces[label]
        traces[label] = arr[u_of_y(arr[:, 1]) <= keep_u]
    if "65" in inter:  # FT boundary is drawn down to the 65 curve, then stops
        arr = traces["FT"]
        traces["FT"] = arr[u_of_y(arr[:, 1]) <= inter["65"]["u"] + 0.05]

    fits = {}
    print("\nright panel curves (TAS = g(u), poly in u):")
    for label, arr in traces.items():
        u = u_of_y(arr[:, 1])
        tas = tas_axis.value(arr[:, 0])
        deg = 3 if label == "FT" else 2
        q = np.polyfit(u, tas, deg)
        rms = np.sqrt(np.mean((np.polyval(q, u) - tas) ** 2))
        fits[label] = {"poly_u": q, "u_range": (float(u.min()), float(u.max())), "rms_kt": float(rms),
                       "n": len(u), "tas0": float(np.polyval(q, 0))}
        print(f"  {label}: n={len(u)} u [{u.min():.2f},{u.max():.2f}] TAS0={np.polyval(q,0):.1f} "
              f"top={tas[np.argmax(u)]:.1f}@u={u.max():.2f} rms={rms:.2f} kt  q={q}")

    for label, d in inter.items():
        d["tas_kt"] = float(np.polyval(fits["FT"]["poly_u"], d["u"]))
        # PA at ISA producing this ordinate
        pas = np.linspace(0, 16000, 3201)
        j = np.argmin(np.abs(u_model(pas, isa_temp_c(pas)) - d["u"]))
        d["pa_isa_ft"] = float(pas[j])
        print(f"  FT boundary meets {label}% at u={d['u']:.2f} (DA {d['da_ft']:.0f} ft, "
              f"PA@ISA {d['pa_isa_ft']:.0f} ft), TAS {d['tas_kt']:.1f} kt")

    # ---- QA overlay ----
    olines = []
    for pa, cl, coef, *_ in pa_lines:
        xs = np.linspace(cl[:, 0].min(), cl[:, 0].max(), 80)
        olines.append(np.column_stack([xs, np.polyval(coef, xs)]))
    ysq = np.linspace(cfg.rows[0] + 2, cfg.rows[1] - 4, 80)
    olines.append(np.column_stack([np.polyval(std_coef, ysq), ysq]))
    for label, f in fits.items():
        uu = np.linspace(f["u_range"][0], f["u_range"][1], 80)
        olines.append(np.column_stack([tas_axis.px(np.polyval(f["poly_u"], uu)), y_of_u(uu)]))
    qa.overlay(img, olines,
               vlines=list(oat_pts.values()) + list(tas_pts.values()),
               hlines=list(hpos) + [y_bottom],
               path=f"fig_{tag}_fit.png")
    print(f"\nQA overlay: out/qa/fig_{tag}_fit.png")

    # ---- worked example ----
    ex_pa, ex_oat = 5000.0, 16.0
    u_ex = float(u_model(ex_pa, ex_oat))
    tas_ex = float(np.polyval(fits["75"]["poly_u"], u_ex))
    err = (tas_ex - cfg.example_tas) / cfg.example_tas * 100
    print(f"\nworked example: PA {ex_pa:.0f}, OAT {ex_oat:.0f}C, 75% -> u={u_ex:.3f} (DA {u_ex*2000:.0f} ft) "
          f"-> TAS {tas_ex:.1f} kt (printed {cfg.example_tas}) err {err:+.2f}%")

    # ---- physics: TAS*sqrt(sigma) along each power curve ----
    print("\nCAS-equivalence check (TAS*sqrt(sigma) at ISA along each curve):")
    for label, f in fits.items():
        uu = np.linspace(max(0, f["u_range"][0]), f["u_range"][1], 7)
        da = uu * 2000
        sig = (1 - 6.87559e-6 * da) ** 4.2559
        cas = np.polyval(f["poly_u"], uu) * np.sqrt(sig)
        print(f"  {label}: EAS {cas.min():.1f}..{cas.max():.1f} kt (spread {cas.max()-cas.min():.1f})")

    # ---- full-throttle analysis ----
    # implied FT power fraction vs sigma (interpolating across the 55/65/75
    # constant-power curve fits, extrapolated modestly past their termini)
    lapse = []
    u_lo = max(2.0, np.ceil(fits["FT"]["u_range"][0] * 4) / 4)  # no FT extrapolation
    for uu in np.arange(u_lo, min(8.0, fits["FT"]["u_range"][1]) + 0.01, 0.25):
        t_ft = np.polyval(fits["FT"]["poly_u"], uu)
        ps = np.array([55.0, 65.0, 75.0])
        ts = np.array([np.polyval(fits[l]["poly_u"], uu) for l in ("55", "65", "75")])
        if t_ft < ts.min() - 2 or t_ft > ts.max() + 6:
            continue
        pw = float(np.polyval(np.polyfit(ts, ps, 2), t_ft))
        da = uu * 2000
        sig = (1 - 6.87559e-6 * da) ** 4.2559
        gf = (sig - 0.117) / 0.883 * 100
        lapse.append({"u": float(uu), "da_ft": float(da), "sigma": float(sig),
                      "ft_pct": pw, "gagg_ferrar_pct": float(gf)})
    print("\nimplied full-throttle power lapse (vs Gagg-Ferrar (sigma-0.117)/0.883):")
    for r in lapse:
        print(f"  DA {r['da_ft']:6.0f} sigma {r['sigma']:.3f}: FT {r['ft_pct']:5.1f}%  GF {r['gagg_ferrar_pct']:5.1f}%")

    # ---- emit JSON ----
    curves_json = []
    for pa, cl, coef, *_ in pa_lines:
        xs = np.linspace(cl[:, 0].min(), cl[:, 0].max(), 25)
        pts = [[round(float(oat_axis.value(x)), 2), round(float(u_of_y(np.polyval(coef, x)) * 2000), 0)] for x in xs]
        curves_json.append({"label": f"PA {pa:.0f} ft", "axes": ["OAT_C", "DA_ft"], "points": pts})
    curves_json.append({"label": "standard temperature", "axes": ["OAT_C", "DA_ft"],
                        "points": [[round(float(o), 2), round(float(d), 0)] for d, o in std_pts[::4]]})
    for label, arr in traces.items():
        pts = [[round(float(tas_axis.value(x)), 2), round(float(u_of_y(y) * 2000), 0)] for x, y in arr[::4]]
        curves_json.append({"label": {"FT": "full throttle"}.get(label, label + "% power"),
                            "axes": ["TAS_kt", "DA_ft"], "points": pts})

    result = {
        "figure": cfg.figure,
        "pdfPage": cfg.pdf_page,
        "title": cfg.title,
        "deskewDeg": round(angle, 2),
        "calibration": {
            "OAT_C": {"px0": oat_axis.px0, "v0": oat_axis.v0, "pxPerUnit": oat_axis.px_per_unit},
            "TAS_kt": {"px0": tas_axis.px0, "v0": tas_axis.v0, "pxPerUnit": tas_axis.px_per_unit},
            "ordinate_DA_ft": {"px0": float(y_bottom), "v0": 0.0, "pxPerUnit": -float(dy) / 2000.0},
        },
        "model": {
            "form": ("u = DA/2000 = c0 + c1*PA + c2*OAT + c3*PA*OAT + c4*PA^2 + c5*OAT^2 ; "
                     "TAS_pct = poly(q_pct, u) ; TAS_FT = poly(q_FT, u) ; "
                     "TAS limited to min(TAS_pct, TAS_FT-boundary); subtract 7 kt without wheel fairings"),
            "params": {
                "u_coeffs": [float(v) for v in c2],
                "u_plane_coeffs": [float(v) for v in c1],
                "q_55": [float(v) for v in fits["55"]["poly_u"]],
                "q_65": [float(v) for v in fits["65"]["poly_u"]],
                "q_75": [float(v) for v in fits["75"]["poly_u"]],
                "q_FT": [float(v) for v in fits["FT"]["poly_u"]],
                "u_range": {k: fits[k]["u_range"] for k in fits},
                "std_temp_line_OAT_of_DA": [float(v) for v in std_lin],
                "fuel_gph": cfg.fuel_gph,
            },
            "rmsPct": round(float(np.sqrt(np.mean(r2_**2))) / 8 * 100, 2),  # u rms as % of full-scale ordinate
            "rmsKt": {k: round(fits[k]["rms_kt"], 2) for k in fits},
        },
        "curves": curves_json,
        "workedExample": {
            "inputs": {"PA_ft": ex_pa, "OAT_C": ex_oat, "power_pct": 75},
            "printed": {"TAS_kt": cfg.example_tas},
            "model": {"u": round(u_ex, 3), "DA_ft": round(u_ex * 2000), "TAS_kt": round(tas_ex, 1)},
            "errPct": round(err, 2),
        },
        "fullThrottle": {"intersections": inter, "impliedPowerLapse": lapse},
        "envelope": {
            "PA_ft": [0, 16000], "OAT_C": [-40, 40], "TAS_kt": [90, 130],
            "power_pct": [55, 75], "weight_lb": 2300,
            "notes": ["labels printed only to 14000 ft; guide lines to 16000",
                      "subtract 7 kt TAS if wheel fairings not installed"],
        },
        "notes": [
            "internal ordinate = density altitude, 2000 ft per major gridline, 0 at bottom",
            "PA guide lines every 1000 ft (labeled every 2000)",
            "PA labels resolved via std-temp-line crossings (OAT=15-2*PA/1000, u=PA/2000)",
        ],
    }
    OUT_FITS.mkdir(parents=True, exist_ok=True)
    out_path = OUT_FITS / f"fig_{tag}.json"
    out_path.write_text(json.dumps(result, indent=1))
    print(f"\nwrote {out_path}")
    return result


if __name__ == "__main__":
    run(CFG_5_21)
