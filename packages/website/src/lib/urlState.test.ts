// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useUrlState } from "./urlState";

const setUrl = (search: string) => {
  history.replaceState(null, "", search ? `/?${search}` : "/");
};

/** The query string is written on a trailing timer, so let it land. */
const settle = () => act(() => void vi.advanceTimersByTime(500));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  setUrl("");
});

describe("useUrlState", () => {
  test("initializes from defaults when URL is empty", () => {
    const { result } = renderHook(() => useUrlState({ pa: 1500, oat: 27, flaps: true }));
    expect(result.current[0]).toEqual({ pa: 1500, oat: 27, flaps: true });
  });

  test("initializes from URL params, coercing types", () => {
    setUrl("pa=5000&flaps=0&label=abc");
    const { result } = renderHook(() => useUrlState({ pa: 1500, flaps: true, label: "x" }));
    expect(result.current[0]).toEqual({ pa: 5000, flaps: false, label: "abc" });
  });

  test("writes non-default values to the URL and drops defaults", () => {
    const { result } = renderHook(() => useUrlState({ pa: 1500, oat: 27 }));
    act(() => result.current[1]({ pa: 3000 }));
    settle();
    expect(window.location.search).toBe("?pa=3000");
    act(() => result.current[1]({ pa: 1500 }));
    settle();
    expect(window.location.search).toBe("");
  });

  test("ignores malformed numbers", () => {
    setUrl("pa=bogus");
    const { result } = renderHook(() => useUrlState({ pa: 1500 }));
    expect(result.current[0].pa).toBe(1500);
  });

  test("leaves unrelated params untouched", () => {
    setUrl("chart=fig-5-11");
    const { result } = renderHook(() => useUrlState({ pa: 1500 }));
    act(() => result.current[1]({ pa: 2000 }));
    settle();
    expect(window.location.search).toContain("chart=fig-5-11");
    expect(window.location.search).toContain("pa=2000");
  });

  test("state updates immediately even though the URL write is deferred", () => {
    const { result } = renderHook(() => useUrlState({ pa: 1500 }));
    act(() => result.current[1]({ pa: 4200 }));
    // What the trace renders from — must not wait on the query string.
    expect(result.current[0].pa).toBe(4200);
  });

  test("coalesces a burst of changes into few URL writes, ending on the last value", () => {
    const { result } = renderHook(() => useUrlState({ pa: 1500 }));
    settle(); // let the mount write land, so the burst starts from a clean slate
    const writes = vi.spyOn(history, "replaceState");

    // A drag: 60 changes over ~1 s, as a pointer would produce.
    for (let i = 1; i <= 60; i++) {
      act(() => result.current[1]({ pa: 1500 + i * 10 }));
      act(() => void vi.advanceTimersByTime(16));
    }
    settle();

    // Safari throws past ~100 replaceState calls per 30 s; one per frame would
    // have been 60 here.
    expect(writes.mock.calls.length).toBeLessThanOrEqual(10);
    expect(window.location.search).toBe("?pa=2100");
    writes.mockRestore();
  });
});
