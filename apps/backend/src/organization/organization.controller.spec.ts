import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OrganizationController } from "./organization.controller";
import type { OrganizationService } from "./organization.service";
import { DEFAULT_ORGANIZATION_UNIT_IDS, type OrganizationUserClaims } from "./organization.types";

describe("OrganizationController", () => {
  it("delegates organization and project-group reads", () => {
    const units = [{ unitId: DEFAULT_ORGANIZATION_UNIT_IDS.company }];
    const groups = [{ projectGroupId: "project-group-1" }];
    const service = {
      listUnits: vi.fn().mockReturnValue(units),
      listProjectGroups: vi.fn().mockReturnValue(groups)
    } as unknown as OrganizationService;
    const controller = new OrganizationController(service);

    expect(controller.listUnits(salesRequest)).toBe(units);
    expect(controller.listProjectGroups(salesRequest)).toBe(groups);
    expect(service.listUnits).toHaveBeenCalledWith(salesRequest.user);
    expect(service.listProjectGroups).toHaveBeenCalledWith(salesRequest.user);
  });

  it("delegates admin mutations", () => {
    const unit = { unitId: "org-new" };
    const group = { projectGroupId: "project-group-new" };
    const service = {
      createUnit: vi.fn().mockReturnValue(unit),
      updateUnit: vi.fn().mockReturnValue(unit),
      createProjectGroup: vi.fn().mockReturnValue(group),
      updateProjectGroup: vi.fn().mockReturnValue(group)
    } as unknown as OrganizationService;
    const controller = new OrganizationController(service);

    expect(
      controller.createUnit(adminRequest, {
        name: "Delivery Team",
        kind: "team",
        parentUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.technical
      })
    ).toBe(unit);
    expect(controller.updateUnit(adminRequest, "org-new", { active: false })).toBe(unit);
    expect(controller.createProjectGroup(adminRequest, { name: "Project Alpha" })).toBe(group);
    expect(controller.updateProjectGroup(adminRequest, "project-group-new", { active: false })).toBe(group);
  });

  it("rejects blank mutation names before calling the service", () => {
    const service = {
      createUnit: vi.fn(),
      createProjectGroup: vi.fn()
    } as unknown as OrganizationService;
    const controller = new OrganizationController(service);

    expect(() =>
      controller.createUnit(adminRequest, {
        name: " ",
        kind: "team",
        parentUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.technical
      })
    ).toThrow(BadRequestException);
    expect(() => controller.createProjectGroup(adminRequest, { name: " " })).toThrow(BadRequestException);
    expect(service.createUnit).not.toHaveBeenCalled();
    expect(service.createProjectGroup).not.toHaveBeenCalled();
  });
});

const adminRequest = { user: createUser("admin", DEFAULT_ORGANIZATION_UNIT_IDS.company) };
const salesRequest = { user: createUser("sales", DEFAULT_ORGANIZATION_UNIT_IDS.sales) };

function createUser(role: OrganizationUserClaims["role"], organizationUnitId: string): OrganizationUserClaims {
  return {
    userId: `${role}-1`,
    username: `${role}@example.com`,
    displayName: role,
    role,
    organizationUnitId,
    projectGroupIds: []
  };
}
