# M9 Default Permission Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top-level `presales` role with an organization-aware `technical` role, add the approved technical-department hierarchy and project groups, and enforce one fail-closed document permission model across PAS APIs and UI.

**Architecture:** A new backend `organization` domain owns the seeded organization tree, project-group registry, membership validation, and hierarchy queries. Authenticated users carry one organization unit and zero or more project groups; `KnowledgeDocumentService` remains the single source of accessible RAGFlow document IDs and delegates hierarchy checks to `OrganizationService`. Organization metadata follows the repository's existing snapshot persistence pattern, while user membership remains on the `users` table.

**Tech Stack:** NestJS 11, TypeScript 6, Prisma 6/PostgreSQL, Vitest 4, React 19, Ant Design 6, Docker Compose.

## Global Constraints

- Target environment is an internal-network trial.
- Roles are exactly `sales`, `technical`, and `admin`; `presales` is a legacy value accepted only during migration.
- The Technical Department has Presales, Technical, and After-sales child teams.
- Every active user in the Technical Department subtree can maintain the complete knowledge catalog.
- Sales users may read only documents allowed by visibility and may not mutate knowledge metadata.
- New documents default to Technical Department visibility; existing public documents remain public.
- Authorization is fail-closed for inactive or missing units, groups, users, or policy targets.
- Do not introduce OPA, a generic ABAC DSL, BPMN, drag-and-drop organization editing, real CRM, or field-level LLM redaction.
- Keep `design-qa.md` untracked and untouched.
- Every production behavior change follows RED-GREEN-REFACTOR and is committed independently.

---

## File Map

**Create:**

- `apps/backend/src/organization/organization.types.ts` - organization and project-group contracts plus seeded IDs.
- `apps/backend/src/organization/organization.tokens.ts` - Nest injection tokens.
- `apps/backend/src/organization/organization-store.service.ts` - cloned in-memory state and persistence mirroring.
- `apps/backend/src/organization/organization-store.service.spec.ts` - state cloning and seed coverage.
- `apps/backend/src/organization/organization.service.ts` - hierarchy, validation, mutations, and audit behavior.
- `apps/backend/src/organization/organization.service.spec.ts` - permission-oriented organization tests.
- `apps/backend/src/organization/organization.controller.ts` - internal organization APIs.
- `apps/backend/src/organization/organization.controller.spec.ts` - request validation and role boundaries.
- `apps/backend/src/organization/organization.module.ts` - module wiring and state hydration.
- `apps/backend/prisma/migrations/20260710000000_m9_organization_permissions/migration.sql` - user membership columns, legacy role migration, and organization snapshot table.
- `apps/frontend/src/pages/OrganizationAccessPanel.tsx` - organization and project-group administration embedded in account management.
- `apps/frontend/src/pages/OrganizationAccessPanel.test.tsx` - administration UI tests.

**Modify:**

- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/persistence/persistence-sink.ts`
- `apps/backend/src/persistence/persistence-sink.spec.ts`
- `apps/backend/src/auth/auth.types.ts`
- `apps/backend/src/auth/user-store.service.ts`
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/auth/auth.module.ts`
- `apps/backend/src/auth/*.spec.ts`
- `apps/backend/src/menu/menu-defaults.ts`
- `apps/backend/src/menu/menu-store.service.ts`
- `apps/backend/src/menu/menu.service.ts`
- `apps/backend/src/menu/*.spec.ts`
- `apps/backend/src/knowledge/knowledge.types.ts`
- `apps/backend/src/knowledge/knowledge-document.service.ts`
- `apps/backend/src/knowledge/knowledge-document.service.spec.ts`
- `apps/backend/src/knowledge/knowledge-document.controller.spec.ts`
- `apps/backend/src/knowledge/knowledge.module.ts`
- `apps/backend/src/qa/qa.service.spec.ts`
- `apps/backend/src/ragflow/ragflow.controller.spec.ts`
- `apps/backend/src/customer-analysis/customer-analysis.service.spec.ts`
- Active backend service and test files that currently compare `role` with `presales`, including `export`, `feedback`, `platform`, `proposal`, and `business-flow`.
- `apps/frontend/src/types.ts`
- `apps/frontend/src/navigation.tsx`
- `apps/frontend/src/App.test.tsx`
- `apps/frontend/src/pages/AccountsPage.tsx`
- `apps/frontend/src/pages/SystemPages.test.tsx`
- `apps/frontend/src/pages/KnowledgeDocumentsPage.tsx`
- `apps/frontend/src/pages/KnowledgeDocumentsPage.test.tsx`
- `apps/frontend/src/pages/MenuConfigPage.tsx`
- `apps/frontend/src/pages/MenuConfigPage.test.tsx`
- `apps/frontend/src/pages/PlatformPage.tsx`
- `apps/frontend/src/pages/PlatformPage.test.tsx`
- `apps/frontend/src/styles.css`
- `docs/deployment/v1-sop.md`
- `docs/ragflow/50-question-regression-template.md`
- `docs/ragflow/v1-100-question-regression-template.md`
- `docs/superpowers/plans/status-audit-2026-07-07.md`

