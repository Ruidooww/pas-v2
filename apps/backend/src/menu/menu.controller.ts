import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MENU_SERVICE } from "./menu.tokens";
import type { MenuService } from "./menu.service";
import type { PrimaryMenuKey, UpdateSecondaryMenuOverrideRequest } from "./menu.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/menu")
export class MenuController {
  constructor(@Inject(MENU_SERVICE) private readonly service: MenuService) {}

  @Get("effective")
  getEffectiveMenu(@Req() request: RequestWithUser) {
    return this.service.getEffectiveMenu(request.user);
  }

  @Get("configuration")
  getConfiguration(@Req() request: RequestWithUser) {
    return this.service.getConfiguration(request.user);
  }

  @Patch("configuration")
  updateOverride(@Req() request: RequestWithUser, @Body() body: UpdateSecondaryMenuOverrideRequest) {
    return this.service.updateOverride(body, request.user);
  }

  @Post("configuration/:primaryKey/reset")
  resetPrimary(@Req() request: RequestWithUser, @Param("primaryKey") primaryKey: PrimaryMenuKey) {
    return this.service.resetPrimary(primaryKey, request.user);
  }
}
