export type OrganizationRole = "sales" | "technical" | "admin";

export type OrganizationUserClaims = {
  userId: string;
  username: string;
  displayName: string;
  role: OrganizationRole;
  organizationUnitId: string;
  projectGroupIds: string[];
};

export type OrganizationUnitKind = "company" | "department" | "team";

export type OrganizationUnit = {
  unitId: string;
  name: string;
  kind: OrganizationUnitKind;
  parentUnitId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectGroup = {
  projectGroupId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationState = {
  stateId: "pas-organization-state";
  units: OrganizationUnit[];
  projectGroups: ProjectGroup[];
  updatedAt: string;
};

export type CreateOrganizationUnitRequest = {
  name: string;
  kind: Exclude<OrganizationUnitKind, "company">;
  parentUnitId: string;
};

export type UpdateOrganizationUnitRequest = {
  name?: string;
  active?: boolean;
};

export type CreateProjectGroupRequest = {
  name: string;
};

export type UpdateProjectGroupRequest = {
  name?: string;
  active?: boolean;
};

export const DEFAULT_ORGANIZATION_UNIT_IDS = {
  company: "org-company",
  sales: "org-sales",
  technical: "org-technical",
  technicalPresales: "org-technical-presales",
  technicalEngineering: "org-technical-engineering",
  technicalAfterSales: "org-technical-aftersales"
} as const;

export function createDefaultOrganizationState(now = new Date().toISOString()): OrganizationState {
  return {
    stateId: "pas-organization-state",
    units: [
      createUnit(DEFAULT_ORGANIZATION_UNIT_IDS.company, "Company", "company", undefined, now),
      createUnit(DEFAULT_ORGANIZATION_UNIT_IDS.sales, "Sales Department", "department", DEFAULT_ORGANIZATION_UNIT_IDS.company, now),
      createUnit(DEFAULT_ORGANIZATION_UNIT_IDS.technical, "Technical Department", "department", DEFAULT_ORGANIZATION_UNIT_IDS.company, now),
      createUnit(DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales, "Presales Team", "team", DEFAULT_ORGANIZATION_UNIT_IDS.technical, now),
      createUnit(DEFAULT_ORGANIZATION_UNIT_IDS.technicalEngineering, "Technical Team", "team", DEFAULT_ORGANIZATION_UNIT_IDS.technical, now),
      createUnit(DEFAULT_ORGANIZATION_UNIT_IDS.technicalAfterSales, "After-sales Team", "team", DEFAULT_ORGANIZATION_UNIT_IDS.technical, now)
    ],
    projectGroups: [],
    updatedAt: now
  };
}

function createUnit(
  unitId: string,
  name: string,
  kind: OrganizationUnitKind,
  parentUnitId: string | undefined,
  now: string
): OrganizationUnit {
  return {
    unitId,
    name,
    kind,
    ...(parentUnitId ? { parentUnitId } : {}),
    active: true,
    createdAt: now,
    updatedAt: now
  };
}