---

### Task 1: Organization Domain Core

**Files:**
- Create: `apps/backend/src/organization/organization.types.ts`
- Create: `apps/backend/src/organization/organization-store.service.ts`
- Create: `apps/backend/src/organization/organization-store.service.spec.ts`
- Create: `apps/backend/src/organization/organization.service.ts`
- Create: `apps/backend/src/organization/organization.service.spec.ts`

**Interfaces:**
- Produces `OrganizationUnit`, `ProjectGroup`, `OrganizationState`, `CreateOrganizationUnitRequest`, `UpdateOrganizationUnitRequest`, `CreateProjectGroupRequest`, and `UpdateProjectGroupRequest`.
- Produces deterministic IDs `org-company`, `org-sales`, `org-technical`, `org-technical-presales`, `org-technical-engineering`, and `org-technical-aftersales`.
- Produces `OrganizationService.isActiveTechnicalMember(user)`, `validateUserMembership(role, organizationUnitId, projectGroupIds)`, `isUserInAnyUnit(user, unitIds)`, and `isUserInAnyProjectGroup(user, groupIds)`.

- [ ] **Step 1: Write failing store and hierarchy tests**

```typescript
it("seeds the approved hierarchy and resolves technical ancestors", () => {
  const service = createService();
  expect(service.listUnits(admin)).toEqual(expect.arrayContaining([
    expect.objectContaining({ unitId: "org-technical", parentUnitId: "org-company" }),
    expect.objectContaining({ unitId: "org-technical-presales", parentUnitId: "org-technical" })
  ]));
  expect(service.isActiveTechnicalMember(technicalUser("org-technical-presales"))).toBe(true);
});

it("fails closed for disabled units and project groups", () => {
  const service = createService();
  service.updateUnit(admin, "org-technical-presales", { active: false });
  expect(service.isActiveTechnicalMember(technicalUser("org-technical-presales"))).toBe(false);
  expect(() => service.validateUserMembership("technical", "org-technical-presales", [])).toThrow();
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/organization/organization-store.service.spec.ts src/organization/organization.service.spec.ts
```

Expected: FAIL because the organization files and APIs do not exist.

- [ ] **Step 3: Implement the minimal organization types, seed, store, and service**

Use this state contract:

```typescript
export type OrganizationState = {
  stateId: "pas-organization-state";
  units: OrganizationUnit[];
  projectGroups: ProjectGroup[];
  updatedAt: string;
};
```

The service must clone returned data, reject blank names, reject missing or inactive parents, reject hierarchy cycles, soft-disable records, and record successful and rejected admin mutations through `AuditLogService`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the command from Step 2. Expected: both files pass.

- [ ] **Step 5: Commit the organization core**

```powershell
git add apps/backend/src/organization
git commit -m "feat: add organization permission domain"
```

---

### Task 2: Persistence, Module Wiring, And Organization APIs

