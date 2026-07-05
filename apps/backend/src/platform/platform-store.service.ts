import type { PersistenceSink } from "../persistence/persistence-sink";
import type { PlatformState } from "./platform.types";

type PlatformPersistenceSink = Pick<PersistenceSink, "mirrorPlatformState">;

export class PlatformStoreService {
  private state?: PlatformState;

  constructor(private readonly sink?: PlatformPersistenceSink) {}

  hasState(): boolean {
    return this.state !== undefined;
  }

  seed(state: PlatformState | undefined): void {
    if (!state || this.state) return;
    this.state = cloneState(state);
  }

  getState(): PlatformState {
    if (!this.state) {
      throw new Error("Platform state has not been seeded");
    }
    return cloneState(this.state);
  }

  update(mutator: (draft: PlatformState) => void): PlatformState {
    const draft = this.getState();
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    this.state = cloneState(draft);
    this.sink?.mirrorPlatformState(this.state);
    return cloneState(this.state);
  }
}

function cloneState(state: PlatformState): PlatformState {
  return JSON.parse(JSON.stringify(state)) as PlatformState;
}
