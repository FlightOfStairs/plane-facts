"""Load, binarize, and deskew 300-dpi POH page rasters.

Pages were produced by:  pdftoppm -png -r 300 -gray -f 90 -l 108 PA-28-161-POH.pdf out/raw/page
pdftoppm honors the PDF /Rotate flag, so landscape charts arrive landscape.
"""

from pathlib import Path

import cv2
import numpy as np

RAW_DIR = Path(__file__).resolve().parents[1] / "out" / "raw"


def load_page(pdf_page: int) -> np.ndarray:
    """Grayscale uint8 image for a 1-based PDF page number."""
    img = cv2.imread(str(RAW_DIR / f"page-{pdf_page:03d}.png"), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(f"page-{pdf_page:03d}.png not in {RAW_DIR}")
    return img


def binarize(img: np.ndarray) -> np.ndarray:
    """Boolean ink mask (True = ink). Scan is bilevel; fixed threshold is fine."""
    return img < 128


def deskew_angle(ink: np.ndarray, search_deg: float = 1.5, step: float = 0.05) -> float:
    """Rotation (deg, CCW-positive) that makes long horizontal gridlines level.

    Maximizes the peakiness (sum of squares) of the row-projection of a
    horizontally-opened version of the ink mask.
    """
    h_open = cv2.morphologyEx(
        ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 101), np.uint8)
    )
    best_angle, best_score = 0.0, -1.0
    hh, ww = h_open.shape
    center = (ww / 2, hh / 2)
    for angle in np.arange(-search_deg, search_deg + 1e-9, step):
        m = cv2.getRotationMatrix2D(center, angle, 1.0)
        rot = cv2.warpAffine(h_open, m, (ww, hh), flags=cv2.INTER_NEAREST)
        rows = rot.sum(axis=1).astype(np.float64)
        score = float((rows**2).sum())
        if score > best_score:
            best_angle, best_score = float(angle), score
    return best_angle


def deskew(img: np.ndarray, angle: float) -> np.ndarray:
    """Rotate grayscale image by `angle` deg (as returned by deskew_angle)."""
    hh, ww = img.shape
    m = cv2.getRotationMatrix2D((ww / 2, hh / 2), angle, 1.0)
    return cv2.warpAffine(
        img, m, (ww, hh), flags=cv2.INTER_LINEAR, borderValue=255
    )


def prepared_page(pdf_page: int) -> tuple[np.ndarray, float]:
    """Deskewed grayscale page + the applied angle."""
    img = load_page(pdf_page)
    angle = deskew_angle(binarize(img))
    return deskew(img, angle), angle
