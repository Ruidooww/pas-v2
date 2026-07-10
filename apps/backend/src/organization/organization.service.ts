import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import { createPrefixedId } from "../ids";
import { OrganizationStoreService } from "./organization-store.service";
import {
  DEFAULT_ORGANIZATION_UNIT_IDS,
  type CreateOrganizationUnitRequest,
  type CreateProjectGroupRequest,
  type OrganizationRole,
  type OrganizationUnit,
  type OrganizationUserClaims,
  type ProjectGroup,
  type UpdateOrganizationUnitRequest,
  type UpdateProjectGroupRequest
} from "./organization.types";

export class OrganizationService {
  constructor(
    private readonly store: OrganizationStoreService,
    private readonly auditLog: AuditLogService
  ) {}

  listUnits(_actor: OrganizationUserClaims): OrganizationUnit[] {
    return this.store.getState().units;
  }

  listProjectGroups(_actor: OrganizationUserClaims): ProjectGroup[] {
    return this.store.getState().projectGroups;
  }

  createUnit(actor: OrganizationUserClaims, request: CreateOrganizationUnitRequest): OrganizationUnit {
    this.requireAdmin(actor, "organization_unit", request.name);
    const name = requireName(request.name);
    const parent = this.findActiveUnit(request.parentUnitId);
    const now = new Date().toISOString();
    const unit: OrganizationUnit = {
      unitId: createPrefixedId("org"),
      name,
      kind: request.kind,
      parentUnitId: parent.unitId,
      active: true,
      createdAt: now,
      updatedAt: now
    };
    this.store.update((state) => state.units.push(unit));
    this.recordSuccess(actor, "organization_unit", unit.unitId, "ORGANIZATION_UNIT_CREATED");
    return { ...unit };
  }

  updateUnit(
    actor: OrganizationUserClaims,
    unitId: string,
    request: UpdateOrganizationUnitRequest
  ): OrganizationUnit {
    this.requireAdmin(actor, "organization_unit", unitId);
    if (request.name === undefined && request.active === undefined) {
      throw new BadRequestException("at least one organization unit field is required");
    }
    let updated: OrganizationUnit | undefined;
    this.store.update((state) => {
      const unit = state.units.find((item) => item.unitId === unitId);
      if (!unit) throw new NotFoundException("organization unit not found");
      unit.name = request.name === undefined ? unit.name : requireName(request.name);
      unit.active = request.active ?? unit.active;
      unit.updatedAt = new Date().toISOString();
      updated = { ...unit };
    });
    this.recordSuccess(actor, "organization_unit", unitId, "ORGANIZATION_UNIT_UPDATED");
    return updated!;
  }

  createProjectGroup(actor: OrganizationUserClaims, request: CreateProjectGroupRequest): ProjectGroup {
    this.requireAdmin(actor, "project_group", request.name);
    const now = new Date().toISOString();
    const group: ProjectGroup = {
      projectGroupId: createPrefixedId("project-group"),
      name: requireName(request.name),
      active: true,
      createdAt: now,
      updatedAt: now
    };
    this.store.update((state) => state.projectGroups.push(group));
    this.recordSuccess(actor, "project_group", group.projectGroupId, "PROJECT_GROUP_CREATED");
    return { ...group };
  }

  updateProjectGroup(
    actor: OrganizationUserClaims,
    projectGroupId: string,
    request: UpdateProjectGroupRequest
  ): ProjectGroup {
    this.requireAdmin(actor, "project_group", projectGroupId);
    if (request.name === undefined && request.active === undefined) {
      throw new BadRequestException("at least one project group field is required");
    }
    let updated: ProjectGroup | undefined;
    this.store.update((state) => {
      const group = state.projectGroups.find((item) => item.projectGroupId === projectGroupId);
      if (!group) throw new NotFoundException("project group not found");
      group.name = request.name === undefined ? group.name : requireName(request.name);
      group.active = request.active ?? group.active;
      group.updatedAt = new Date().toISOString();
      updated = { ...group };
    });
    this.recordSuccess(actor, "project_group", projectGroupId, "PROJECT_GROUP_UPDATED");
    return updated!;
  }

