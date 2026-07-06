import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MenuService } from "./menu.service";
import { MenuStoreService } from "./menu-store.service";

const adminUser: AuthenticatedUser = {
  userId: "admin-1",
  username: "admin@example.com",
  displayName: "Admin",
  role: "admin"
};

const salesUser: AuthenticatedUser = {
  userId: "sales-1",
  username: "sales@example.com",
  displayName: "Sales",
  role: "sales"
};

describe("MenuService", () => {
  it("returns role-filtered effective menus for sales users", () => {
    const service = createService();

    const menu = service.getEffectiveMenu(salesUser);

    expect(menu.some((item) => item.key === "system")).toBe(false);
    expect(menu.find((item) => item.key === "customers")?.children.map((item) => item.key)).toEqual([
      "customer_management",
      "customer_insights"
    ]);
  });

  it("allows admin to hide and alias a second-level menu item", () => {
    const service = createService();

    service.updateOverride(
      {
        primaryKey: "customers",
        secondaryKey: "customer_insights",
        visible: false,
        alias: "客户分析",
        roles: ["presales", "admin"],
        order: 20
      },
      adminUser
    );

    const adminMenu = service.getEffectiveMenu(adminUser);
    const customerChildren = adminMenu.find((item) => item.key === "customers")?.children ?? [];
    expect(customerChildren.some((item) => item.key === "customer_insights")).toBe(false);
  });

  it("keeps first-level menus fixed when overrides are applied", () => {
    const service = createService();

    service.updateOverride({ primaryKey: "customers", secondaryKey: "proposal_library", visible: false }, adminUser);

    expect(service.getConfiguration(adminUser).defaults.map((item) => item.key)).toEqual([
      "workbench",
      "customers",
      "knowledge_delivery",
      "business_loop",
      "platform_ops",
      "system"
    ]);
  });

  it("rejects non-admin updates", () => {
    const service = createService();

    expect(() =>
      service.updateOverride({ primaryKey: "customers", secondaryKey: "proposal_library", visible: false }, salesUser)
    ).toThrow(ForbiddenException);
  });

  it("rejects unknown second-level keys", () => {
    const service = createService();

    expect(() =>
      service.updateOverride(
        { primaryKey: "customers", secondaryKey: "qa" as never, visible: false },
        adminUser
      )
    ).toThrow(BadRequestException);
  });

  it("resets one first-level menu to defaults", () => {
    const service = createService();
    service.updateOverride({ primaryKey: "customers", secondaryKey: "proposal_library", visible: false }, adminUser);

    service.resetPrimary("customers", adminUser);

    const customerChildren = service.getEffectiveMenu(adminUser).find((item) => item.key === "customers")?.children ?? [];
    expect(customerChildren.some((item) => item.key === "proposal_library")).toBe(true);
  });
});

function createService(): MenuService {
  return new MenuService(
    new MenuStoreService(),
    {
      record: vi.fn()
    }
  );
}
