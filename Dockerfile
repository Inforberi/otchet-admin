# ============================================
# Stage 1: Base (node + pnpm via corepack)
# ============================================
FROM node:22-alpine AS base
LABEL maintainer="admin-panel"

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Enable pnpm via corepack (no apk upgrade for reproducibility)
RUN corepack enable && corepack prepare pnpm@latest --activate

# ============================================
# Stage 2: Builder
# ============================================
FROM base AS builder
WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml* ./

# Install all deps (dev + prod) with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build-time environment variables
# Фейковый DATABASE_URL для Prisma generate на этапе сборки
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

# Generate Prisma Client
RUN pnpm prisma generate

# Build Next.js standalone output
RUN pnpm build

# ============================================
# Stage 3: Production runner (minimal)
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Install ONLY runtime tools
RUN apk add --no-cache \
    dumb-init \
    curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes server.js + node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema and files needed for runtime generation
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Enable pnpm in runner (нужен для миграций в docker-compose)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install only production dependencies needed for Prisma runtime
# Prisma Client уже сгенерирован в builder и включен в standalone
# Но нужны зависимости для миграций (prisma CLI)
RUN --mount=type=cache,id=pnpm-runner,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# Генерируем Prisma Client в runtime (на случай если DATABASE_URL изменился)
# DATABASE_URL будет установлен через docker-compose.yml
RUN pnpm prisma generate

# Создаем директорию для uploads с правильными правами
# Права 777 нужны, так как volume может монтироваться с хоста
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Переключаемся на непривилегированного пользователя
USER nextjs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
