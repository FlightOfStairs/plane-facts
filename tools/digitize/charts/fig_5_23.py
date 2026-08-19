"""Fig 5-23 (PDF p.101) Best Economy Cruise Performance — digitize + fit.

Same nomograph geometry as Fig 5-21; the shared pipeline lives in
charts/fig_5_21.py. Differences: axis pixel positions (page printed at a
slightly smaller scale), slower TAS curve family, and the FULL THROTTLE
boundary is only drawn between its 75% and 65% intersections (u ~ 4.6-6.0),
never reaching the bottom axis — hence the mid-chart FT seed.

Run:  uv run python charts/fig_5_23.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fig_5_21 import CruiseChartCfg, run

CFG_5_23 = CruiseChartCfg(
    figure="5-23",
    pdf_page=101,
    title="Best Economy Cruise Performance",
    fuel_gph={"75": 8.5, "65": 7.5, "55": 6.6},
    example_tas=118.0,
    oat_major_seed={-40: 569, -20: 707, 0: 847, 40: 1127},
    tas_major_seed={90: 1548, 100: 1688, 110: 1828, 120: 1970, 130: 2110},
    hmajor_seed=[250, 390, 531, 671, 811, 952, 1090, 1229, 1369],
    panel_left=(569, 1127),
    panel_right=(1460, 2320),
    rows=(245, 1370),
    seed_tas={"55": (92.3, 0.0), "65": (102.3, 0.0), "75": (108.7, 0.0), "FT": (121.8, 5.07)},
)

if __name__ == "__main__":
    run(CFG_5_23)
