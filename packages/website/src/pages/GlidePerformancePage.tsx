import { fig533Meta, fig533Trace } from "../charts/fig533";
import { ChartPageLayout } from "../components/ChartPageLayout";
import { InputSlider } from "../components/InputSlider";
import { useUrlState } from "../lib/urlState";
import type { GlideInputs } from "../model/glidePerformance";
import { BEST_GLIDE_KIAS, CHART_EXAMPLE, glidePerformance } from "../model/glidePerformance";

export const chartEntry = {
  id: "fig-5-33",
  label: "Glide range (Fig 5-33)",
  Component: GlidePerformancePage,
};

export function GlidePerformancePage() {
  const [inputs, setInputs] = useUrlState<{ [K in keyof GlideInputs]: number }>(CHART_EXAMPLE);
  const result = glidePerformance(inputs);
  const { polylines, marker } = fig533Trace(inputs, result);

  const set = (k: keyof GlideInputs) => (v: number) => setInputs({ [k]: v });

  return (
    <ChartPageLayout
      meta={fig533Meta}
      polylines={polylines}
      marker={marker}
      sections={["entry", "weight", "result"]}
      sectionLabels={["cruise-altitude read", "terrain-altitude read", "result"]}
      conditionsNote={`2440 lb, prop windmilling, flaps 0°, ${BEST_GLIDE_KIAS} KIAS, no wind.`}
      conditions={
        <>
          <InputSlider label="Cruise pressure altitude" unit="ft" value={inputs.cruisePressureAltitudeFt} min={0} max={12000} step={100} onChange={set("cruisePressureAltitudeFt")} />
          <InputSlider label="Terrain pressure altitude" unit="ft" value={inputs.terrainPressureAltitudeFt} min={0} max={12000} step={100} onChange={set("terrainPressureAltitudeFt")} />
        </>
      }
      results={[
        { label: "Range reading at cruise", value: `${result.rangeCruiseNm.toFixed(1)} nm` },
        { label: "Range reading at terrain", value: `${result.rangeTerrainNm.toFixed(1)} nm` },
        { label: "Glide distance", value: `${result.glideNm.toFixed(1)} nm`, emphasize: true },
        { label: "Glide ratio", value: `${result.glideRatio.toFixed(1)} : 1` },
      ]}
      warnings={result.warnings}
      notes={{
        form: ["range(h) = (h + 85.7) / 530.47                (nm; h in ft)", "glide = range(cruise PA) − range(terrain PA)", "L/D = 6076.115 / 530.47 ≈ 11.45"],
        fit: "Straight-line fit at 0.165% rms (≈20 ft). The chart's printed example (cruise 5000 ft, terrain 2000 ft → 9.5 − 3.9 = 5.6 nm) reproduces at 9.59 − 3.93 = 5.66 nm (+1.0%).",
        findings: ["The chart is a single dead-straight line (curvature term −0.15 ft/nm² — negligible): ≈1.9 nm per 1000 ft of height.", "L/D 11.45 at 73 KIAS with the prop windmilling bootstraps a drag polar: CL 0.796, CD 0.0695 → CD₀ ≈ 0.032 with e = 0.75 — including ~0.005–0.008 of windmilling-prop drag (subtract before reusing as a clean airframe polar).", "Best-glide IAS scales as √(W/2440) below max gross; the chart's 73 KIAS is the 2440-lb value.", "The fit assumes CAS = IAS at 73 kt; Fig 5-3's ~+1 kt position-error correction is not applied — well inside the line's own scatter."],
      }}
    />
  );
}
