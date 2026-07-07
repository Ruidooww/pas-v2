import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformPage } from "./PlatformPage";
import type { PublicUser } from "../types";

const adminUser: PublicUser = {
  userId: "admin-1",
  username: "admin",
  displayName: "Admin",
  role: "admin",
  active: true
};

describe("PlatformPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an error when the initial platform overview request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: "platform overview unavailable" })
        } as Response)
      )
    );

    render(<PlatformPage user={adminUser} mode="governance" />);

    expect(await screen.findByText("platform overview unavailable")).toBeTruthy();
  });
});
