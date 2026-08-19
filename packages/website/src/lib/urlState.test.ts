// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { useUrlState } from "./urlState";

const setUrl = (search: string) => {
  history.replaceState(null, "", search ? `/?${search}` : "/");
};

afterEach(() => setUrl(""));

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
    expect(window.location.search).toBe("?pa=3000");
    act(() => result.current[1]({ pa: 1500 }));
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
    expect(window.location.search).toContain("chart=fig-5-11");
    expect(window.location.search).toContain("pa=2000");
  });
});
