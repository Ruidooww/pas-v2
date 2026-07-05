import { describe, expect, it, vi } from "vitest";
import { BusinessFlowStoreService } from "./business-flow-store.service";
import type { BusinessFlowRecord } from "./business-flow.types";

describe("BusinessFlowStoreService", () => {
  it("clones records on create, read, and list", () => {
    const store = new BusinessFlowStoreService();
    const created = store.create(createRecord({ recordId: "bf-1", ownerUserId: "sales-1" }));

    created.events.push({
      eventId: "mutated",
      type: "opportunity_confirmed",
      actorUserId: "sales-1",
      occurredAt: "2026-07-05T00:00:00.000Z"
    });

    expect(store.get("bf-1")?.events).toHaveLength(1);
    const listed = store.listForActor({ userId: "sales-1", role: "sales" });
    expect(listed[0]).toBeDefined();
    listed[0]!.payload.title = "mutated";
    expect(store.get("bf-1")?.payload.title).toBe("Original");
  });

  it("filters records by role and ownership", () => {
    const store = new BusinessFlowStoreService();
    store.create(createRecord({ recordId: "own-opportunity", kind: "opportunity", ownerUserId: "sales-1" }));
    store.create(createRecord({ recordId: "other-opportunity", kind: "opportunity", ownerUserId: "sales-2" }));
    store.create(createRecord({ recordId: "other-contract", kind: "contract_review", ownerUserId: "presales-1" }));
    store.create(createRecord({ recordId: "other-channel", kind: "channel", ownerUserId: "sales-2" }));

    expect(store.listForActor({ userId: "sales-1", role: "sales" }).map((record) => record.recordId)).toEqual([
      "own-opportunity",
      "other-opportunity",
      "other-channel"
    ]);
    expect(store.listForActor({ userId: "presales-2", role: "presales" }).map((record) => record.recordId)).toEqual([
      "other-contract"
    ]);
    expect(store.listForActor({ userId: "admin-1", role: "admin" })).toHaveLength(4);
  });

  it("mirrors records to the persistence sink", () => {
    const sink = { mirrorBusinessFlowRecord: vi.fn() };
    const store = new BusinessFlowStoreService(sink);
    const record = store.create(createRecord({ recordId: "bf-1" }));

    expect(sink.mirrorBusinessFlowRecord).toHaveBeenCalledWith(record);
  });

  it("seeds persisted records without duplicating existing records", () => {
    const store = new BusinessFlowStoreService();
    store.create(createRecord({ recordId: "bf-1", payloadTitle: "Current" }));
    store.seed([
      createRecord({ recordId: "bf-1", payloadTitle: "Persisted" }),
      createRecord({ recordId: "bf-2", payloadTitle: "Second" })
    ]);

    expect(store.get("bf-1")?.payload.title).toBe("Current");
    expect(store.get("bf-2")?.payload.title).toBe("Second");
  });
});

function createRecord(overrides: {
  recordId: string;
  kind?: BusinessFlowRecord["kind"];
  ownerUserId?: string;
  payloadTitle?: string;
}): BusinessFlowRecord {
  const now = "2026-07-05T00:00:00.000Z";
  return {
    recordId: overrides.recordId,
    kind: overrides.kind ?? "opportunity",
    status: "pending_confirmation",
    ownerUserId: overrides.ownerUserId ?? "sales-1",
    ownerRole: "sales",
    source: {
      system: "manual_text",
      reference: "manual-input",
      capturedAt: now
    },
    payload: {
      title: overrides.payloadTitle ?? "Original"
    },
    outputs: {},
    pendingInputs: [],
    events: [
      {
        eventId: "event-1",
        type: "record_created",
        actorUserId: overrides.ownerUserId ?? "sales-1",
        occurredAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}
