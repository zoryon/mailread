#!/usr/bin/env sh
set -eu

COMPOSE_ENV_FILE="${DOCKER_COMPOSE_ENV_FILE:-.env.compose.local}"

if [ ! -f "$COMPOSE_ENV_FILE" ]; then
  echo "Missing $COMPOSE_ENV_FILE. Copy .env.compose.example to $COMPOSE_ENV_FILE and edit it before starting Docker." >&2
  exit 1
fi

docker compose --env-file "$COMPOSE_ENV_FILE" down --remove-orphans
docker compose --env-file "$COMPOSE_ENV_FILE" build --pull
docker compose --env-file "$COMPOSE_ENV_FILE" up -d

# Removes obsolete/dangling image layers left by previous builds.
# It does not remove volumes, so database data on the external PostgreSQL server is untouched.
docker image prune -f --filter "dangling=true"

# Removes images from the old project name after the rename to Mailread.
docker image rm mailman-backend:latest mailman-frontend:latest 2>/dev/null || true

if [ "${CLEAN_BUILD_CACHE:-false}" = "true" ]; then
  docker builder prune -f --filter "until=24h"
fi
