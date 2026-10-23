import { expect, test } from "vitest";
import { chartTitle } from "../pages";
import { PRACTISE_PAGES } from "./index";

test("every practise tool yields a site title", () => {
  for (const page of PRACTISE_PAGES) {
    expect(chartTitle(page.label)).toBe(`${page.label} - PlaneFacts`);
  }
});
