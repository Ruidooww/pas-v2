import { Controller, Get } from "@nestjs/common";

type HealthResponse = {
  service: "pas-backend";
  status: "ok";
};

@Controller("api/health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "pas-backend",
      status: "ok"
    };
  }
}
