$ErrorActionPreference = "Stop"

$ComposeEnvFile = if ($env:DOCKER_COMPOSE_ENV_FILE) { $env:DOCKER_COMPOSE_ENV_FILE } else { ".env.compose.local" }

if (-not (Test-Path -LiteralPath $ComposeEnvFile)) {
    throw "Missing $ComposeEnvFile. Copy .env.compose.example to $ComposeEnvFile and edit it before starting Docker."
}

docker compose --env-file $ComposeEnvFile down --remove-orphans
docker compose --env-file $ComposeEnvFile build --pull
docker compose --env-file $ComposeEnvFile up -d

# Removes obsolete/dangling image layers left by previous builds.
# It does not remove volumes, so database data on the external PostgreSQL server is untouched.
docker image prune -f --filter "dangling=true"

# Removes images from the old project name after the rename to Mailread.
docker image rm mailman-backend:latest mailman-frontend:latest 2>$null

if ($env:CLEAN_BUILD_CACHE -eq "true") {
    docker builder prune -f --filter "until=24h"
}