**Files:**
- Create: `apps/backend/src/organization/organization.tokens.ts`
- Create: `apps/backend/src/organization/organization.controller.ts`
- Create: `apps/backend/src/organization/organization.controller.spec.ts`
- Create: `apps/backend/src/organization/organization.module.ts`
- Create: `apps/backend/prisma/migrations/20260710000000_m9_organization_permissions/migration.sql`
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes `OrganizationState` and `OrganizationService` from Task 1.
- Produces `ORGANIZATION_STORE` and `ORGANIZATION_SERVICE` tokens.
- Produces the six organization endpoints defined in the approved design.
- Produces `PersistenceSink.mirrorOrganizationState()` and `loadOrganizationState()`.

- [ ] **Step 1: Write failing controller and persistence tests**

Test that sales and technical users can list units/groups, only admins can mutate them, request bodies reject missing names, and snapshot state round-trips through the persistence sink mock.

```typescript
await expect(controller.createUnit(salesRequest, validBody)).rejects.toBeInstanceOf(ForbiddenException);
await expect(controller.listUnits(technicalRequest)).resolves.toEqual(expect.any(Array));
expect(client.organizationStateSnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
  where: { snapshotId: "pas-organization-state" }
}));
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/organization/organization.controller.spec.ts src/persistence/persistence-sink.spec.ts
```

Expected: FAIL because controller, tokens, snapshot methods, and Prisma model are absent.

- [ ] **Step 3: Add the Prisma model and SQL migration**

Add to `User`:

```prisma
organizationUnitId String?  @map("organization_unit_id")
projectGroupIds    String[] @default([]) @map("project_group_ids")
```

Add:

```prisma
model OrganizationStateSnapshot {
  snapshotId String   @id @map("snapshot_id")
  data       Json
  updatedAt  DateTime @map("updated_at")

  @@index([updatedAt])
  @@map("organization_state_snapshots")
}
```

The SQL migration adds these fields and table, converts `presales` rows to
`technical`, and assigns deterministic default organization IDs based on the
pre-migration role.

- [ ] **Step 4: Implement persistence methods, controller, module, and AppModule import**

`OrganizationModule` loads the snapshot, seeds the default state when none is
stored, mirrors that seed once, and exports `ORGANIZATION_SERVICE`.

- [ ] **Step 5: Generate Prisma and verify GREEN**

```powershell
pnpm --filter pas-backend prisma:generate
pnpm --filter pas-backend exec vitest run src/organization/organization.controller.spec.ts src/persistence/persistence-sink.spec.ts
pnpm --filter pas-backend typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit persistence and APIs**

```powershell
git add apps/backend/prisma apps/backend/src/organization apps/backend/src/persistence apps/backend/src/app.module.ts
git commit -m "feat: persist organization permissions"
```

---

### Task 3: User Claims, Membership Validation, And Role Migration

**Files:**
- Modify: `apps/backend/src/auth/auth.types.ts`
- Modify: `apps/backend/src/auth/user-store.service.ts`
- Modify: `apps/backend/src/auth/auth.service.ts`
- Modify: `apps/backend/src/auth/auth.module.ts`
- Modify: `apps/backend/src/auth/auth.service.spec.ts`
- Modify: `apps/backend/src/auth/auth.restart-hydration.spec.ts`
- Modify: `apps/backend/src/auth/jwt-token.service.spec.ts`
- Modify: `apps/backend/src/menu/menu-store.service.ts`
- Modify: `apps/backend/src/menu/menu-defaults.ts`
- Modify: `apps/backend/src/menu/menu.service.ts`
- Modify: `apps/backend/src/menu/menu.service.spec.ts`
- Modify: active backend service/test files returned by `git grep -n "presales" -- apps/backend/src`.

**Interfaces:**
- Consumes membership validation from Task 1 and organization injection from Task 2.
- Changes `UserRole` to `"sales" | "technical" | "admin"`.
- Adds `organizationUnitId: string` and `projectGroupIds: string[]` to authenticated/public/user records.
- Adds optional membership fields to create/update requests; defaults are role-specific deterministic units.

- [ ] **Step 1: Write failing auth and menu migration tests**

```typescript
it("normalizes a hydrated presales user into the technical presales team", () => {
  store.seed([legacyPresalesRecord]);
  expect(store.findById(legacyPresalesRecord.userId)).toEqual(expect.objectContaining({
    role: "technical",
    organizationUnitId: "org-technical-presales",
    projectGroupIds: []
  }));
});

