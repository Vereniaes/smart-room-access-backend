# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile - smart-room-access-backend (Node.js)
# ──────────────────────────────────────────────────────────────────────────────
# stage 1: install deps
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ──────────────────────────────────────────────────────────────────────────────
# stage 2: runtime
FROM node:20-alpine AS runner

WORKDIR /app

# jalankan sebagai non-root user (security best practice)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodeuser

# copy deps dari stage 1
COPY --from=deps /app/node_modules ./node_modules

# copy source - exclude ml-service (punya Dockerfile sendiri)
COPY config   ./config
COPY src      ./src
COPY index.js ./index.js

USER nodeuser

# Cloud Run inject PORT env var
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/ || exit 1

CMD ["node", "index.js"]
