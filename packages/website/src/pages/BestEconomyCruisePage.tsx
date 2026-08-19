import { fig523Meta, fig523Trace } from "../charts/fig523";
import { CruisePageBase } from "./CruisePageBase";

export const chartEntry = {
  id: "fig-5-23",
  label: "Cruise — best economy (Fig 5-23)",
  Component: BestEconomyCruisePage,
};

export function BestEconomyCruisePage() {
  return <CruisePageBase mixture="bestEconomy" meta={fig523Meta} trace={fig523Trace} quirkNote="POH quirks: the full-throttle boundary is drawn only between ~9,500 and ~12,000 ft density altitude — the model never extrapolates it lower. Best economy gives up ~4 kt vs best power at equal %power for ~15% less fuel; the two cruise charts disagree by ~6% on where full throttle can still hold 65%." />;
}
