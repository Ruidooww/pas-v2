import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import { OrganizationService } from "./organization.service";
import { OrganizationStoreService } from "./organization-store.service";
import {
  DEFAULT_ORGANIZATION_UNIT_IDS,
  createDefaultOrganizationState,
  type OrganizationUserClaims
} from "./organization.types";

describe("OrganizationService", () => {
  it("seeds the approved hierarchy and resolves technical ancestors", () => {
    const service = createService();

    expect(service.listUnits(admin)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitId: DEFAULT_ORGANIZATION_UNIT_IDS.technical,
          parentUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.company
        }),
        expect.objectContaining({
          unitId: DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales,
          parentUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.technical
        })
      ])
    );
    expect(service.isActiveTechnicalMember(technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales))).toBe(true);
    expect(service.isActiveTechnicalMember(technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalEngineering))).toBe(true);
    expect(service.isActiveTechnicalMember(technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalAfterSales))).toBe(true);
  });

  it("rejects role membership outside the approved department subtree", () => {
    const service = createService();

    expect(() =>
      service.validateUserMembership("technical", DEFAULT_ORGANIZATION_UNIT_IDS.sales, [])
    ).toThrow(BadRequestException);
    expect(() =>
      service.validateUserMembership("sales", DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales, [])
    ).toThrow(BadRequestException);
  });

  it("fails closed when a technical unit is disabled", () => {
    const service = createService();

    service.updateUnit(admin, DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales, { active: false });

    expect(service.isActiveTechnicalMember(technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales))).toBe(false);
    expect(() =>
      service.validateUserMembership("technical", DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales, [])
    ).toThrow(BadRequestException);
  });

  it("grants organization-unit access through active ancestors", () => {
    const service = createService();
    const user = technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales);

    expect(service.isUserInAnyUnit(user, [DEFAULT_ORGANIZATION_UNIT_IDS.technical])).toBe(true);
    expect(service.isUserInAnyUnit(user, [DEFAULT_ORGANIZATION_UNIT_IDS.sales])).toBe(false);
  });

  it("validates active project groups and membership", () => {
    const service = createService();
    const group = service.createProjectGroup(admin, { name: "Project Alpha" });
    const user = { ...salesUser, projectGroupIds: [group.projectGroupId] };

    expect(service.isUserInAnyProjectGroup(user, [group.projectGroupId])).toBe(true);
    service.updateProjectGroup(admin, group.projectGroupId, { active: false });
    expect(service.isUserInAnyProjectGroup(user, [group.projectGroupId])).toBe(false);
    expect(() =>
      service.validateUserMembership("sales", DEFAULT_ORGANIZATION_UNIT_IDS.sales, [group.projectGroupId])
    ).toThrow(BadRequestException);
  });

  it("requires admin for organization mutations and audits rejections", () => {
    const auditLog = new AuditLogService();
    const service = createService(auditLog);

    expect(() => service.createProjectGroup(salesUser, { name: "Denied" })).toThrow(ForbiddenException);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "organization",
          actorUserId: salesUser.userId,
          result: "failure",
          failureReason: "ADMIN_REQUIRED"
        })
      ])
    );
  });
});

const admin: OrganizationUserClaims = {
  userId: "admin-1",
  username: "admin@example.com",
  displayName: "Admin",
  role: "admin",
  organizationUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.company,
  projectGroupIds: []
};

const salesUser: OrganizationUserClaims = {
  userId: "sales-1",
  username: "sales@example.com",
  displayName: "Sales",
  role: "sales",
  organizationUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.sales,
  projectGroupIds: []
};

function technicalUser(organizationUnitId: string): OrganizationUserClaims {
  return {
    userId: `technical-${organizationUnitId}`,
    username: `${organizationUnitId}@example.com`,
    displayName: organizationUnitId,
    role: "technical",
    organizationUnitId,
    projectGroupIds: []
  };
}

function createService(auditLog = new AuditLogService()): OrganizationService {
  const store = new OrganizationStoreService();
  store.seed(createDefaultOrganizationState("2026-07-10T00:00:00.000Z"));
  return new OrganizationService(store, auditLog);
}
