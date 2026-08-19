"""Performance-curve extraction via oriented morphological opening.

Erases the rectangular grid and label text by opening with line-shaped
kernels swept over the expected slope range; what survives is the (mostly
diagonal or curved) performance curves.
"""

from dataclasses import dataclass

import cv2
import numpy as np


def oriented_kernel(angle_deg: float, length: int = 31) -> np.ndarray:
    """Binary line-shaped kernel at the given angle (deg from horizontal)."""
    k = np.zeros((length, length), np.uint8)
    c = length // 2
    cv2.line(
        k,
        (c - int(np.cos(np.radians(angle_deg)) * c), c + int(np.sin(np.radians(angle_deg)) * c)),
        (c + int(np.cos(np.radians(angle_deg)) * c), c - int(np.sin(np.radians(angle_deg)) * c)),
        1,
        1,
    )
    return k


def curve_mask(
    ink: np.ndarray,
    angles_deg: list[float],
    length: int = 31,
    exclude_grid: bool = True,
    grid_min_len: int = 101,
) -> np.ndarray:
    """Union of openings over the swept angles, minus horizontal/vertical grid."""
    src = ink.astype(np.uint8)
    out = np.zeros_like(src)
    for a in angles_deg:
        out |= cv2.morphologyEx(src, cv2.MORPH_OPEN, oriented_kernel(a, length))
    if exclude_grid:
        for kernel in (np.ones((1, grid_min_len), np.uint8), np.ones((grid_min_len, 1), np.uint8)):
            grid = cv2.morphologyEx(src, cv2.MORPH_OPEN, kernel)
            grid = cv2.dilate(grid, np.ones((3, 3), np.uint8))
            out &= ~grid.astype(bool)
    return out


@dataclass
class Component:
    points: np.ndarray  # N×2 array of (x, y)

    @property
    def x(self) -> np.ndarray:
        return self.points[:, 0]

    @property
    def y(self) -> np.ndarray:
        return self.points[:, 1]


def components(mask: np.ndarray, min_size: int = 80) -> list[Component]:
    """Connected components of a curve mask, as point clouds."""
    n, labels = cv2.connectedComponents(mask.astype(np.uint8), connectivity=8)
    comps = []
    for i in range(1, n):
        ys, xs = np.nonzero(labels == i)
        if xs.size >= min_size:
            comps.append(Component(points=np.column_stack([xs, ys]).astype(np.float64)))
    return comps


def centerline(comp: Component) -> np.ndarray:
    """Reduce a stroke to per-column (x, mean y) samples."""
    xs = comp.x.astype(int)
    out = []
    for x in np.unique(xs):
        out.append((float(x), float(comp.y[xs == x].mean())))
    return np.array(out)


def fit_poly(comp: Component, deg: int = 2) -> np.ndarray:
    """Least-squares y(x) polynomial coefficients for a component."""
    cl = centerline(comp)
    return np.polyfit(cl[:, 0], cl[:, 1], deg)


def _rms(comp: Component, deg: int) -> float:
    cl = centerline(comp)
    if cl.shape[0] <= deg + 1:
        return 0.0
    coeff = np.polyfit(cl[:, 0], cl[:, 1], deg)
    return float(np.sqrt(np.mean((np.polyval(coeff, cl[:, 0]) - cl[:, 1]) ** 2)))


def group_curves(
    comps: list[Component], deg: int = 2, tol_px: float = 3.0, max_gap: float = 250.0
) -> list[Component]:
    """Agglomerative grouping of stroke fragments into whole curves.

    Repeatedly merges the pair whose COMBINED polynomial fit has the lowest
    rms residual, accepting merges only while that residual stays <= tol_px.
    Robust against crossing strokes chaining separate curves together (a
    cross-curve merge inflates the combined residual and is rejected).
    """
    groups = [c for c in comps]
    while len(groups) > 1:
        best: tuple[float, int, int] | None = None
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                gap = max(
                    groups[j].x.min() - groups[i].x.max(),
                    groups[i].x.min() - groups[j].x.max(),
                )
                if gap > max_gap:
                    continue
                cand = Component(points=np.vstack([groups[i].points, groups[j].points]))
                r = _rms(cand, deg)
                if r <= tol_px and (best is None or r < best[0]):
                    best = (r, i, j)
        if best is None:
            break
        _, i, j = best
        merged = Component(points=np.vstack([groups[i].points, groups[j].points]))
        groups = [g for k, g in enumerate(groups) if k not in (i, j)] + [merged]
    return groups