it("rejects technical membership outside the technical subtree", async () => {
  await expect(service.createUser(admin, {
    username: "invalid@example.com",
    password: "StrongPassword123!",
    displayName: "Invalid",
    role: "technical",
    organizationUnitId: "org-sales",
    projectGroupIds: []
  })).rejects.toBeInstanceOf(BadRequestException);
});
```

Also seed a menu override with `roles: ["presales"]` through an unknown/legacy
payload cast and assert the resulting state contains `technical` and no
`presales`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/auth/auth.service.spec.ts src/auth/auth.restart-hydration.spec.ts src/auth/jwt-token.service.spec.ts src/menu/menu.service.spec.ts
```

Expected: FAIL on the old role and missing membership claims.

- [ ] **Step 3: Implement claims and validation**

`AuthService` injects `OrganizationService`, resolves default units, validates
explicit memberships, and returns cloned project-group arrays. `UserStore`
normalizes legacy records during seed before indexing them. JWT signing and
verification preserve the new claims, while `getMe` remains authoritative from
the current user store.

- [ ] **Step 4: Replace active role checks**

Replace authorization comparisons and active test fixtures from `presales` to
`technical` in `auth`, `business-flow`, `customer-analysis`, `export`,
`feedback`, `knowledge`, `menu`, `platform`, `proposal`, QA/RAGFlow controller
tests, and frontend-shared backend contracts. Preserve identifiers such as
historical record IDs only when they are not role values or user-facing labels.

- [ ] **Step 5: Run backend tests and typecheck**

```powershell
pnpm --filter pas-backend test
pnpm --filter pas-backend typecheck
```

Expected: all backend tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit auth and role migration**

```powershell
git add apps/backend/src/auth apps/backend/src/menu apps/backend/src/business-flow apps/backend/src/customer-analysis apps/backend/src/export apps/backend/src/feedback apps/backend/src/knowledge apps/backend/src/platform apps/backend/src/proposal apps/backend/src/qa apps/backend/src/ragflow
git commit -m "feat: migrate technical department roles"
```

---

### Task 4: Organization-Aware Knowledge Permissions

**Files:**
- Modify: `apps/backend/src/knowledge/knowledge.types.ts`
- Modify: `apps/backend/src/knowledge/knowledge-document.service.ts`
- Modify: `apps/backend/src/knowledge/knowledge-document.service.spec.ts`
- Modify: `apps/backend/src/knowledge/knowledge-document.controller.spec.ts`
- Modify: `apps/backend/src/knowledge/knowledge.module.ts`
- Modify: `apps/backend/src/qa/qa.service.spec.ts`
- Modify: `apps/backend/src/ragflow/ragflow.controller.spec.ts`
- Modify: `apps/backend/src/customer-analysis/customer-analysis.service.spec.ts`

**Interfaces:**
- Consumes `OrganizationService` and new authenticated claims.
- Extends `KnowledgeDocumentVisibility` with `organization_units` and `project_groups`.
- Keeps `getAccessibleDocumentIds(user): string[]` as the downstream retrieval contract.

- [ ] **Step 1: Write failing permission-matrix tests**

Cover every approved decision in table-driven tests:

```typescript
it.each([
  [technicalUser("org-technical-presales"), true],
  [technicalUser("org-technical-engineering"), true],
  [technicalUser("org-technical-aftersales"), true],
  [salesUser("org-sales"), false]
])("applies technical-department maintenance for %o", (user, allowed) => {
  const action = () => service.updateTags(user, "doc-1", ["updated"]);
  if (allowed) expect(action).not.toThrow();
  else expect(action).toThrow(ForbiddenException);
});
```

Add cases for descendant unit visibility, active project groups, revoked
membership, inactive targets, owner access, admin access, and legacy
`roles: ["presales"]` normalization.

