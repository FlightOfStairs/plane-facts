"""Shared helpers for the landing-chart drivers (fig_5_35, fig_5_37).

Column-band curve tracing + collinear-fragment merging, as developed for the
takeoff nomographs (fig_5_13). Kept here so both landing drivers stay in sync.
"""

import numpy as np


def col_bands(mask, x, gap=3):
    """Vertical ink bands in one column -> [(y_center, width), ...]."""
    ys = np.flatnonzero(mask[:, x])
    bands = []
    if ys.size:
        s = p = ys[0]
        for y in ys[1:]:
            if y - p > gap:
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


def merge_collinear(tracks, max_gap=140, tol=5.0, slope_tol=0.25):
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
                if abs(np.polyval(ca, xm) - np.polyval(cc, xm)) <= tol and abs(ca[0] - cc[0]) < slope_tol:
                    merged = np.vstack([a, c])
                    merged = merged[np.argsort(merged[:, 0])]
                    tracks = [t for k, t in enumerate(tracks) if k not in (i, j)] + [merged]
                    changed = True
                    break
            if changed:
                break
    return tracks


def y_at(tr, x):
    return float(np.interp(x, tr[:, 0], tr[:, 1]))
