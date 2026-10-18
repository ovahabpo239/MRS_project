# syntax=docker/dockerfile:1.7
# Build context is the repository root, like the other services:
#   docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /app
# Dependencies first: cached until package.json or the lockfile changes.
COPY apps/web/package.json apps/web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app -H -s /sbin/nologin app
# Next.js standalone output: a minimal server plus only the node_modules it needs.
COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=build --chown=10001:10001 /app/public ./public
# SQL migrations, applied on startup when RUN_MIGRATIONS=true.
COPY --from=build --chown=10001:10001 /app/drizzle ./drizzle
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/ready || exit 1
CMD ["node", "server.js"]
