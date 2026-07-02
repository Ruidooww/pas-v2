import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns service status for compose health checks", () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({
      service: "pas-backend",
      status: "ok"
    });
  });
});
