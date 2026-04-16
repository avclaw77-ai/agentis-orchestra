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

USER studio
EXPOSE 3000
CMD ["node", "server.js"]
