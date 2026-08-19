"""QA overlay renders: fitted curves / calibration lines drawn on the raster."""

from pathlib import Path

import cv2
import numpy as np

OUT_DIR = Path(__file__).resolve().parents[1] / "out" / "qa"


def overlay(
    img_gray: np.ndarray,
    curves_xy: list[np.ndarray],
    vlines: list[float] = (),
    hlines: list[float] = (),
    path: str | Path = "overlay.png",
) -> Path:
    """Draw sampled curves (N×2 x,y arrays, red), vertical (green) and
    horizontal (blue) calibration lines on the page; save under out/qa/."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2BGR)
    for x in vlines:
        cv2.line(canvas, (int(round(x)), 0), (int(round(x)), canvas.shape[0]), (0, 200, 0), 2)
    for y in hlines:
        cv2.line(canvas, (0, int(round(y))), (canvas.shape[1], int(round(y))), (255, 100, 0), 2)
    for xy in curves_xy:
        pts = np.round(xy).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(canvas, [pts], False, (0, 0, 255), 2)
    dest = OUT_DIR / path
    cv2.imwrite(str(dest), canvas)
    return dest
