import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";

test("renders the app with title, chart picker, and disclaimer", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /Plane Facts/ })).toBeDefined();
  expect(screen.getByText(/Ground roll/)).toBeDefined();
  expect(screen.getByText(/not a substitute for the POH/i)).toBeDefined();
});
