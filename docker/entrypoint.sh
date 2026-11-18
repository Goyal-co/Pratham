#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running DB migrations..."
  node scripts/docker-migrate.mjs
fi

exec "$@"