- [ ] **Step 2: Run focused knowledge tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/knowledge/knowledge-document.service.spec.ts src/knowledge/knowledge-document.controller.spec.ts
```

Expected: FAIL because the new visibility scopes and organization evaluator are absent.

- [ ] **Step 3: Implement minimal centralized evaluation**

`KnowledgeDocumentService` must:

- allow admin and active technical-department users to maintain all documents
- allow owners to read their document
- match legacy role/user scopes and new unit/project scopes
- audit denied direct reads and denied mutations
- normalize seeded legacy `presales` role targets
- continue filtering retrieval IDs by `enabled && parseStatus === "done"`

Do not duplicate these rules in QA, customer analysis, or RAGFlow controller.

- [ ] **Step 4: Verify downstream retrieval contracts**

Add/adjust tests proving all three callers receive identical allowed IDs and
that an empty metadata catalog still leaves external RAGFlow retrieval
unfiltered, as fixed in `f6e9b2f`.

```powershell
pnpm --filter pas-backend exec vitest run src/knowledge/knowledge-document.service.spec.ts src/qa/qa.service.spec.ts src/ragflow/ragflow.controller.spec.ts src/customer-analysis/customer-analysis.service.spec.ts
```

Expected: all focused files pass.

- [ ] **Step 5: Commit knowledge enforcement**

```powershell
git add apps/backend/src/knowledge apps/backend/src/qa apps/backend/src/ragflow apps/backend/src/customer-analysis
git commit -m "feat: enforce organization document access"
```

---

### Task 5: Account And Organization Administration UI

**Files:**
- Create: `apps/frontend/src/pages/OrganizationAccessPanel.tsx`
- Create: `apps/frontend/src/pages/OrganizationAccessPanel.test.tsx`
- Modify: `apps/frontend/src/types.ts`
- Modify: `apps/frontend/src/pages/AccountsPage.tsx`
- Modify: `apps/frontend/src/pages/SystemPages.test.tsx`
- Modify: `apps/frontend/src/pages/MenuConfigPage.tsx`
- Modify: `apps/frontend/src/pages/MenuConfigPage.test.tsx`
- Modify: `apps/frontend/src/pages/PlatformPage.tsx`
- Modify: `apps/frontend/src/pages/PlatformPage.test.tsx`
- Modify: `apps/frontend/src/navigation.tsx`
- Modify: `apps/frontend/src/App.test.tsx`
- Modify: `apps/frontend/src/styles.css`

**Interfaces:**
- Consumes organization endpoints and extended user contracts.
- Produces account create/update payloads with `organizationUnitId` and `projectGroupIds`.
- Embeds organization administration in the existing account-management page; no new menu key is added.

- [ ] **Step 1: Write failing frontend tests**

Test that:

- role options show `sales`, `technical`, and `admin`, never `presales`
- selecting `technical` requires a unit inside the technical subtree
- account rows edit unit and project memberships
- admins can create/rename/disable organization units and project groups
- loading and API errors do not clear already loaded account data
- the panel remains usable at a 390px viewport without text/button overlap

- [ ] **Step 2: Run focused frontend tests and verify RED**

```powershell
pnpm --filter pas-frontend exec vitest run src/pages/OrganizationAccessPanel.test.tsx src/pages/SystemPages.test.tsx src/pages/MenuConfigPage.test.tsx src/pages/PlatformPage.test.tsx src/App.test.tsx
```

Expected: FAIL on missing panel, old role options, and missing membership controls.

- [ ] **Step 3: Implement shared types and UI**

Use Ant Design `Tree`, `Select`, `Switch`, `Input`, icon buttons, and compact
panels already present in system pages. Keep organization sections unframed
inside the account page and do not nest cards.

- [ ] **Step 4: Replace active frontend role values and verify GREEN**

Update navigation fallback roles, menu configuration role options, platform
workflow checks, fixtures, and assertions. Do not rename the PAS product or the
general phrase "pre-sales" when it describes the product domain rather than a
system role.

Run the command from Step 2. Expected: all focused tests pass.

- [ ] **Step 5: Commit account and organization UI**

```powershell
git add apps/frontend/src
git commit -m "feat: manage technical organization access"
```

---

### Task 6: Document Visibility UI

**Files:**
- Modify: `apps/frontend/src/types.ts`
- Modify: `apps/frontend/src/pages/KnowledgeDocumentsPage.tsx`
- Modify: `apps/frontend/src/pages/KnowledgeDocumentsPage.test.tsx`
- Modify: `apps/frontend/src/styles.css`

**Interfaces:**
- Consumes users, organization units, and project groups.
- Produces one of the five visibility payload variants defined by Task 4.

- [ ] **Step 1: Write failing visibility-form tests**

Test the Technical Department default, role targets, user targets,
organization-unit targets, project-group targets, edit-state hydration, empty
target validation, and API error handling.

- [ ] **Step 2: Run the test and verify RED**

```powershell
pnpm --filter pas-frontend exec vitest run src/pages/KnowledgeDocumentsPage.test.tsx
```

Expected: FAIL because the current page always submits `{ scope: "public" }`.

- [ ] **Step 3: Implement the visibility controls**

Use a scope `Select` and a target multi-select. Disable submission when a
non-public scope has no valid targets. Display readable scope and target names
in the document list without exposing raw arrays as the primary label.

- [ ] **Step 4: Verify GREEN and responsive layout**

```powershell
pnpm --filter pas-frontend exec vitest run src/pages/KnowledgeDocumentsPage.test.tsx
pnpm --filter pas-frontend typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit document visibility UI**

