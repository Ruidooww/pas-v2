import { describe, expect, it, vi } from "vitest";
import { PlatformStoreService } from "./platform-store.service";
import type { PlatformState } from "./platform.types";

describe("PlatformStoreService", () => {
  it("seeds state once and returns defensive clones", () => {
    const store = new PlatformStoreService();
    const state = createState("state-1");

    store.seed(state);
    store.seed(createState("state-2"));

    const snapshot = store.getState();
    snapshot.channels[0]!.name = "mutated";

    expect(store.getState().stateId).toBe("state-1");
    expect(store.getState().channels[0]!.name).toBe("Web");
  });

  it("mirrors updates to persistence without exposing mutable state", () => {
    const sink = { mirrorPlatformState: vi.fn() };
    const store = new PlatformStoreService(sink);
    store.seed(createState("state-1"));

    const updated = store.update((draft) => {
      draft.channels.push({
        channelId: "feishu",
        kind: "feishu",
        name: "Feishu",
        status: "adapter_pending",
        identityMapping: "pending",
        pendingInputs: ["feishu_app_credentials"]
      });
    });

    updated.channels[1]!.name = "changed-outside";

    expect(sink.mirrorPlatformState).toHaveBeenCalledWith(expect.objectContaining({ stateId: "state-1" }));
    expect(store.getState().channels[1]!.name).toBe("Feishu");
  });
});

function createState(stateId: string): PlatformState {
  return {
    stateId,
    channels: [
      {
        channelId: "web",
        kind: "web",
        name: "Web",
        status: "active",
        identityMapping: "pas_user",
        pendingInputs: []
      }
    ],
    sessions: [],
    agents: [],
    skills: [],
    workflows: [],
    executions: [],
    products: [],
    cipSignals: [],
    tenant: {
      tenantId: "internal",
      organizationId: "hyy",
      mode: "single_org",
      isolationFields: ["tenantId", "organizationId"],
      billingReserved: false,
      singleOrgCompatible: true
    },
    auditEvents: [],
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}
