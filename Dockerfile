# syntax=docker/dockerfile:1
# Ahariva admin + student PWA (Next.js) — for AWS ECS/Fargate, EC2, App Runner, etc.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/student/package.json ./apps/student/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
# Install only what the web app needs (skip Expo student workspace install cost)
RUN npm ci --workspace=@pratham/admin --workspace=@pratham/db --workspace=@pratham/shared --include-workspace-root

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
# Workspaces hoist to /app/node_modules (no per-app node_modules)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY apps/admin ./apps/admin
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY db ./db
COPY scripts ./scripts

# NEXT_PUBLIC_* are inlined at build time — pass via --build-arg / compose
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_STUDENT_URL=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_STUDENT_URL=$NEXT_PUBLIC_STUDENT_URL \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build --workspace=@pratham/admin

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone tracing root is the monorepo (see outputFileTracingRoot)
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public
# Migrations helper (optional: RUN_MIGRATIONS=true)
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-migrate.mjs ./scripts/docker-migrate.mjs
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh \
  && mkdir -p ./apps/admin/public/uploads \
  && chown -R nextjs:nodejs ./apps/admin/public/uploads

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["sh", "./docker/entrypoint.sh"]
CMD ["node", "apps/admin/server.js"]
