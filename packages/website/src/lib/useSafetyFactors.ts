import type { ResultRow } from "../components/ResultsPanel";
import type { Operation, RunwaySurface, SafetyFactorInputs, SafetyFactorResult } from "../model/caaSafetyFactors";
import { SAFETY_DEFAULTS, SURFACES, safetyFactors } from "../model/caaSafetyFactors";
import { useUrlState } from "./urlState";

export interface SafetyFactorsState {
  op: Operation;
  inputs: SafetyFactorInputs;
  set: (patch: Partial<SafetyFactorInputs>) => void;
  result: SafetyFactorResult;
}

// Widened: the URL can carry any string, whatever the declared type says.
const DEFAULT_SURFACE: string = SAFETY_DEFAULTS.surface;

function isRunwaySurface(value: string): value is RunwaySurface {
  return Object.hasOwn(SURFACES, value);
}

/** URL-persisted CAA Safety Sense inputs plus the resulting factor. */
export function useSafetyFactors(op: Operation): SafetyFactorsState {
  const [raw, setRaw] = useUrlState({
    surface: DEFAULT_SURFACE,
    adverseSlope: SAFETY_DEFAULTS.adverseSlope,
    generalFactor: SAFETY_DEFAULTS.generalFactor,
  });

  const inputs: SafetyFactorInputs = {
    // A hand-edited URL could carry any string; fall back to the default.
    surface: isRunwaySurface(raw.surface) ? raw.surface : SAFETY_DEFAULTS.surface,
    adverseSlope: raw.adverseSlope,
    generalFactor: raw.generalFactor,
  };

  return { op, inputs, set: setRaw, result: safetyFactors(op, inputs) };
}

/**
 * The output badge for a factored distance. It sits at the *chart* value —
 * the factored distance is not a point on the printed scan, so plotting it
 * there would misrepresent the chart — and notes the factored figure alongside
 * so the number to plan with is still on the picture.
 */
export function factoredBadge(anchor: string, label: string, pohValueFt: number, safety: SafetyFactorsState) {
  const { total } = safety.result;
  const poh = `${Math.round(pohValueFt)} ft`;
  const factored = `${Math.round(pohValueFt * total)} ft`;
  return {
    anchor,
    value: pohValueFt,
    text: poh,
    // No caption: the bracketed second number is there to stop the chart
    // figure being read as the only one that matters. The results panel
    // beside it spells out which is which.
    secondaryText: total === 1 ? undefined : `(${factored})`,
    label: total === 1 ? `${label}, POH chart ${poh}` : `${label}, POH chart ${poh}, CAA factored ${factored}`,
  };
}

/**
 * Result rows presenting the factored distance first (the number to plan
 * with) and the raw POH chart value beneath it.
 */
export function factoredRows(label: string, pohValueFt: number, safety: SafetyFactorsState): ResultRow[] {
  const { total, terms } = safety.result;
  if (total === 1) {
    return [{ label: `${label} (POH chart)`, value: `${Math.round(pohValueFt)} ft`, emphasize: true }];
  }
  return [
    {
      label: `${label} — CAA factored`,
      value: `${Math.round(pohValueFt * total)} ft`,
      emphasize: true,
    },
    { label: `${label} — POH chart`, value: `${Math.round(pohValueFt)} ft`, secondary: true },
    {
      label: `Safety factor (${terms.map((t) => `×${t.factor.toFixed(2)}`).join(" ")})`,
      value: `×${total.toFixed(2)}`,
      secondary: true,
    },
  ];
}
