import type { PersistenceSink } from "../persistence/persistence-sink";
import type { BusinessFlowActor, BusinessFlowRecord } from "./business-flow.types";

type BusinessFlowPersistenceSink = Pick<PersistenceSink, "mirrorBusinessFlowRecord">;

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
  return record.ownerUserId === actor.userId;
}

function cloneRecord(record: BusinessFlowRecord): BusinessFlowRecord {
  return JSON.parse(JSON.stringify(record)) as BusinessFlowRecord;
}
