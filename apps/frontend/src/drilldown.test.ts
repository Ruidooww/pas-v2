import { describe, expect, it } from "vitest";
import { buildDrilldownSearch, readDrilldown } from "./drilldown";

describe("drilldown query helpers", () => {
  it("builds a stable query and omits empty values", () => {
    expect(buildDrilldownSearch({ priority: "high", status: undefined, source: "proposal" })).toBe(
      "?priority=high&source=proposal"
    );
  });

  it("returns only allowlisted values", () => {
    expect(
      readDrilldown("?status=unknown&priority=high&ignored=value", {
        priority: ["high"],
        status: ["blocked", "done"]
      })
    ).toEqual({ priority: "high" });
  });
});