```powershell
git add apps/frontend/src/types.ts apps/frontend/src/pages/KnowledgeDocumentsPage.tsx apps/frontend/src/pages/KnowledgeDocumentsPage.test.tsx apps/frontend/src/styles.css
git commit -m "feat: configure document visibility"
```

---

### Task 7: Active Documentation And End-To-End Verification

**Files:**
- Modify: `docs/deployment/v1-sop.md`
- Modify: `docs/ragflow/50-question-regression-template.md`
- Modify: `docs/ragflow/v1-100-question-regression-template.md`
- Modify: `docs/superpowers/plans/status-audit-2026-07-07.md`

**Interfaces:**
- Documents the `technical` role, seeded organization, migration behavior, and
  reviewer terminology.
- Does not rewrite historical implementation plans/specifications that
  accurately describe the state at their original date.

- [ ] **Step 1: Run an active-source terminology check**

```powershell
git grep -n "presales" -- apps/backend/src apps/frontend/src docs/deployment docs/ragflow
```

Expected: no role value, role option, active authorization message, or reviewer
label still uses `presales`; product-domain prose may remain only when clearly
not a system role.

- [ ] **Step 2: Run full local verification**

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm compose:config
pnpm test:smoke
git diff --check
```

Expected: all commands exit 0. Existing jsdom pseudo-element/CSS parser noise
and the known frontend bundle-size warning may appear but must not become test
or build failures.

- [ ] **Step 3: Apply the migration and rebuild the internal-trial backend**

Build `local/pas-v2/pas-backend:dev`, preserve the running Redis password, and
recreate the backend through Docker Compose. Confirm all HYYN containers are
healthy, `/api/health` is `ok`, and `/api/ragflow/health` is `ok`.

- [ ] **Step 4: Run live role and permission smoke**

Verify with live API calls:

- a migrated technical user belongs to the Presales Team
- technical users in all three child teams can maintain documents
- a sales user cannot mutate a document
- a sales user can retrieve a unit- or project-authorized document
- an unrelated sales user receives no document ID
- the existing V0 smoke still passes with current templates

- [ ] **Step 5: Update active documentation and status evidence**

Record exact test counts, migration evidence, live container health, and any
remaining internal-trial blockers. Do not mark the 50-question human gate
complete in this task.

- [ ] **Step 6: Commit documentation and push all M9 commits**

```powershell
git add docs/deployment/v1-sop.md docs/ragflow/50-question-regression-template.md docs/ragflow/v1-100-question-regression-template.md docs/superpowers/plans/status-audit-2026-07-07.md
git commit -m "docs: record M9 permission rollout"
git push origin main
```

---

## Self-Review Checklist

- [ ] Every approved organization and permission rule maps to a task and test.
- [ ] Every referenced interface is defined with consistent names and types.
- [ ] Organization/project membership has one source of truth on user records.
- [ ] The technical-maintainer rule depends on both role and active hierarchy membership.
- [ ] Retrieval remains enabled/parsed-only and preserves empty-catalog behavior.
- [ ] Historical planning documents are not mechanically rewritten.
- [ ] `design-qa.md` remains untouched and untracked.
