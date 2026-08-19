"""Fig 5-15 Engine Performance (POH PDF p.97) — digitize and fit.

Chart maps (pressure altitude, OAT, %rated power) -> engine RPM for cruise,
plus a printed fuel-flow table (best power / best economy GPH at 55/65/75%).

Structure discovered:
  LEFT panel  : (OAT, PA guide line) -> unlabeled shared y. The y coordinate is
                EXACTLY density altitude: u = DA/2000 per 150-px major square
                (8 majors = DA 0..16000 ft). PA family drawn every 1000 ft from
                -2000 to +16000 (labeled every 2000 up to 14000), with a
                STANDARD TEMPERATURE (ISA) reference diagonal.
  RIGHT panel : %rated-power curves 55/65/75 vs RPM (2100..2700). Curves are
                straight lines RPM = a(p) + 23.0*(DA/1000), i.e. Piper's
                linearization of the fixed-pitch prop law N ∝ (p/σ)^(1/3).

Run:  uv run python charts/fig_5_15.py
Writes out/fits/fig_5_15.json, out/qa/fig_5_15_model.png, out/qa/fig_5_15_extraction.png
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

PAGE = 97

# ---------------------------------------------------------------- atmosphere
ISA_LAPSE_C_PER_FT = 1.9812e-3


def delta_of_pa(pa_ft):
    return (1.0 - 6.87559e-6 * pa_ft) ** 5.2559


def theta_of_oat(oat_c):
    return (oat_c + 273.15) / 288.15


def density_altitude_ft(pa_ft, oat_c):
    sigma = delta_of_pa(pa_ft) / theta_of_oat(oat_c)
    return 145442.0 * (1.0 - sigma ** (1.0 / 4.2559))


def sigma_of_da(da_ft):
    return (1.0 - da_ft / 145442.0) ** 4.2559


# ---------------------------------------------------------------- calibration
def calibrate_axes(img, ink):
    h_all = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=700)

    def nearest_h(y):
        return min(h_all, key=lambda ln: abs(ln.pos - y)).pos

    # 9 horizontal majors every ~149.75 px, top border .. bottom border
    major_y = [nearest_h(y) for y in np.arange(277.5, 1480, 149.75)]
    u_axis, u_rms = calibrate.fit_axis(major_y, list(np.arange(8, -1, -1.0)))

    # vertical majors from a clean band just above the bottom border
    band = np.zeros_like(ink)
    band[1332:1472, :] = ink[1332:1472, :]
    vl = calibrate.find_lines(calibrate.line_mask(band, "v", min_len=61), "v", min_extent=100)

    def anchors(expected, values, tol=5.0):
        px, vv = [], []
        for e, v in zip(expected, values):
            cand = min(vl, key=lambda ln: abs(ln.pos - e))
            if abs(cand.pos - e) <= tol:
                px.append(cand.pos)
                vv.append(v)
        assert len(px) >= 3, f"too few axis anchors matched: {px}"
        return px, vv

    oat_axis, oat_rms = calibrate.fit_axis(*anchors((529.5, 677.5, 827.5, 977.4, 1127.7), [-40, -20, 0, 20, 40]))
    rpm_axis, rpm_rms = calibrate.fit_axis(
        *anchors((1276.3, 1425.5, 1575.3, 1726.5, 1878.4, 2027.9, 2179.3), list(range(2100, 2701, 100)))
    )

    print(f"y (u, major units):  u=0 at y={u_axis.px(0):.1f}, {-u_axis.px_per_unit:.2f} px/unit, rms {u_rms:.2f} px")
    print(f"OAT: 0C at x={oat_axis.px(0):.1f}, {oat_axis.px_per_unit:.4f} px/C, rms {oat_rms:.2f} px")
    print(f"RPM: 2100 at x={rpm_axis.px(2100):.1f}, {rpm_axis.px_per_unit:.4f} px/RPM, rms {rpm_rms:.2f} px")
    return u_axis, oat_axis, rpm_axis, major_y


# ---------------------------------------------------------------- extraction
def extract_left(ink):
    """PA guide-curve family: diagonals in the OAT panel."""
    panel = np.zeros_like(ink)
    panel[280:1473, 531:1127] = ink[280:1473, 531:1127]
    mask = curves.curve_mask(panel, angles_deg=list(np.arange(25, 60, 2.5)), length=31, exclude_grid=False)
    comps = curves.components(mask, min_size=100)
    groups = curves.group_curves(comps, deg=2, tol_px=3.0, max_gap=300)
    groups = [g for g in groups if g.points.shape[0] > 250]
    groups.sort(key=lambda g: g.y.mean())  # top (16000 ft) first
    assert len(groups) == 18, f"expected 18 PA curves, got {len(groups)}"
    return groups  # PA = 16000 - 1000*i


def extract_right(ink):
    """%rated-power curves (steep diagonals) in the RPM panel."""
    panel = np.zeros_like(ink)
    panel[280:1473, 1140:2178] = ink[280:1473, 1140:2178]
    mask = curves.curve_mask(panel, angles_deg=list(np.arange(55, 81, 2.0)), length=51, exclude_grid=False)
    comps = curves.components(mask, min_size=120)
    big = sorted([c for c in comps if c.y.max() - c.y.min() > 300], key=lambda c: c.x.mean())
    assert len(big) == 3, f"expected 3 power curves, got {len(big)}"
    return big  # 55, 65, 75 %


def centerline_rows(comp):
    """Per-row (x, y) centerline (curves are steep in the right panel)."""
    ys = comp.y.astype(int)
    return np.array([(float(comp.x[ys == yv].mean()), float(yv)) for yv in np.unique(ys)])


# ---------------------------------------------------------------- main
def main():
    img, deskew = raster.prepared_page(PAGE)
    ink = raster.binarize(img)
    print(f"page {PAGE}: deskew {deskew:+.2f} deg")

    u_axis, oat_axis, rpm_axis, major_y = calibrate_axes(img, ink)
    u_of_y = lambda y: u_axis.value(y)
    y_of_u = lambda u: u_axis.px(u)

    # ---- left panel: PA family -> (OAT, u) samples; fit u vs density altitude
    left_groups = extract_left(ink)
    left_samples = []  # (pa, oat, u)
    left_curves_json = []
    for i, g in enumerate(left_groups):
        pa = 16000 - 1000 * i
        cl = curves.centerline(g)[::5]
        t = oat_axis.value(cl[:, 0])
        u = u_of_y(cl[:, 1])
        left_samples.append(np.column_stack([np.full_like(u, pa), t, u]))
        left_curves_json.append(
            {"label": f"PA {pa} ft", "points": [[round(a, 2), round(b, 4)] for a, b in zip(t, u)]}
        )
    L = np.vstack(left_samples)
    da = density_altitude_ft(L[:, 0], L[:, 1])
    A = np.column_stack([np.ones(len(da)), da])
    (c0, c1), *_ = np.linalg.lstsq(A, L[:, 2], rcond=None)
    rl = L[:, 2] - (c0 + c1 * da)
    left_rms_u = float(np.sqrt(np.mean(rl**2)))
    print(f"\nleft panel: u = {c0:.4f} + DA/{1/c1:.1f}  (rms {left_rms_u:.4f} u-units = "
          f"{left_rms_u * -u_axis.px_per_unit:.1f} px = {left_rms_u/c1:.0f} ft DA)")
    # forced clean form u = DA/2000
    rl2 = L[:, 2] - da / 2000.0
    print(f"forced u = DA/2000: rms {np.sqrt(np.mean(rl2**2)):.4f} u-units, max {np.abs(rl2).max():.3f}")

    # ---- right panel: power curves -> (rpm, u); fit RPM = a(p) + slope*DA
    right_comps = extract_right(ink)
    pcts = [55, 65, 75]
    right_samples = []  # (p, u, rpm)
    right_curves_json = []
    endpoints = {}
    for p, cmp_ in zip(pcts, right_comps):
        cl = centerline_rows(cmp_)[::4]
        rpm = rpm_axis.value(cl[:, 0])
        u = u_of_y(cl[:, 1])
        right_samples.append(np.column_stack([np.full_like(u, p), u, rpm]))
        top = cl[np.argmin(cl[:, 1])]
        endpoints[p] = {"maxDA_ft": round(2000 * u_of_y(top[1])), "rpmAtEnd": round(rpm_axis.value(top[0]))}
        right_curves_json.append(
            {"label": f"{p}% rated power", "points": [[round(a, 1), round(b, 4)] for a, b in zip(rpm, u)]}
        )
    R = np.vstack(right_samples)
    p_, u_, rpm_ = R.T
    da_ = 2000.0 * u_
    D = np.column_stack([(p_ == q).astype(float) for q in pcts] + [da_])
    cf, *_ = np.linalg.lstsq(D, rpm_, rcond=None)
    a55, a65, a75, slope = cf
    rr = rpm_ - D @ cf
    right_rms_rpm = float(np.sqrt(np.mean(rr**2)))
    print(f"right panel: RPM = a(p) + {slope*1000:.2f}*(DA/1000);  a = "
          f"{{55: {a55:.1f}, 65: {a65:.1f}, 75: {a75:.1f}}}  rms {right_rms_rpm:.1f} RPM")

    # physics cross-check: N = C * p^alpha * sigma^beta
    sg = sigma_of_da(da_)
    Dp = np.column_stack([np.ones(len(sg)), np.log(p_ / 100.0), np.log(sg)])
    cp, *_ = np.linalg.lstsq(Dp, np.log(rpm_), rcond=None)
    rp = np.log(rpm_) - Dp @ cp
    print(f"physics form: RPM = {np.exp(cp[0]):.1f} * (p/100)^{cp[1]:.3f} * sigma^{cp[2]:.3f}"
          f"  (rms {100*np.sqrt(np.mean(rp**2)):.2f}%)  [prop law would be ^1/3, ^-1/3]")

    # ---- assembled model + worked example
    a_of_p = {55: a55, 65: a65, 75: a75}

    def model_rpm(pa, oat_c, pct):
        d = density_altitude_ft(pa, oat_c)
        return a_of_p[pct] + slope * d, d

    rpm_ex, da_ex = model_rpm(5000, 16, 75)
    err = 100 * (rpm_ex - 2625) / 2625
    rpm_ex_phys = float(np.exp(cp[0]) * 0.75 ** cp[1] * sigma_of_da(da_ex) ** cp[2])
    print(f"\nworked example 5000 ft / 16 C / 75%: DA={da_ex:.0f} ft (u={da_ex/2000:.2f}; printed trace u=3.16)")
    print(f"  model RPM {rpm_ex:.1f} vs printed 2625  ->  {err:+.2f}%   (physics form: {rpm_ex_phys:.1f})")
    assert abs(err) < 1.0

    # ---- QA overlay: model-generated curves over the raster
    model_left = []
    for pa in range(-1000, 16001, 1000):
        t = np.linspace(-40, 40, 33)
        d = density_altitude_ft(pa, t)
        u = c0 + c1 * d
        x, y = oat_axis.px(t), y_of_u(u)
        keep = (y > 279) & (y < 1474)
        if keep.sum() > 1:
            model_left.append(np.column_stack([x[keep], y[keep]]))
    # ISA reference line implied by the model
    pa_s = np.linspace(0, 16000, 60)
    t_isa = 15.0 - ISA_LAPSE_C_PER_FT * pa_s
    isa = np.column_stack([oat_axis.px(t_isa), y_of_u(c0 + c1 * density_altitude_ft(pa_s, t_isa))])
    isa = isa[(isa[:, 1] > 279) & (isa[:, 1] < 1474)]
    model_right = []
    for q, dmax in ((55, 16000), (65, 13520), (75, 7990)):
        d = np.linspace(0, dmax, 40)
        rpmv = a_of_p[q] + slope * d
        model_right.append(np.column_stack([rpm_axis.px(rpmv), y_of_u(d / 2000.0)]))
    qa.overlay(img, model_left + [isa] + model_right,
               vlines=[oat_axis.px(v) for v in (-40, -20, 0, 20, 40)]
               + [rpm_axis.px(v) for v in range(2100, 2701, 100)],
               hlines=major_y, path="fig_5_15_model.png")
    qa.overlay(img, [curves.centerline(g) for g in left_groups] + [centerline_rows(c) for c in right_comps],
               vlines=[oat_axis.px(16), rpm_axis.px(2625)], hlines=[y_of_u(3.165)],
               path="fig_5_15_extraction.png")
    print("QA: out/qa/fig_5_15_model.png, out/qa/fig_5_15_extraction.png")

    # ---- JSON
    out = {
        "figure": "5-15",
        "pdfPage": PAGE,
        "title": "Engine Performance — (PA, OAT, %rated power) -> RPM; fuel flow table",
        "associatedConditions": "Best power mixture per Section 4 instructions; wheel fairings installed",
        "deskewDeg": round(float(deskew), 2),
        "calibration": {
            "oat_C": {"px0": u_round(oat_axis.px(0)), "v0": 0, "pxPerUnit": round(oat_axis.px_per_unit, 4)},
            "rpm": {"px0": u_round(rpm_axis.px(2100)), "v0": 2100, "pxPerUnit": round(rpm_axis.px_per_unit, 5)},
            "u_majorUnits": {"px0": u_round(u_axis.px(0)), "v0": 0, "pxPerUnit": round(u_axis.px_per_unit, 3)},
        },
        "model": {
            "form": (
                "DA = 145442*(1 - (delta/theta)^(1/4.2559)), delta=(1-6.87559e-6*PA)^5.2559, "
                "theta=(OAT_C+273.15)/288.15;  chart y-coordinate u = DA/2000 (major squares above bottom border);  "
                "RPM(p, DA) = a_p + s*DA  for p in {55,65,75} %rated power;  "
                "equivalent physics form RPM = Cphys * (p/100)^alpha * sigma_DA^beta (fixed-pitch prop law ~ (p/sigma)^(1/3))"
            ),
            "params": {
                "a_55": round(float(a55), 1),
                "a_65": round(float(a65), 1),
                "a_75": round(float(a75), 1),
                "s_rpmPerFt": round(float(slope), 5),
                "leftIntercept_u": round(float(c0), 4),
                "leftFtPerUnit": round(float(1 / c1), 1),
                "Cphys": round(float(np.exp(cp[0])), 1),
                "alpha": round(float(cp[1]), 4),
                "beta": round(float(cp[2]), 4),
            },
            "rmsPct": round(100 * right_rms_rpm / 2400, 3),
            "leftPanelRms_u": round(left_rms_u, 4),
            "rightPanelRms_rpm": round(right_rms_rpm, 2),
        },
        "fuelFlowTableGPH": {
            "bestPower": {"55": 7.8, "65": 8.8, "75": 10.0},
            "bestEconomy": {"55": 6.6, "65": 7.5, "75": 8.5},
        },
        "curves": left_curves_json + right_curves_json,
        "workedExample": {
            "inputs": {"pressureAltFt": 5000, "oatC": 16, "pctPower": 75},
            "printed": {"rpm": 2625, "fuelFlowBestPowerGPH": 10.0, "fuelFlowBestEconomyGPH": 8.5},
            "model": {"DA_ft": round(float(da_ex)), "u": round(float(da_ex / 2000), 3),
                      "rpm": round(float(rpm_ex), 1), "rpmPhysicsForm": round(rpm_ex_phys, 1)},
            "errPct": round(float(err), 2),
        },
        "envelope": {
            "oatC": [-40, 40],
            "pressureAltFt": [-2000, 16000],
            "densityAltFt": {"55": [0, 16000], "65": [0, endpoints[65]["maxDA_ft"]], "75": [0, endpoints[75]["maxDA_ft"]]},
            "rpmAxis": [2100, 2700],
            "curveEndpoints": endpoints,
        },
        "notes": [
            "Left panel is EXACTLY a density-altitude converter: u = DA/2000 (rms 0.02 major units ~= 40 ft). "
            "It is NOT a delta/sqrt(theta) power-lapse collapse (that fits 30x worse).",
            "PA guide curves drawn every 1000 ft from -2000 to 16000 (labels every 2000 up to 14000 only); "
            "curves above 14000 and below SEA LEVEL are unlabeled. The -2000 ft corner fragment was too small to fit "
            "and is excluded from curve samples.",
            "Right panel curves are straight parallel lines in (RPM, DA): Piper's linearization of the fixed-pitch "
            "prop absorption law N ~ (p/sigma)^(1/3); free joint fit gives alpha=0.37, beta=-0.31.",
            "Curve upper endpoints encode full-throttle availability: 75% ends at DA 7990 ft / 2664 RPM where "
            "(N/2700)*(delta/sqrt(theta))_ISA-at-DA = 0.754 ~= 75% (Gagg-Ferrar-like full-throttle lapse, matches to 0.5%). "
            "65% endpoint (DA 13520, 2643 RPM) implies 0.62 by the same formula vs 0.65 claimed (~5% optimistic, "
            "possibly a leaning credit); 55% runs to the chart top (DA 16000) without an interior endpoint.",
            "Standard-temperature diagonal on the chart = ISA line; model-implied ISA line overlays it in the QA image.",
            "Printed example trace measured at u=3.165 (y=1001.5 px), 2625.6 RPM (x=2067.3 px), 15.7 C - all within 5 px "
            "of the model chain.",
        ],
    }
    out_path = Path(__file__).resolve().parents[1] / "out" / "fits" / "fig_5_15.json"
    out_path.write_text(json.dumps(out, indent=1))
    print(f"wrote {out_path}")


def u_round(x):
    return round(float(x), 1)


if __name__ == "__main__":
    main()
