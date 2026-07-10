import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformPage } from "./PlatformPage";
import type { PublicUser } from "../types";

const adminUser: PublicUser = {
  userId: "admin-1",
  username: "admin",
  displayName: "Admin",
  role: "admin",
  organizationUnitId: "org-company",
  projectGroupIds: [],
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

    expect(await screen.findByText("服务暂时不可用，请稍后再试")).toBeTruthy();
    expect(screen.queryByText("platform overview unavailable")).toBeNull();
  });
});
