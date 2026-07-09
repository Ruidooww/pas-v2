import { Module } from "@nestjs/common";
import { PersistenceSink } from "./persistence-sink";
import { PERSISTENCE_SINK } from "./persistence.tokens";

@Module({
  providers: [
    {
      provide: PERSISTENCE_SINK,
      useFactory: (): PersistenceSink => new PersistenceSink()
    }
  ],
  exports: [PERSISTENCE_SINK]
})
export class PersistenceModule {}
