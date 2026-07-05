import type { PersistenceSink } from "../persistence/persistence-sink";
import type { BusinessFlowActor, BusinessFlowKind, BusinessFlowRecord } from "./business-flow.types";

type BusinessFlowPersistenceSink = Pick<PersistenceSink, "mirrorBusinessFlowRecord">;

const salesVisibleKinds: BusinessFlowKind[] = ["opportunity", "channel", "customer_signal"];
const presalesVisibleKinds: BusinessFlowKind[] = ["meeting", "contract_review", "after_sales", "customer_signal"];

export class BusinessFlowStoreService {
  private readonly records = new Map<string, BusinessFlowRecord>();

  constructor(private readonly sink?: BusinessFlowPersistenceSink) {}

  seed(records: BusinessFlowRecord[]): void {
    for (const record of records) {
      if (this.records.has(record.recordId)) continue;
      this.records.set(record.recordId, cloneRecord(record));
    }
  }

  create(record: BusinessFlowRecord): BusinessFlowRecord {
    this.records.set(record.recordId, cloneRecord(record));
    this.sink?.mirrorBusinessFlowRecord(record);
    return cloneRecord(record);
  }

  update(record: BusinessFlowRecord): BusinessFlowRecord {
    this.records.set(record.recordId, cloneRecord(record));
    this.sink?.mirrorBusinessFlowRecord(record);
    return cloneRecord(record);
  }

  get(recordId: string): BusinessFlowRecord | undefined {
    const record = this.records.get(recordId);
    return record ? cloneRecord(record) : undefined;
  }

  list(): BusinessFlowRecord[] {
    return [...this.records.values()].map(cloneRecord);
  }

  listForActor(actor: BusinessFlowActor): BusinessFlowRecord[] {
    return this.list().filter((record) => canReadRecord(record, actor));
  }
}

export function canReadRecord(record: BusinessFlowRecord, actor: BusinessFlowActor): boolean {
  if (actor.role === "admin") {
    return true;
  }
  if (record.ownerUserId === actor.userId) {
    return true;
  }
  if (actor.role === "sales") {
    return salesVisibleKinds.includes(record.kind);
  }
  return presalesVisibleKinds.includes(record.kind);
}

function cloneRecord(record: BusinessFlowRecord): BusinessFlowRecord {
  return JSON.parse(JSON.stringify(record)) as BusinessFlowRecord;
}
