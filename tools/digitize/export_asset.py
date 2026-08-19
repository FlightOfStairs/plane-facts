"""Export web assets: deskewed/cropped/downsampled chart scan + calibration
metadata JSON whose axes are expressed in the ASSET's pixel coordinates.

Per-chart configs live in ASSETS below; Phase D adds one entry per chart.
Run:  uv run python export_asset.py [fig-5-11 ...]
Writes packages/website/public/charts/<id>.png and
       packages/website/src/charts/<id>.meta.json
"""

import json
import sys
from pathlib import Path

import cv2

from digitize import raster

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "packages" / "website" / "public" / "charts"
META = ROOT / "packages" / "website" / "src" / "charts"

# Axis spec: value at px0 (original page coords) and px per unit (sign matters:
# y axes typically negative pxPerUnit since values grow upward).
ASSETS: dict[str, dict] = {
    "fig-5-11": {
        "pdfPage": 95,
        "title": "25° Flaps Takeoff Ground Roll (Fig 5-11)",
        "crop": [300, 260, 2400, 1500],  # x0, y0, x1, y1 in original px
        "scale": 0.5,
        "axes": {
            "distanceFt": {"px0": 1363.14, "v0": 0, "pxPerUnit": -0.298819, "orient": "y"},
            "oatC": {"px0": 439.73, "v0": -40, "pxPerUnit": 7.4897, "orient": "x"},
            "weightLb": {"px0": 1189.5, "v0": 2300, "pxPerUnit": -0.747, "orient": "x"},
            "windKt": {"px0": 1711.51, "v0": 0, "pxPerUnit": 15.046, "orient": "x"},
        },
    },
}


def export(asset_id: str) -> None:
    cfg = ASSETS[asset_id]
    img, angle = raster.prepared_page(cfg["pdfPage"])
    x0, y0, x1, y1 = cfg["crop"]
    scale = cfg["scale"]
    crop = img[y0:y1, x0:x1]
    out = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    PUB.mkdir(parents=True, exist_ok=True)
    META.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(PUB / f"{asset_id}.png"), out, [cv2.IMWRITE_PNG_COMPRESSION, 9])

    axes = {}
    for name, ax in cfg["axes"].items():
        off = y0 if ax["orient"] == "y" else x0
        axes[name] = {
            "px0": (ax["px0"] - off) * scale,
            "v0": ax["v0"],
            "pxPerUnit": ax["pxPerUnit"] * scale,
            "orient": ax["orient"],
        }
    meta = {
        "id": asset_id,
        "title": cfg["title"],
        "pdfPage": cfg["pdfPage"],
        "image": f"/charts/{asset_id}.png",
        "widthPx": out.shape[1],
        "heightPx": out.shape[0],
        "deskewDeg": round(angle, 3),
        "axes": axes,
    }
    (META / f"{asset_id}.meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"{asset_id}: {out.shape[1]}x{out.shape[0]} px, "
          f"{(PUB / f'{asset_id}.png').stat().st_size // 1024} KiB")


if __name__ == "__main__":
    ids = sys.argv[1:] or list(ASSETS)
    for asset_id in ids:
        export(asset_id)
