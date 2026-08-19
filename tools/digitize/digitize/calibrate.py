"""Axis calibration from major (thick) gridlines.

Per the established method (CLAUDE.md): calibrate ONLY from gridline
positions — label text centers sit offset from their ticks by up to ~30 px.
Major gridlines are distinguished from minors by stroke width.
"""

from dataclasses import dataclass

import cv2
import numpy as np


def line_mask(ink: np.ndarray, orient: str, min_len: int = 101) -> np.ndarray:
    """Morphological opening keeping only long straight runs.

    orient: 'h' keeps horizontal lines, 'v' vertical.
    """
    kernel = np.ones((1, min_len), np.uint8) if orient == "h" else np.ones((min_len, 1), np.uint8)
    return cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, kernel)


@dataclass
class GridLine:
    pos: float  # sub-pixel centroid along the perpendicular axis
    thickness: float  # mean stroke width in px
    extent: int  # length along the line direction in px


def find_lines(
    mask: np.ndarray,
    orient: str,
    min_extent: int = 200,
    roi: tuple[slice, slice] | None = None,
) -> list[GridLine]:
    """Cluster a line mask into individual gridlines.

    Projects the mask along the line direction; contiguous bands of non-zero
    projection are lines. Returns centroid position, mean thickness, extent.
    roi restricts analysis to (row_slice, col_slice).
    """
    m = mask[roi] if roi is not None else mask
    axis = 1 if orient == "h" else 0  # sum along line direction
    proj = m.sum(axis=axis).astype(np.float64)  # counts per row (h) / col (v)
    lines: list[GridLine] = []
    in_band = proj > 0
    idx = np.flatnonzero(np.diff(np.concatenate(([0], in_band.view(np.int8), [0]))))
    for start, stop in zip(idx[0::2], idx[1::2]):
        seg = proj[start:stop]
        extent = int(seg.max())
        if extent < min_extent:
            continue
        pos = float((np.arange(start, stop) * seg).sum() / seg.sum())
        thickness = float(stop - start)
        if roi is not None:
            pos += (roi[0].start or 0) if orient == "h" else (roi[1].start or 0)
        lines.append(GridLine(pos=pos, thickness=thickness, extent=extent))
    return lines


def majors(lines: list[GridLine], factor: float = 1.6) -> list[GridLine]:
    """Split thick (major) from thin (minor) lines by stroke width.

    Uses a threshold at `factor` × the modal (minor) thickness.
    """
    if not lines:
        return []
    t = np.array([ln.thickness for ln in lines])
    minor = float(np.median(t))
    return [ln for ln in lines if ln.thickness >= factor * minor]


@dataclass
class Axis:
    """Linear px↔value mapping built from two anchors."""

    px0: float
    v0: float
    px_per_unit: float

    @classmethod
    def from_anchors(cls, px_a: float, v_a: float, px_b: float, v_b: float) -> "Axis":
        return cls(px0=px_a, v0=v_a, px_per_unit=(px_b - px_a) / (v_b - v_a))

    def value(self, px: float) -> float:
        return self.v0 + (px - self.px0) / self.px_per_unit

    def px(self, value: float) -> float:
        return self.px0 + (value - self.v0) * self.px_per_unit


def fit_axis(positions: list[float], values: list[float]) -> tuple[Axis, float]:
    """Least-squares linear axis through ≥2 (px, value) pairs; returns rms px residual."""
    px = np.asarray(positions, np.float64)
    v = np.asarray(values, np.float64)
    slope, intercept = np.polyfit(v, px, 1)
    rms = float(np.sqrt(np.mean((slope * v + intercept - px) ** 2)))
    return Axis(px0=float(intercept + slope * v[0]), v0=float(v[0]), px_per_unit=float(slope)), rms
