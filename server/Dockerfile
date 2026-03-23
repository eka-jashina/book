FROM node:25-alpine AS builder

# Mirror local repo layout so tsconfig rootDir:".." resolves consistently
WORKDIR /project/server

# Install dependencies (separate layer for caching)
COPY server/package.json server/package-lock.json* ./
RUN npm install -g npm@latest && npm ci

# Copy prisma schema and generate client
COPY server/prisma ./prisma/
RUN npx prisma generate

# Copy source code and shared modules, then build
COPY server/tsconfig.json ./
COPY server/src ./src/
COPY shared /project/shared/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────

FROM node:25-alpine

# dumb-init: proper PID 1 signal forwarding (SIGTERM → Node.js)
RUN apk add --no-cache dumb-init

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --chown=appuser:appgroup server/package.json server/package-lock.json* ./
RUN npm install -g npm@latest && npm ci --omit=dev && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && chown -R appuser:appgroup node_modules

# Copy prisma schema and generated client from builder
COPY --chown=appuser:appgroup --from=builder /project/server/prisma ./prisma/
COPY --chown=appuser:appgroup --from=builder /project/server/node_modules/.prisma ./node_modules/.prisma

# Copy compiled JavaScript
COPY --chown=appuser:appgroup --from=builder /project/server/dist ./dist/

ENV NODE_ENV=production
EXPOSE 4000

# Health check — container orchestrators use this to detect unhealthy instances
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

USER appuser

# dumb-init ensures SIGTERM is forwarded to the Node.js process
# Migration must be run separately before scaling (e.g., init container, CI step, or one-off job):
#   docker run --rm <image> ./node_modules/.bin/prisma migrate deploy
# To run migration at startup (single-instance only), set RUN_MIGRATIONS=true
CMD ["dumb-init", "sh", "-c", "if [ \"$RUN_MIGRATIONS\" = 'true' ]; then ./node_modules/.bin/prisma migrate deploy; fi && exec node dist/server/src/index.js"]
