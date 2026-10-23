import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import App from "./App";

// vitest runs without `globals`, so Testing Library's auto-cleanup is off. The
// URL carries page state, so it is reset too.
afterEach(() => {
  cleanup();
  history.replaceState(null, "", "/");
});

test("renders the app with title, chart picker, and disclaimer", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /Plane Facts/ })).toBeDefined();
  expect(screen.getByRole("combobox")).toBeDefined();
  expect(screen.getByText(/not a substitute for the POH/i)).toBeDefined();
});

test("the Practise tab swaps the picker and page, and drops the POH disclaimer", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("tab", { name: "Practise" }));
  expect(screen.getByRole("combobox", { name: "Practise tool" })).toBeDefined();
  // The technique, and so the answer fields, is random per leg.
  expect(screen.getAllByRole("textbox", { name: /heading/i }).length).toBeGreaterThan(0);
  expect(screen.queryByText(/not a substitute for the POH/i)).toBeNull();
  expect(document.title).toBe("Off-track correction - PlaneFacts");
});
