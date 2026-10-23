/**
 * Practise tool registry. Each module exports a `chartEntry`, the same shape
 * as the performance chart pages.
 */
import type { ChartEntry } from "../pages";
import { chartEntry as offTrack } from "./OffTrackPracticePage";

export const PRACTISE_PAGES: ChartEntry[] = [offTrack];
