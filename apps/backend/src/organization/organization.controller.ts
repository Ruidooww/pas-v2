import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { OrganizationService } from "./organization.service";
import { ORGANIZATION_SERVICE } from "./organization.tokens";
import type {
  CreateOrganizationUnitRequest,
  CreateProjectGroupRequest,
  OrganizationUnit,
  OrganizationUserClaims,
  ProjectGroup,
  UpdateOrganizationUnitRequest,
  UpdateProjectGroupRequest
} from "./organization.types";

type RequestWithUser = {
  user?: OrganizationUserClaims;
};

@Controller("api/internal/organization")
export class OrganizationController {
  constructor(@Inject(ORGANIZATION_SERVICE) private readonly service: OrganizationService) {}

  @Get("units")
  listUnits(@Req() request: RequestWithUser): OrganizationUnit[] {
    return this.service.listUnits(requireUser(request));
  }

  @Post("units")
  createUnit(@Req() request: RequestWithUser, @Body() body: CreateOrganizationUnitRequest): OrganizationUnit {
    requireName(body.name);
    if (!body.parentUnitId?.trim() || !body.kind) {
      throw new BadRequestException("parentUnitId and kind are required");
    }
    return this.service.createUnit(requireUser(request), body);
  }

  @Patch("units/:unitId")
  updateUnit(
    @Req() request: RequestWithUser,
    @Param("unitId") unitId: string,
    @Body() body: UpdateOrganizationUnitRequest
  ): OrganizationUnit {
    if (body.name !== undefined) requireName(body.name);
    return this.service.updateUnit(requireUser(request), unitId, body);
  }

  @Get("project-groups")
  listProjectGroups(@Req() request: RequestWithUser): ProjectGroup[] {
    return this.service.listProjectGroups(requireUser(request));
  }

  @Post("project-groups")
  createProjectGroup(@Req() request: RequestWithUser, @Body() body: CreateProjectGroupRequest): ProjectGroup {
    requireName(body.name);
    return this.service.createProjectGroup(requireUser(request), body);
  }

  @Patch("project-groups/:projectGroupId")
  updateProjectGroup(
    @Req() request: RequestWithUser,
    @Param("projectGroupId") projectGroupId: string,
    @Body() body: UpdateProjectGroupRequest
  ): ProjectGroup {
    if (body.name !== undefined) requireName(body.name);
    return this.service.updateProjectGroup(requireUser(request), projectGroupId, body);
  }
}

function requireUser(request: RequestWithUser): OrganizationUserClaims {
  if (!request.user) throw new BadRequestException("authenticated user is required");
  return request.user;
}

function requireName(value: string | undefined): void {
  if (!value?.trim()) throw new BadRequestException("name is required");
}
