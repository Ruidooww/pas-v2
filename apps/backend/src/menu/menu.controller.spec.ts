import { describe, expect, it, vi } from "vitest";
import { MenuController } from "./menu.controller";
import type { MenuService } from "./menu.service";

describe("MenuController", () => {
  const request = {
    user: {
      userId: "admin-1",
      username: "admin@example.com",
      displayName: "Admin",
      role: "admin" as const
    }
  };

  it("delegates effective and configuration reads with the authenticated user", () => {
    const service = {
      getEffectiveMenu: vi.fn().mockReturnValue([]),
      getConfiguration: vi.fn().mockReturnValue({ defaults: [], overrides: [] })
    } as unknown as MenuService;
    const controller = new MenuController(service);

    expect(controller.getEffectiveMenu(request)).toEqual([]);
    expect(controller.getConfiguration(request)).toEqual({ defaults: [], overrides: [] });
    expect(service.getEffectiveMenu).toHaveBeenCalledWith(request.user);
    expect(service.getConfiguration).toHaveBeenCalledWith(request.user);
  });

  it("delegates override updates with the authenticated user", () => {
    const service = {
      updateOverride: vi.fn().mockReturnValue({ overrides: [] })
    } as unknown as MenuService;
    const controller = new MenuController(service);
    const body = { primaryKey: "customers", secondaryKey: "proposal_library", visible: false } as const;

    expect(controller.updateOverride(request, body)).toEqual({ overrides: [] });
    expect(service.updateOverride).toHaveBeenCalledWith(body, request.user);
  });

  it("delegates primary reset with the authenticated user", () => {
    const service = {
      resetPrimary: vi.fn().mockReturnValue({ overrides: [] })
    } as unknown as MenuService;
    const controller = new MenuController(service);

    expect(controller.resetPrimary(request, "customers")).toEqual({ overrides: [] });
    expect(service.resetPrimary).toHaveBeenCalledWith("customers", request.user);
  });
});
