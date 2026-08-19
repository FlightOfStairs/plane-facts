import type { ReactNode } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import type { ChartMeta, Polyline, SECTION_COLORS } from "../charts/types";
import type { SafetyFactorsState } from "../lib/useSafetyFactors";
import { GENERAL_FACTOR } from "../model/caaSafetyFactors";
import { ChartOverlay } from "./ChartOverlay";
import { ModelNotes } from "./ModelNotes";
import type { ResultRow } from "./ResultsPanel";
import { ResultsPanel } from "./ResultsPanel";
import { SafetyFactorPanel } from "./SafetyFactorPanel";
import { TraceCaption } from "./TraceCaption";

/**
 * Distances shown without the CAA general safety factor are raw chart
 * figures, with no allowance for degraded performance or pilot technique —
 * worth saying loudly wherever it is switched off.
 */
function withSafetyWarnings(warnings: string[], safety?: SafetyFactorsState): string[] {
  if (!safety || safety.inputs.generalFactor) return warnings;
  const factor = GENERAL_FACTOR[safety.op];
  return [`General safety factor (×${factor}) is switched off — these distances carry no allowance for degraded performance or variations in pilot technique. The CAA recommends applying it.`, ...warnings];
}

/**
 * Standard two-column chart page: conditions + results on the left, the
 * scan overlay and model notes on the right. Pages supply only their inputs
 * UI, result rows, trace, and notes content.
 */
export function ChartPageLayout(props: {
  meta: ChartMeta;
  polylines: Polyline[];
  marker?: [number, number];
  /** SECTION_COLORS keys the trace uses, in reading order. */
  sections: (keyof typeof SECTION_COLORS)[];
  /** Override legend labels where the default section names don't fit. */
  sectionLabels?: string[];
  /** Slider/toggle controls (may contain its own subheadings). */
  conditions: ReactNode;
  /** Fixed associated conditions, shown under the Conditions title. */
  conditionsNote?: string;
  results: ResultRow[];
  /** Small print under the results rows. */
  resultsNote?: string;
  /** Takeoff/landing pages only: CAA Safety Sense factor controls. */
  safety?: SafetyFactorsState;
  warnings: string[];
  notes: { form: string | string[]; fit: string; findings: string[] };
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Conditions
            </Typography>
            {props.conditionsNote && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {props.conditionsNote}
              </Typography>
            )}
            {props.conditions}
          </CardContent>
        </Card>
        {props.safety && <SafetyFactorPanel safety={props.safety} />}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Results
            </Typography>
            <ResultsPanel rows={props.results} warnings={withSafetyWarnings(props.warnings, props.safety)} />
            {props.resultsNote && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {props.resultsNote}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {props.meta.title}
            </Typography>
            <ChartOverlay meta={props.meta} polylines={props.polylines} marker={props.marker} />
            <TraceCaption sections={props.sections} labels={props.sectionLabels} />
          </CardContent>
        </Card>
        <ModelNotes {...props.notes} />
      </Grid>
    </Grid>
  );
}
