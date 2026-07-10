import { describe, expect, it, vi } from "vitest";
import { OrganizationStoreService } from "./organization-store.service";
import type { OrganizationState } from "./organization.types";

describe("OrganizationStoreService", () => {
  it("seeds and returns defensive copies", () => {
    const store = new OrganizationStoreService();
    const state = createState();

    store.seed(state);
    const first = store.getState();
    first.units[0]!.name = "Mutated";

    expect(store.getState().units[0]!.name).toBe("Company");
  });

  it("persists updated organization state", () => {
    const sink = { mirrorOrganizationState: vi.fn() };
    const store = new OrganizationStoreService(sink);
    store.seed(createState());

    const updated = store.update((draft) => {
      draft.units[1]!.name = "Sales Department Updated";
    });

    expect(updated.units[1]!.name).toBe("Sales Department Updated");
    expect(sink.mirrorOrganizationState).toHaveBeenCalledWith(updated);
  });
});

function createState(): OrganizationState {
  return {
    stateId: "pas-organization-state",
    units: [
      {
        unitId: "org-company",
        name: "Company",
        kind: "company",
        active: true,
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z"
      },
      {
        unitId: "org-sales",
        name: "Sales Department",
        kind: "department",
        parentUnitId: "org-company",
        active: true,
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z"
      }
    ],
    projectGroups: [],
    updatedAt: "2026-07-10T00:00:00.000Z"
  };
}
