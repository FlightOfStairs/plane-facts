import { useCallback, useEffect, useRef, useState } from "react";

type Primitive = string | number | boolean;

/** Shortest gap between two query-string writes while a value is changing. */
const URL_WRITE_INTERVAL_MS = 150;

/**
 * A `true` default infers as the literal type `true`, which would then reject
 * `false` from a toggle. Widen booleans back to `boolean`; strings and numbers
 * already widen on their own.
 */
type Widen<T> = { [K in keyof T]: T[K] extends boolean ? boolean : T[K] };

function parseParam(raw: string, fallback: Primitive): Primitive {
  if (typeof fallback === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof fallback === "boolean") return raw === "1" || raw === "true";
  return raw;
}

/**
 * useState backed by URL query parameters, so chart selection and inputs
 * survive a page refresh and are shareable as links.
 *
 * Keys present in `defaults` are read from the query string on mount; updates
 * are written back with history.replaceState. Values equal to their default
 * are removed from the URL to keep it clean. Keys not in `defaults` are left
 * untouched, so different pages can persist independent state side by side.
 */
export function useUrlState<T extends Record<string, Primitive>>(defaults: T): [Widen<T>, (patch: Partial<Widen<T>>) => void] {
  // First-render defaults, stable for the component lifetime.
  const [initialDefaults] = useState(defaults);

  const [state, setState] = useState<Widen<T>>(() => {
    const params = new URLSearchParams(window.location.search);
    const out: Record<string, Primitive> = { ...initialDefaults };
    for (const key of Object.keys(out)) {
      const raw = params.get(key);
      if (raw !== null) out[key] = parseParam(raw, out[key]!);
    }
    // oxlint-disable-next-line no-unsafe-type-assertion -- keys and value kinds come straight from `defaults`; parseParam preserves them
    return out as Widen<T>;
  });

  const update = useCallback((patch: Partial<Widen<T>>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // The URL write is a side effect of the state, not of the setter: dragging a
  // chart handle (or a slider) changes state at pointer rate, and Safari
  // rate-limits replaceState to roughly 100 calls per 30 s and then throws.
  // State stays immediate so the trace tracks the pointer; the query string
  // catches up on a trailing timer and always ends on the final value.
  const latest = useRef(state);
  const lastWriteMs = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // A pending flush reads this rather than a captured `state`, so it always
    // writes the newest value rather than the one that scheduled it.
    latest.current = state;

    const flush = () => {
      lastWriteMs.current = Date.now();
      timer.current = undefined;
      const params = new URLSearchParams(window.location.search);
      for (const key of Object.keys(latest.current) as (keyof T)[]) {
        const value = latest.current[key];
        if (value === initialDefaults[key]) {
          params.delete(String(key));
        } else {
          params.set(String(key), typeof value === "boolean" ? (value ? "1" : "0") : String(value));
        }
      }
      const query = params.toString();
      history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
    };

    const sinceMs = Date.now() - lastWriteMs.current;
    if (sinceMs >= URL_WRITE_INTERVAL_MS) {
      flush();
    } else if (timer.current === undefined) {
      // Deliberately not cancelled when state changes again: the pending flush
      // reads `latest`, so it writes whatever the newest value is when it fires.
      timer.current = setTimeout(flush, URL_WRITE_INTERVAL_MS - sinceMs);
    }
  }, [state, initialDefaults]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [state, update];
}
