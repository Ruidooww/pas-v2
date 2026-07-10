import type { OrganizationState } from "./organization.types";

type OrganizationPersistenceSink = {
  mirrorOrganizationState(state: OrganizationState): void;
};

export class OrganizationStoreService {
  private state?: OrganizationState;

  constructor(private readonly sink?: OrganizationPersistenceSink) {}

  hasState(): boolean {
    return this.state !== undefined;
  }

  seed(state: OrganizationState | undefined): void {
    if (!state || this.state) return;
    this.state = cloneState(state);
  }

  getState(): OrganizationState {
    if (!this.state) {
      throw new Error("Organization state has not been seeded");
    }
    return cloneState(this.state);
  }

  update(mutator: (draft: OrganizationState) => void): OrganizationState {
    const draft = this.getState();
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    this.state = cloneState(draft);
    this.sink?.mirrorOrganizationState(this.state);
    return cloneState(this.state);
  }
}

function cloneState(state: OrganizationState): OrganizationState {
  return JSON.parse(JSON.stringify(state)) as OrganizationState;
}
