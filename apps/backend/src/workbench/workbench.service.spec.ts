import { describe, expect, it } from "vitest";
import { WorkbenchService } from "./workbench.service";

describe("WorkbenchService", () => {
  it("returns mock overview metrics and tasks", () => {
    const service = new WorkbenchService();
    const overview = service.getOverview();

    expect(overview.metrics.map((metric) => metric.key)).toContain("active_tasks");
    expect(overview.tasks.length).toBeGreaterThan(0);
    expect(overview.activities.length).toBeGreaterThan(0);
  });

  it("returns team scope tasks without requiring external data ingestion", () => {
    const service = new WorkbenchService();

    expect(service.listTasks("team").length).toBeGreaterThanOrEqual(service.listTasks("mine").length);
  });
});
