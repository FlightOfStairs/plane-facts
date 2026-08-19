import { fig521Meta, fig521Trace } from "../charts/fig521";
import { CruisePageBase } from "./CruisePageBase";

export const chartEntry = {
  id: "fig-5-21",
  label: "Cruise — best power (Fig 5-21)",
  Component: BestPowerCruisePage,
};

export function BestPowerCruisePage() {
  return <CruisePageBase mixture="bestPower" meta={fig521Meta} trace={fig521Trace} quirkNote="POH quirks: the chart's own printed example (122.5 kt) sits ~1 kt above its drawn curves — the model follows the curves. The PA lattice is an exact density-altitude collapse; guide lines above 14,000 ft are drawn but unlabeled. Aloft, the full-throttle boundary is ~2–3 points more optimistic than the engine chart's (Fig 5-15) power lapse." />;
}
