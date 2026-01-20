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
# Используем Debian-based образ для лучшей поддержки Playwright
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Install ONLY runtime tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user с домашней директорией
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs && \
    mkdir -p /home/nextjs/.cache && \
    chown -R nextjs:nodejs /home/nextjs

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
# Устанавливаем HOME перед corepack, чтобы он мог создать кеш
ENV HOME=/home/nextjs
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install only production dependencies needed for Prisma runtime
# Prisma Client уже сгенерирован в builder и включен в standalone
# Но нужны зависимости для миграций (prisma CLI) и Playwright
RUN --mount=type=cache,id=pnpm-runner,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# Генерируем Prisma Client в runtime (на случай если DATABASE_URL изменился)
# DATABASE_URL будет установлен через docker-compose.yml
RUN pnpm prisma generate

# Устанавливаем системные зависимости для Playwright
# Используем команду Playwright для автоматической установки всех зависимостей
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        wget \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Устанавливаем браузеры Playwright для генерации PDF
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium && \
    npx playwright install-deps chromium && \
    chmod -R 755 /ms-playwright && \
    chown -R nextjs:nodejs /ms-playwright

# Создаем директорию для uploads с правильными правами
# Права 777 нужны, так как volume может монтироваться с хоста
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Переключаемся на непривилегированного пользователя
USER nextjs

EXPOSE 3000

# Используем node напрямую
CMD ["node", "server.js"]
