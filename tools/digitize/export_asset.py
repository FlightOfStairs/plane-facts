"""Export web assets: deskewed/cropped/downsampled chart scan + calibration
metadata JSON whose axes are expressed in the ASSET's pixel coordinates.

Per-chart configs are JSON files in assets/<id>.json (one file per chart so
parallel workers never conflict). Schema:
  { "pdfPage": N, "title": "...", "crop": [x0,y0,x1,y1], "scale": 0.5,
    "axes": { "<name>": {"px0":…, "v0":…, "pxPerUnit":…, "orient": "x"|"y"}}}
Axis spec: value v0 sits at px0 in ORIGINAL page coordinates; pxPerUnit sign
matters (y axes typically negative since values grow upward).

Run:  uv run python export_asset.py [fig-5-11 ...]     (default: all configs)
Writes packages/website/public/charts/<id>.png and
       packages/website/src/charts/<id>.meta.json
"""

import json
import sys
from pathlib import Path

import cv2

from digitize import raster

ROOT = Path(__file__).resolve().parents[2]
ASSET_CFG = Path(__file__).resolve().parent / "assets"
PUB = ROOT / "packages" / "website" / "public" / "charts"
META = ROOT / "packages" / "website" / "src" / "charts"


def export(asset_id: str) -> None:
    cfg = json.loads((ASSET_CFG / f"{asset_id}.json").read_text())
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
    ids = sys.argv[1:] or sorted(p.stem for p in ASSET_CFG.glob("*.json"))
    for asset_id in ids:
        export(asset_id)
