import type { AuthService } from "./auth.service";

type BootstrapEnv = Partial<Pick<NodeJS.ProcessEnv, "AUTH_BOOTSTRAP_ADMIN_USERNAME" | "AUTH_BOOTSTRAP_ADMIN_PASSWORD" | "AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME">>;

export async function bootstrapConfiguredAdmin(
  authService: AuthService,
  env: BootstrapEnv = process.env
): Promise<void> {
  const username = env.AUTH_BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
  if (!username || !password) {
    return;
  }

  await authService.bootstrapAdmin({
    username,
    password,
    displayName: env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || username
  });
}
