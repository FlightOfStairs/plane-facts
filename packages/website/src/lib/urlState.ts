import { useCallback, useState } from "react";

type Primitive = string | number | boolean;

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
export function useUrlState<T extends Record<string, Primitive>>(defaults: T): [T, (patch: Partial<T>) => void] {
  // First-render defaults, stable for the component lifetime.
  const [initialDefaults] = useState(defaults);

  const [state, setState] = useState<T>(() => {
    const params = new URLSearchParams(window.location.search);
    const out = { ...initialDefaults };
    for (const key of Object.keys(out) as (keyof T)[]) {
      const raw = params.get(String(key));
      // oxlint-disable-next-line no-unsafe-type-assertion -- parseParam returns the same primitive kind as the default it is given
      if (raw !== null) out[key] = parseParam(raw, out[key]!) as T[keyof T];
    }
    return out;
  });

  const update = useCallback(
    (patch: Partial<T>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        const params = new URLSearchParams(window.location.search);
        for (const key of Object.keys(next) as (keyof T)[]) {
          const value = next[key];
          if (value === initialDefaults[key]) {
            params.delete(String(key));
          } else {
            params.set(String(key), typeof value === "boolean" ? (value ? "1" : "0") : String(value));
          }
        }
        const query = params.toString();
        history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
        return next;
      });
    },
    [initialDefaults],
  );

  return [state, update];
}
