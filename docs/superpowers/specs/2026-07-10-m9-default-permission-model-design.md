# M9 Default Permission Model Design

## Context

PAS v2 is preparing for an internal-network trial. The current authorization
model has three hard-coded roles (`sales`, `presales`, and `admin`) and
knowledge-document visibility supports only `public`, `roles`, and `users`.
The trial needs an organization-aware model without introducing a generic
policy language or an external policy engine.

The approved business decisions are:

- Replace the top-level `presales` role with `technical`.
- The organization contains a sales department and a technical department.
- The technical department contains presales, technical, and after-sales
  child teams.
- Every active member of the technical department subtree can maintain the
  knowledge base. The child team does not change that maintenance permission.
- CRM integration remains deferred.
- Current export templates are accepted for the internal trial.

## Goals

- Represent the approved department hierarchy and cross-department project
  groups.
- Attach organization and project membership to authenticated users.
- Extend document visibility to organization units and project groups.
- Apply one fail-closed permission decision to document APIs, QA retrieval,
  customer analysis, and direct RAGFlow search.
- Preserve existing records and migrate `presales` users and menu rules to
  `technical`.
- Provide admin-facing controls for organization membership and document
  visibility.
- Audit organization changes and denied direct document access.

## Non-Goals

- A generic ABAC DSL, OPA integration, BPMN workflow, or low-code policy
  builder.
- Field-level masking or cloud-LLM redaction; that belongs to the M6 security
  workstream.
- Real CRM synchronization.
- Different knowledge-maintenance permissions for the three technical child
  teams.
- Hard deletion of organization units or project groups.

## Organization Model

The system seeds deterministic organization units on first boot:

```text
Company
|- Sales Department
`- Technical Department
   |- Presales Team
   |- Technical Team
   `- After-sales Team
```

An `OrganizationUnit` has:

- `unitId`
- `name`
- `kind`: `company`, `department`, or `team`
- `parentUnitId`, absent only for the company root
- `active`
- `createdAt` and `updatedAt`

A `ProjectGroup` has:

- `projectGroupId`
- `name`
- `active`
- `createdAt` and `updatedAt`

Each user has one `organizationUnitId` and zero or more `projectGroupIds`.
Department membership includes all active ancestors of the assigned unit. A
user assigned to the Presales Team is therefore also a member of the Technical
Department for authorization decisions.

## Roles

`UserRole` becomes:

```text
sales | technical | admin
```

Role and organization membership have separate responsibilities:

- `admin` is the system-administration override.
- `technical` grants knowledge-maintenance capability, but only while the user
  belongs to an active unit in the Technical Department subtree.
- `sales` is a business user and receives document access only through a
  matching visibility policy.

The account API rejects a `technical` user outside the Technical Department
subtree and a `sales` user outside the Sales Department. Admin accounts may be
assigned to any active unit or left at the company root.

## Document Visibility

The existing discriminated union remains backward compatible and adds two
scopes:

```typescript
type KnowledgeDocumentVisibility =
  | { scope: "public" }
  | { scope: "roles"; roles: UserRole[] }
  | { scope: "users"; userIds: string[] }
  | { scope: "organization_units"; organizationUnitIds: string[] }
  | { scope: "project_groups"; projectGroupIds: string[] };
```

Targets inside one policy use OR semantics. An organization-unit target
matches direct members and members of active descendant units. Missing or
inactive targets never grant access.

The decision order is:

1. Inactive users are rejected by authentication.
2. `admin` may list and manage every document.
3. An active `technical` user in the Technical Department subtree may list and
   manage every document.
4. The document owner may read the document.
5. Other users must match the document visibility policy.
6. No match means deny.

QA retrieval, customer analysis, and direct RAGFlow search additionally require
the document to be enabled and parsed successfully. Admin and technical users
can still list pending, failed, or disabled records for maintenance, but those
records are never sent to retrieval.

