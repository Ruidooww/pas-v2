FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@11.5.3 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN pnpm install --frozen-lockfile --filter pas-frontend...

FROM deps AS builder

COPY tsconfig.base.json ./
COPY apps/frontend apps/frontend

RUN pnpm --filter pas-frontend build

FROM nginx:1.27-alpine AS runner

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

HEALTHCHECK --interval=10s --timeout=3s --retries=12 --start-period=10s \
  CMD wget -qO- http://127.0.0.1/ || exit 1
