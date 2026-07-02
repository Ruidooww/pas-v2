import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the PAS shell heading", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "PAS" })).toBeTruthy();
    expect(screen.getByText("Presales Assistance System")).toBeTruthy();
  });
});
