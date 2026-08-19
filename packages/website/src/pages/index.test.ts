import { describe, expect, test } from "vitest";
import { CHART_PAGES, chartTitle } from "./index";

describe("chart titles", () => {
  test("drops the figure number and appends the site name", () => {
    expect(chartTitle("Weight & balance (Fig 6-15)")).toBe("Weight & balance - PlaneFacts");
    expect(chartTitle("Takeoff ground roll — flaps 25° (Fig 5-11)")).toBe("Takeoff ground roll — flaps 25° - PlaneFacts");
  });

  test("leaves a label with no figure number alone", () => {
    expect(chartTitle("About the models & method")).toBe("About the models & method - PlaneFacts");
  });

  test("every registered page yields a title with no figure number left in it", () => {
    for (const page of CHART_PAGES) {
      expect(chartTitle(page.label)).not.toMatch(/\(Fig/);
      expect(chartTitle(page.label)).toMatch(/ - PlaneFacts$/);
    }
  });
});
