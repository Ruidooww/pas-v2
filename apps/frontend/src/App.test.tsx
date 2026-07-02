import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the login page when no token is stored", async () => {
    localStorage.clear();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "PAS 售前辅助系统" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /登\s*录/ })).toBeTruthy();
  });
});
