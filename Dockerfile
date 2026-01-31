# Multi-stage Dockerfile for ServiceBooking
# Production build for Git + Timeweb Cloud App Platform (Docker)

FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Install ALL dependencies (need dev deps for build)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Install ONLY production dependencies
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate && \
    pnpm install --no-frozen-lockfile --prod

# For health check
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check: 60s start period for slow cold starts
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD curl -sf http://127.0.0.1:8080/health || exit 1

# Run directly with node
CMD ["node", "dist/server/node-build.mjs"]
