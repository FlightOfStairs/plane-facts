"""Phase A regression gate: re-derive Fig 5-11 (PDF p.95) axis calibration and
assert it matches the constants recorded in CLAUDE.md by the prior session.

Run:  uv run python charts/gate_5_11.py
Passes when every recorded constant reproduces within tolerance, and curve
extraction recovers the pressure-altitude guide-curve family in panel 1.
"""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from digitize import calibrate, curves, qa, raster

FAIL = []


def check(name: str, got: float, want: float, tol: float):
    ok = abs(got - want) <= tol
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: got {got:.2f}, recorded {want:.2f} (tol {tol})")
    if not ok:
        FAIL.append(name)


img, angle = raster.prepared_page(95)
ink = raster.binarize(img)
print(f"page 95: {img.shape[1]}x{img.shape[0]}, deskew {angle:+.2f} deg\n")

h_lines = calibrate.find_lines(calibrate.line_mask(ink, "h"), "h", min_extent=300)
v_lines = calibrate.find_lines(calibrate.line_mask(ink, "v"), "v", min_extent=200)


def nearest(lines, pos):
    return min(lines, key=lambda ln: abs(ln.pos - pos))


print("distance axis (0 ft baseline + 500-ft majors):")
majors_y = [nearest(h_lines, y).pos for y in (616, 766, 916, 1066, 1214, 1363)]
spacings = np.diff(majors_y)
check("0 ft baseline y", majors_y[-1], 1364.4, 3.0)
check("px per 500 ft", float(np.mean(spacings)), 149.4, 1.0)

print("OAT axis:")
x_m40 = nearest(v_lines, 440).pos
x_0 = nearest(v_lines, 739).pos
check("-40 C major x", x_m40, 439.0, 3.0)
check("0 C major x", x_0, 739.0, 3.0)
check("px per C", (x_0 - x_m40) / 40.0, 7.47, 0.05)

print("weight panel:")
check("2440 lb ref line x", nearest(v_lines, 1085).pos, 1085.0, 3.0)

print("wind panel:")
x_w0 = nearest(v_lines, 1712).pos
x_w15 = nearest(v_lines, 1937).pos
check("0 kt ref line x", x_w0, 1712.0, 3.0)
check("15 kt border x", x_w15, 1937.0, 3.0)
check("px per kt", (x_w15 - x_w0) / 15.0, 14.94, 0.15)

print("\ncurve extraction smoke test (panel 1 PA guide curves):")
# Panel 1: x in [340, 1038] (OAT region), curves slope up-left at ~20-45 deg.
panel = np.zeros_like(ink)
panel[500:1370, 340:1040] = ink[500:1370, 340:1040]
mask = curves.curve_mask(panel, angles_deg=list(np.arange(5, 61, 2.5)), length=25)
comps = curves.components(mask, min_size=50)
comps = [g for g in curves.group_curves(comps, deg=2, tol_px=3) if g.points.shape[0] > 500]
print(f"  big curve groups: {len(comps)} (expect ~6-13: PA curves, ISA line, fragments)")
if not 5 <= len(comps) <= 16:
    FAIL.append("curve extraction count")

qa.overlay(
    img,
    [curves.centerline(c) for c in comps],
    vlines=[x_m40, x_0, 1083.6, x_w0, x_w15],
    hlines=majors_y,
    path="gate_5_11.png",
)
print("  QA overlay: out/qa/gate_5_11.png")

print(f"\n{'GATE PASSED' if not FAIL else 'GATE FAILED: ' + ', '.join(FAIL)}")
sys.exit(1 if FAIL else 0)
