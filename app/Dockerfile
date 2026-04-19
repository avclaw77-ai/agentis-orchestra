FROM node:22-alpine AS base
RUN apk add --no-cache wget
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 studio && \
    adduser --system --uid 1001 studio

COPY --from=builder /app/public ./public
COPY --from=builder --chown=studio:studio /app/.next/standalone ./
COPY --from=builder --chown=studio:studio /app/.next/static ./.next/static

# Include migration support (drizzle schema + config)
COPY --from=builder --chown=studio:studio /app/src/db ./src/db
COPY --from=builder --chown=studio:studio /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=studio:studio /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder --chown=studio:studio /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

# Entrypoint script (runs migrations then starts server)
COPY --chown=studio:studio entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Writable directories for uploads and attachments
RUN mkdir -p /app/uploads/task-attachments && chown -R studio:studio /app/uploads

USER studio
EXPOSE 3000
CMD ["./entrypoint.sh"]
