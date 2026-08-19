/**
 * Chart page registry, in POH figure order. Each page module exports a
 * `chartEntry = { id, label, Component }`.
 */
import type { ComponentType } from "react";
import { chartEntry as about } from "./AboutModelsPage";
import { chartEntry as fig503 } from "./AirspeedCalibrationPage";
import { chartEntry as fig505 } from "./StallSpeedPage";
import { chartEntry as fig507 } from "./TakeoffGroundRoll0Page";
import { chartEntry as fig509 } from "./TakeoffOver50Flaps0Page";
import { chartEntry as fig511 } from "./TakeoffGroundRoll25Page";
import { chartEntry as fig513 } from "./TakeoffOver50Flaps25Page";
import { chartEntry as fig515 } from "./EnginePerformancePage";
import { chartEntry as fig517 } from "./ClimbPerformancePage";
import { chartEntry as fig519 } from "./ClimbFuelTimeDistancePage";
import { chartEntry as fig521 } from "./BestPowerCruisePage";
import { chartEntry as fig523 } from "./BestEconomyCruisePage";
import { chartEntry as fig525 } from "./BestPowerRangePage";
import { chartEntry as fig527 } from "./BestEconomyRangePage";
import { chartEntry as fig529 } from "./EndurancePage";
import { chartEntry as fig531 } from "./DescentFuelTimeDistancePage";
import { chartEntry as fig533 } from "./GlidePerformancePage";
import { chartEntry as fig535 } from "./LandingDistance50Page";
import { chartEntry as fig537 } from "./LandingGroundRollPage";

export interface ChartEntry {
  id: string;
  label: string;
  Component: ComponentType;
}

export const CHART_PAGES: ChartEntry[] = [about, fig503, fig505, fig507, fig509, fig511, fig513, fig515, fig517, fig519, fig521, fig523, fig525, fig527, fig529, fig531, fig533, fig535, fig537];
