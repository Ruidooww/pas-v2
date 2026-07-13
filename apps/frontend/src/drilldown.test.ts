import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildDrilldownSearch, readDrilldown, useDrilldownQuery } from "./drilldown";

const statusSchema = { status: ["all", "open"] } as const;

describe("drilldown query helpers", () => {
  afterEach(() => window.history.pushState({}, "", "/"));

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

  it("updates the URL and restores values on browser navigation", () => {
    const { result } = renderHook(() => useDrilldownQuery(statusSchema));

    act(() => result.current[1]({ status: "open" }));
    expect(result.current[0]).toEqual({ status: "open" });
    expect(window.location.search).toBe("?status=open");

    act(() => {
      window.history.pushState({}, "", "/?status=all");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current[0]).toEqual({ status: "all" });
  });

  it("syncs a query pushed by the application router on rerender", () => {
    const { result, rerender } = renderHook(() => useDrilldownQuery(statusSchema));

    window.history.pushState({}, "", "/?status=open");
    rerender();

    expect(result.current[0]).toEqual({ status: "open" });
  });
});
