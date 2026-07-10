import type { PersistenceSink } from "../persistence/persistence-sink";
import type { MenuState, PrimaryMenuKey } from "./menu.types";

type MenuPersistenceSink = Pick<PersistenceSink, "mirrorMenuState">;

export class MenuStoreService {
  private state?: MenuState;

  constructor(private readonly sink?: MenuPersistenceSink) {}

  seed(state: MenuState | undefined): void {
    if (!state || this.state) return;
    this.state = normalizeLegacyState(state);
  }

  getState(): MenuState {
    if (!this.state) {
      this.state = { stateId: "pas-menu-state", overrides: [], updatedAt: new Date().toISOString() };
    }
    return cloneState(this.state);
  }

  update(mutator: (draft: MenuState) => void): MenuState {
    const draft = this.getState();
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    this.state = cloneState(draft);
    this.sink?.mirrorMenuState(this.state);
    return cloneState(this.state);
  }

  resetPrimary(primaryKey: PrimaryMenuKey): MenuState {
    return this.update((draft) => {
      draft.overrides = draft.overrides.filter((override) => override.primaryKey !== primaryKey);
    });
  }
}

function cloneState(state: MenuState): MenuState {
  return JSON.parse(JSON.stringify(state)) as MenuState;
}

function normalizeLegacyState(state: MenuState): MenuState {
  const normalized = cloneState(state);
  for (const override of normalized.overrides) {
    override.roles = [...new Set(override.roles.map((role) => (String(role) === "presales" ? "technical" : role)))];
  }
  return normalized;
}
