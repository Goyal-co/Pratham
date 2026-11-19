#!/bin/sh
set -e

# Ensure tables exist (migrations are idempotent: IF NOT EXISTS).
# Skip only when SKIP_MIGRATIONS=true.
if [ "${SKIP_MIGRATIONS}" = "true" ]; then
  echo "Skipping migrations (SKIP_MIGRATIONS=true)"
else
  echo "Ensuring database schema (create tables if missing)..."
  node scripts/docker-migrate.mjs
fi

# Seed / refresh admin from ADMIN_EMAIL + ADMIN_PASSWORD when set
if [ -n "${ADMIN_EMAIL}" ] && [ -n "${ADMIN_PASSWORD}" ] && [ "${SKIP_ADMIN_SEED}" != "true" ]; then
  echo "Ensuring admin user from env..."
  node scripts/docker-seed-admin.mjs || echo "Admin seed skipped/failed (non-fatal)"
fi

exec "$@"