## Backend Boundaries

Create an `organization` module with a service that owns the organization tree,
project groups, membership validation, ancestor resolution, and seeded default
structure. It exposes:

- `GET /api/internal/organization/units`
- `POST /api/internal/organization/units`
- `PATCH /api/internal/organization/units/:unitId`
- `GET /api/internal/organization/project-groups`
- `POST /api/internal/organization/project-groups`
- `PATCH /api/internal/organization/project-groups/:projectGroupId`

Only admins may mutate organization data. Active authenticated users may read
the unit and project lists needed by account and document forms.

The existing account endpoints accept `organizationUnitId` and
`projectGroupIds` on create and update. `AuthService` validates those values
through `OrganizationService` before saving a user.

`KnowledgeDocumentService` receives `OrganizationService` and delegates all
visibility checks to one permission evaluator. QA, customer analysis, and the
RAGFlow controller continue to consume `getAccessibleDocumentIds`; they do not
implement their own organization rules.

## Persistence And Migration

The organization tree and project groups use one
`OrganizationStateSnapshot`, matching the existing platform and menu snapshot
pattern. User rows add `organizationUnitId` and `projectGroupIds` fields so
authenticated claims are restored during hydration.

The migration performs these deterministic conversions:

- `presales` role becomes `technical`.
- Existing presales users are assigned to the Presales Team.
- Existing sales users are assigned to the Sales Department.
- Existing admins are assigned to the company root.
- Persisted menu role entries containing `presales` are normalized to
  `technical` during hydration without resetting menu aliases or ordering.
- Existing document `public`, `roles`, and `users` visibility records remain
  valid. A legacy `roles: ["presales"]` entry is normalized to
  `roles: ["technical"]`.

Organization units and project groups are soft-disabled. Disabled objects stay
in audit history and do not grant access.

## Frontend

The account page adds organization-unit and project-group controls to create
and edit flows. Role choices become `sales`, `technical`, and `admin`.

The knowledge-document page adds a visibility selector and target selector for
roles, users, organization units, and project groups. New documents continue
to default to the Technical Department. Existing public documents remain
public until an administrator or technical user changes their visibility.

The organization settings view displays the hierarchy and project groups in a
dense administration layout. It supports create, rename, enable/disable, and
membership inspection; it does not provide drag-and-drop reparenting in this
iteration.

## Errors And Audit

Invalid or inactive organization targets return `400`. Unauthorized mutations
return `403`. Direct access to an existing but invisible document returns
`403`; a missing document remains `404`.

Audit events cover:

- organization-unit creation and update
- project-group creation and update
- user membership changes
- knowledge-document visibility changes
- denied direct document access

Audit payloads store identifiers and reasons, not passwords, tokens, document
content, or LLM prompts.

## Verification

Backend tests must prove:

- seeded hierarchy and ancestor membership
- role-to-department validation
- technical users in all three child teams can maintain documents
- sales users cannot mutate knowledge documents
- organization-unit inheritance grants reads to descendants
- unrelated departments and projects are denied
- inactive or missing targets fail closed
- project-group membership grants and revokes reads
- QA, customer analysis, and direct RAGFlow search receive the same allowed
  document IDs
- migration normalizes legacy `presales` users, menu roles, and document roles
- organization and denial events are audited
- organization state and user membership survive persistence hydration

Frontend tests must cover account assignment, document visibility editing,
organization administration, loading states, API errors, and narrow viewport
layout.

The complete repository test, typecheck, build, fake-server smoke, Docker
configuration validation, and live internal-trial smoke must pass before the
implementation is committed as complete.

## Separate 50-Question Gate

After M9 is complete, the regression task will use the current IP-Guard
document scope to produce exactly 50 stable questions, capture live answers,
chunk IDs, and citations, and generate a reviewer worksheet. The reviewer must
record `pass`, `partial`, or `fail`; generated answers are never auto-approved.
