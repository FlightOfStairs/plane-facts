/**
 * Chart page registry, in POH figure order. Each page module exports a
 * `chartEntry = { id, label, Component }`.
 */
import type { ComponentType } from "react";
import { chartEntry as fig511 } from "./TakeoffGroundRoll25Page";

export interface ChartEntry {
  id: string;
  label: string;
  Component: ComponentType;
}

export const CHART_PAGES: ChartEntry[] = [fig511];
