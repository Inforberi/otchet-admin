# ============================================
# Stage 1: Base (node + pnpm via corepack)
# ============================================
FROM node:22-slim AS base
LABEL maintainer="admin-panel"

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

# ============================================
# Stage 2: Dependencies
# ============================================
FROM base AS deps

COPY package.json pnpm-lock.yaml* ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Stage 3: Playwright base — отдельная стадия
# Пересобирается только если меняется FROM или список пакетов.
# Кешируется между всеми другими сборками.
# ============================================
FROM base AS playwright-base

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npx playwright install chromium && \
    npx playwright install-deps chromium && \
    chmod -R 755 /ms-playwright

# ============================================
# Stage 4: Builder
# ============================================
FROM base AS builder

COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

RUN pnpm prisma generate

RUN pnpm build

# ============================================
# Stage 5: Migrator
# ============================================
FROM base AS migrator

COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma

ENV NODE_ENV=production \
    DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

# Force Prisma to download the schema engine during image build,
# so migrate deploy does not need network access at container start.
RUN pnpm exec prisma migrate diff \
    --from-empty \
    --to-schema-datamodel prisma/schema.prisma \
    --script > /tmp/prisma-migrate.sql && rm /tmp/prisma-migrate.sql

CMD ["pnpm", "prisma", "migrate", "deploy"]

# ============================================
# Stage 6: Production runner (minimal)
# ============================================
FROM playwright-base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/nextjs \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs && \
    mkdir -p /home/nextjs/.cache && \
    chown -R nextjs:nodejs /home/nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p /app/uploads && chmod 777 /app/uploads && \
    chown nextjs:nodejs /ms-playwright

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
