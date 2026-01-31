# Multi-stage Dockerfile for ServiceBooking
# Production build for Git + Timeweb Cloud App Platform (Docker)

FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack (project uses pnpm)
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Install dependencies (--no-frozen-lockfile: lockfile может отставать от package.json после добавления nodemailer и др.)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Copy source (client, server, shared, configs)
COPY . .

# Build client (SPA) and server
RUN pnpm run build

# Runtime image
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy built artifacts and run script
COPY --from=builder /app/dist /app/dist
COPY package.json pnpm-lock.yaml ./
COPY deploy/run-server.sh /app/run-server.sh
RUN chmod +x /app/run-server.sh

# Production deps only (no devDependencies)
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate && \
    pnpm install --no-frozen-lockfile --prod

# Optional: for HEALTHCHECK (Alpine has no wget by default)
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Долгий start-period: холодный старт Node + pnpm может занять время
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:8080/health" || exit 1

CMD ["sh", "/app/run-server.sh"]
