import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser, UserRole } from "../auth/auth.types";
import type { AuditLogService } from "../audit/audit-log.service";
import { DEFAULT_PRIMARY_MENUS } from "./menu-defaults";
import { MenuStoreService } from "./menu-store.service";
import type {
  EffectivePrimaryMenuItem,
  EffectiveSecondaryMenuItem,
  MenuConfiguration,
  PrimaryMenuDefinition,
  PrimaryMenuKey,
  SecondaryMenuDefinition,
  SecondaryMenuKey,
  SecondaryMenuOverride,
  UpdateSecondaryMenuOverrideRequest
} from "./menu.types";

type MenuAuditLog = Pick<AuditLogService, "record">;

const VALID_ROLES: UserRole[] = ["sales", "presales", "admin"];

export class MenuService {
  constructor(
    private readonly store: MenuStoreService,
    private readonly auditLog?: MenuAuditLog
  ) {}

  getEffectiveMenu(actor: AuthenticatedUser): EffectivePrimaryMenuItem[] {
    const overrides = this.store.getState().overrides;
    return DEFAULT_PRIMARY_MENUS.map((primary) => buildEffectivePrimary(primary, overrides, actor.role))
      .filter((primary): primary is EffectivePrimaryMenuItem => primary !== undefined)
      .sort(sortByOrder);
  }

  getConfiguration(actor: AuthenticatedUser): MenuConfiguration {
    assertAdmin(actor);
    return {
      defaults: cloneDefaults(),
      overrides: this.store.getState().overrides
    };
  }

  updateOverride(request: UpdateSecondaryMenuOverrideRequest, actor: AuthenticatedUser): MenuConfiguration {
    assertAdmin(actor);
    const primary = findPrimary(request.primaryKey);
    const secondary = findSecondary(primary, request.secondaryKey);
    const roles = normalizeRoles(request.roles, secondary.roles);
    const now = new Date().toISOString();

    this.store.update((draft) => {
      const currentIndex = draft.overrides.findIndex(
        (override) => override.primaryKey === request.primaryKey && override.secondaryKey === request.secondaryKey
      );
      const current = currentIndex >= 0 ? draft.overrides[currentIndex] : undefined;

      if (request.isDefault) {
        for (const override of draft.overrides) {
          if (override.primaryKey === request.primaryKey) {
            override.isDefault = false;
          }
        }
      }

      const next: SecondaryMenuOverride = {
        primaryKey: request.primaryKey,
        secondaryKey: request.secondaryKey,
        visible: request.visible ?? current?.visible ?? true,
        order: request.order ?? current?.order ?? secondary.order,
        alias: normalizeAlias(request.alias, current?.alias),
        roles,
        isDefault: request.isDefault ?? current?.isDefault ?? false,
        updatedAt: now,
        updatedBy: actor.userId
      };

      if (currentIndex >= 0) {
        draft.overrides[currentIndex] = next;
      } else {
        draft.overrides.push(next);
      }
    });

    this.auditLog?.record({
      action: "menu_configuration",
      actorUserId: actor.userId,
      objectType: "secondary_menu",
      objectId: `${request.primaryKey}/${request.secondaryKey}`,
      result: "success"
    });

    return this.getConfiguration(actor);
  }

  resetPrimary(primaryKey: PrimaryMenuKey, actor: AuthenticatedUser): MenuConfiguration {
    assertAdmin(actor);
    findPrimary(primaryKey);
    this.store.resetPrimary(primaryKey);
    this.auditLog?.record({
      action: "menu_configuration",
      actorUserId: actor.userId,
      objectType: "primary_menu",
      objectId: primaryKey,
      result: "success"
    });
    return this.getConfiguration(actor);
  }
}

function buildEffectivePrimary(
  primary: PrimaryMenuDefinition,
  overrides: SecondaryMenuOverride[],
  role: UserRole
): EffectivePrimaryMenuItem | undefined {
  const children = primary.children
    .map((child) => mergeChild(primary.key, child, overrides))
    .filter((child): child is EffectiveSecondaryMenuItem => child !== undefined && child.roles.includes(role))
    .sort(sortByOrder);

  if (children.length === 0) {
    return undefined;
  }

  const firstChild = children[0];
  if (!firstChild) {
    return undefined;
  }
  const configuredDefault = children.find((child) => child.isDefault);
  const defaultSecondaryKey = configuredDefault?.key ?? firstChild.key;

  return {
    key: primary.key,
    label: primary.label,
    icon: primary.icon,
    order: primary.order,
    children: children.map((child, index) => ({
      ...child,
      isDefault: child.key === defaultSecondaryKey || (!configuredDefault && index === 0)
    })),
    defaultSecondaryKey
  };
}

function mergeChild(
  primaryKey: PrimaryMenuKey,
  child: SecondaryMenuDefinition,
  overrides: SecondaryMenuOverride[]
): EffectiveSecondaryMenuItem | undefined {
  const override = overrides.find((item) => item.primaryKey === primaryKey && item.secondaryKey === child.key);
  if (override?.visible === false) {
    return undefined;
  }
  return {
    ...child,
    label: override?.alias || child.label,
    roles: override?.roles ?? child.roles,
    order: override?.order ?? child.order,
    visible: true,
    isDefault: override?.isDefault ?? false
  };
}

function findPrimary(primaryKey: PrimaryMenuKey): PrimaryMenuDefinition {
  const primary = DEFAULT_PRIMARY_MENUS.find((item) => item.key === primaryKey);
  if (!primary) {
    throw new BadRequestException("unknown primary menu");
  }
  return primary;
}

function findSecondary(primary: PrimaryMenuDefinition, secondaryKey: SecondaryMenuKey): SecondaryMenuDefinition {
  const secondary = primary.children.find((item) => item.key === secondaryKey);
  if (!secondary) {
    throw new BadRequestException("unknown secondary menu for primary menu");
  }
  return secondary;
}

function assertAdmin(actor: AuthenticatedUser): void {
  if (actor.role !== "admin") {
    throw new ForbiddenException("admin role is required");
  }
}

function normalizeRoles(roles: UserRole[] | undefined, fallback: UserRole[]): UserRole[] {
  if (!roles) return fallback;
  const uniqueRoles = [...new Set(roles)];
  if (uniqueRoles.length === 0 || uniqueRoles.some((role) => !VALID_ROLES.includes(role))) {
    throw new BadRequestException("roles must contain valid PAS roles");
  }
  return uniqueRoles;
}

function normalizeAlias(nextAlias: string | undefined, currentAlias: string | undefined): string | undefined {
  if (nextAlias === undefined) return currentAlias;
  const trimmed = nextAlias.trim();
  return trimmed || undefined;
}

function sortByOrder<T extends { order: number; key: string }>(left: T, right: T): number {
  return left.order === right.order ? left.key.localeCompare(right.key) : left.order - right.order;
}

function cloneDefaults(): PrimaryMenuDefinition[] {
  return JSON.parse(JSON.stringify(DEFAULT_PRIMARY_MENUS)) as PrimaryMenuDefinition[];
}
