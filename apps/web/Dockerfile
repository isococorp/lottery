# syntax=docker/dockerfile:1
# Build context is the REPO ROOT (not apps/web): the Prisma schema lives in
# packages/db/prisma and must be generated into apps/web before `next build`.
#   docker build -f apps/web/Dockerfile .

FROM node:20-slim AS deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-slim AS builder
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# Schema first so a source-only edit does not bust the generate layer.
COPY packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma
COPY apps/web ./apps/web
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder only — nothing connects at build time (DB-backed pages are
# force-dynamic). The real URL comes from the environment at runtime.
ARG DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV DATABASE_URL=$DATABASE_URL
# Prisma client must exist before `next build` — route handlers import it.
RUN npx prisma generate --schema=/app/packages/db/prisma/schema.prisma
RUN npm run build

FROM node:20-slim AS runner
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
# Next's file tracing can miss the native query engine; copy the client outright.
COPY --from=builder /app/apps/web/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/web/node_modules/@prisma/client ./node_modules/@prisma/client
EXPOSE 3000
CMD ["node", "server.js"]