  validateUserMembership(role: OrganizationRole, organizationUnitId: string, projectGroupIds: string[]): void {
    if (!isOrganizationRole(role)) {
      throw new BadRequestException(`unsupported organization role: ${role}`);
    }
    this.findActiveUnit(organizationUnitId);
    if (role === "technical" && !this.isUnitInActiveSubtree(organizationUnitId, DEFAULT_ORGANIZATION_UNIT_IDS.technical)) {
      throw new BadRequestException("technical role requires Technical Department membership");
    }
    if (role === "sales" && !this.isUnitInActiveSubtree(organizationUnitId, DEFAULT_ORGANIZATION_UNIT_IDS.sales)) {
      throw new BadRequestException("sales role requires Sales Department membership");
    }
    for (const projectGroupId of new Set(projectGroupIds)) {
      const group = this.store.getState().projectGroups.find((item) => item.projectGroupId === projectGroupId);
      if (!group?.active) {
        throw new BadRequestException(`active project group is required: ${projectGroupId}`);
      }
    }
  }

  isActiveTechnicalMember(user: OrganizationUserClaims): boolean {
    return (
      user.role === "technical" &&
      this.isUnitInActiveSubtree(user.organizationUnitId, DEFAULT_ORGANIZATION_UNIT_IDS.technical)
    );
  }

  isActiveRoleMember(user: OrganizationUserClaims): boolean {
    if (user.role === "technical") return this.isActiveTechnicalMember(user);
    if (user.role === "sales") {
      return this.isUnitInActiveSubtree(user.organizationUnitId, DEFAULT_ORGANIZATION_UNIT_IDS.sales);
    }
    return this.isUnitInActiveSubtree(user.organizationUnitId, DEFAULT_ORGANIZATION_UNIT_IDS.company);
  }

  isUserInAnyUnit(user: OrganizationUserClaims, unitIds: string[]): boolean {
    return unitIds.some(
      (unitId) => this.findUnit(unitId)?.active && this.isUnitInActiveSubtree(user.organizationUnitId, unitId)
    );
  }

  isUserInAnyProjectGroup(user: OrganizationUserClaims, projectGroupIds: string[]): boolean {
    const memberships = new Set(user.projectGroupIds);
    return this.store
      .getState()
      .projectGroups.some(
        (group) => group.active && memberships.has(group.projectGroupId) && projectGroupIds.includes(group.projectGroupId)
      );
  }

  private findUnit(unitId: string): OrganizationUnit | undefined {
    return this.store.getState().units.find((unit) => unit.unitId === unitId);
  }

  private findActiveUnit(unitId: string): OrganizationUnit {
    const unit = this.findUnit(unitId);
    if (!unit?.active) {
      throw new BadRequestException(`active organization unit is required: ${unitId}`);
    }
    return unit;
  }

  private isUnitInActiveSubtree(unitId: string, ancestorUnitId: string): boolean {
    const units = new Map(this.store.getState().units.map((unit) => [unit.unitId, unit]));
    let current = units.get(unitId);
    const visited = new Set<string>();
    while (current?.active && !visited.has(current.unitId)) {
      if (current.unitId === ancestorUnitId) return true;
      visited.add(current.unitId);
      current = current.parentUnitId ? units.get(current.parentUnitId) : undefined;
    }
    return false;
  }

  private requireAdmin(actor: OrganizationUserClaims, objectType: string, objectId: string): void {
    if (actor.role === "admin") return;
    this.auditLog.record({
      action: "organization",
      actorUserId: actor.userId,
      objectType,
      objectId,
      result: "failure",
      failureReason: "ADMIN_REQUIRED"
    });
    throw new ForbiddenException("admin role is required");
  }

  private recordSuccess(
    actor: OrganizationUserClaims,
    objectType: string,
    objectId: string,
    reason: string
  ): void {
    this.auditLog.record({
      action: "organization",
      actorUserId: actor.userId,
      objectType,
      objectId,
      result: "success",
      failureReason: reason
    });
  }
}

function isOrganizationRole(role: string): role is OrganizationRole {
  return role === "sales" || role === "technical" || role === "admin";
}

function requireName(value: string): string {
  const name = value.trim();
  if (!name) throw new BadRequestException("name is required");
  return name;
}
