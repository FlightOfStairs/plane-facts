import { useCallback, useState } from "react";

type Primitive = string | number | boolean;

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

  const update = useCallback(
    (patch: Partial<Widen<T>>) => {
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
