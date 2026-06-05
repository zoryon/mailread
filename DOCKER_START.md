# Docker Startup

This guide starts the full app with Docker:

- `backend`: Django API served by Gunicorn.
- `frontend`: Next.js production server.
- PostgreSQL is external and is not created by Docker Compose.

The database data is stored in the external PostgreSQL server. Rebuilding or deleting the app containers does not delete database data.

# Env File Naming Convention

Use these filenames:

```text
.env.compose.local           Docker Compose values for this machine
.env.compose.example         Safe template for .env.compose.local
backend/.env.backend.local   Backend secrets/runtime values for this machine
backend/.env.backend.example Safe template for backend/.env.backend.local
frontend/.env.local          Next.js local-dev values only
frontend/.env.local.example  Safe template for frontend/.env.local
```

Rules:

- `.local` files are real machine-specific config and should not be committed.
- `.example` files are templates and can be committed.
- Backend secrets go in `backend/.env.backend.local`.
- Docker Compose values go in `.env.compose.local`.
- `frontend/.env.local` keeps the standard Next.js filename, but it is only for local `pnpm dev`, not Docker.

# 1. Requirements

Install Docker with Docker Compose support.

Check it:

```bash
docker --version
docker compose version
```

On PowerShell:

```powershell
docker --version
docker compose version
```

You also need an existing PostgreSQL database. The database itself must already exist before starting Docker. The configured PostgreSQL user does not need to be a PostgreSQL superuser, but it must be allowed to connect to the database and create/read/update/delete the app tables.

# 2. Create The Docker Compose Env

This file lives at the project root:

```text
.env.compose.local
```

Create it from the example before starting Docker.

Linux/macOS Bash:

```bash
cp .env.compose.example .env.compose.local
```

PowerShell:

```powershell
Copy-Item .env.compose.example .env.compose.local
```

If `.env.compose.local` already exists, edit it instead of overwriting it.

Open `.env.compose.local` and keep or edit these values:

```text
DOCKER_BACKEND_ENV_FILE=./backend/.env.backend.local
FRONTEND_PUBLIC_EMAIL_DOMAINS=zoryo.uk,gmail.com
FRONTEND_SERVER_DJANGO_API_URL=http://backend:8000
FRONTEND_SERVER_JWT_ACCESS_SECONDS=600
FRONTEND_SERVER_JWT_REFRESH_SECONDS=604800
```

What this file does:

- `DOCKER_BACKEND_ENV_FILE` tells Compose which backend env file to load.
- `FRONTEND_PUBLIC_EMAIL_DOMAINS` controls the email domain dropdown. This value is intentionally public.
- `FRONTEND_SERVER_DJANGO_API_URL` tells the Next server where to reach Django from inside Docker.
- `FRONTEND_SERVER_JWT_ACCESS_SECONDS` and `FRONTEND_SERVER_JWT_REFRESH_SECONDS` tell the Next server cookie layer how long tokens should live.

Naming convention:

- `DOCKER_*`: used by Docker Compose.
- `FRONTEND_SERVER_*`: used by the Next server only. Do not expose these directly in client code.
- `FRONTEND_PUBLIC_*`: safe to expose to visitors. Do not put secrets here.
- `NEXT_PUBLIC_*`: Next.js technical prefix for browser-visible values. In Docker, Compose maps `FRONTEND_PUBLIC_EMAIL_DOMAINS` to `NEXT_PUBLIC_FRONTEND_EMAIL_DOMAINS`.
- Backend secrets stay in `backend/.env.backend.local`.

Security note:

- Visitors cannot download `.env.compose.local` or `backend/.env.backend.local` from the website.
- These files are excluded from Docker images by `.dockerignore`.
- Do not put secrets in variables that start with `FRONTEND_PUBLIC_` or `NEXT_PUBLIC_`. Those values are allowed to be visible in the browser.
- Backend secrets such as `SECRET_KEY`, `DATABASE_URL`, `POSTGRES_PASSWORD`, and `EMAIL_HOST_PASSWORD` belong in `backend/.env.backend.local`.

If you change `FRONTEND_PUBLIC_EMAIL_DOMAINS`, rebuild the frontend because public Next.js values are included during build.

`frontend/.env.local` is used only when you run `pnpm dev` locally. Docker uses `.env.compose.local`, `docker-compose.yml`, and `backend/.env.backend.local`.

# 3. Create The Backend Env

This file is loaded inside the backend container:

```text
backend/.env.backend.local
```

If it does not exist yet, create it from the example.

Linux/macOS Bash:

```bash
cp backend/.env.backend.example backend/.env.backend.local
```

PowerShell:

```powershell
Copy-Item backend/.env.backend.example backend/.env.backend.local
```

If `backend/.env.backend.local` already exists, edit it instead of overwriting it.

Open `backend/.env.backend.local` and set the backend values before starting Docker.

Recommended local Docker example:

```text
SECRET_KEY=replace-with-a-long-random-secret
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,backend
FRONTEND_URL=http://localhost:3000
ADMIN_APPROVAL_EMAIL=

DATABASE_URL=postgresql://postgres_user:postgres_password@host.docker.internal:5432/mailread
DB_CONN_MAX_AGE=600
DB_SSL_REQUIRE=False

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=your-smtp-user
EMAIL_HOST_PASSWORD=your-smtp-password
EMAIL_TIMEOUT=20
DEFAULT_FROM_EMAIL=Mailread <no-reply@your-domain.com>

JWT_ACCESS_MINUTES=10
JWT_REFRESH_DAYS=7
ELEVATED_USER_APPROVAL_MINUTES=30
```

For production, `FRONTEND_URL` should be the public frontend URL, for example:

```text
FRONTEND_URL=https://app.example.com
```

For production, `ALLOWED_HOSTS` should include the public backend host and `backend`, for example:

```text
ALLOWED_HOSTS=api.example.com,backend
```

If PostgreSQL runs on the same machine as Docker, use:

```text
host.docker.internal
```

Example:

```text
DATABASE_URL=postgresql://postgres_user:postgres_password@host.docker.internal:5432/mailread
```

If PostgreSQL runs on another server, use that server host or IP:

```text
DATABASE_URL=postgresql://postgres_user:postgres_password@db.example.com:5432/mailread
```

You can also avoid `DATABASE_URL` and use separate values:

```text
DATABASE_URL=
POSTGRES_HOST=host.docker.internal
POSTGRES_PORT=5432
POSTGRES_DB=mailread
POSTGRES_USER=postgres_user
POSTGRES_PASSWORD=postgres_password
DB_CONN_MAX_AGE=600
DB_SSL_REQUIRE=False
```

Do not commit `.env.compose.local` or `backend/.env.backend.local`.

# 4. Start Docker

Run the cleanup startup script from the project root.

PowerShell:

```powershell
.\scripts\docker-up.ps1
```

Linux/macOS Bash:

```bash
sh scripts/docker-up.sh
```

The script does this:

```text
docker compose --env-file .env.compose.local down --remove-orphans
docker compose --env-file .env.compose.local build --pull
docker compose --env-file .env.compose.local up -d
docker image prune -f --filter "dangling=true"
```

It removes old orphan containers and dangling image layers from previous builds. It does not remove Docker volumes and does not touch the external PostgreSQL data.

During backend startup, the backend container automatically:

- waits for PostgreSQL to be reachable;
- collects static files;
- runs Django migrations;
- starts Gunicorn on port `8000`.

# 5. Check The App

Open the frontend:

```text
http://localhost:3000
```

The backend API is exposed at:

```text
http://localhost:8000
```

Check running containers:

```bash
docker compose --env-file .env.compose.local ps
```

PowerShell:

```powershell
docker compose --env-file .env.compose.local ps
```

Read logs:

```bash
docker compose --env-file .env.compose.local logs -f backend
docker compose --env-file .env.compose.local logs -f frontend
```

PowerShell:

```powershell
docker compose --env-file .env.compose.local logs -f backend
docker compose --env-file .env.compose.local logs -f frontend
```

# 6. Create The First Django Superuser

After the containers are running and migrations have completed, create the first application superuser:

```bash
docker compose --env-file .env.compose.local exec backend python manage.py createsuperuser
```

PowerShell:

```powershell
docker compose --env-file .env.compose.local exec backend python manage.py createsuperuser
```

This user is saved in the external PostgreSQL database. It is not a PostgreSQL database superuser; it is the Django admin/superuser account used by the app.

# 7. If You Change Env Values Later

Backend-only env changes, such as SMTP, PostgreSQL settings, `ALLOWED_HOSTS`, or `FRONTEND_URL`:

```bash
docker compose --env-file .env.compose.local up -d --force-recreate backend
```

PowerShell:

```powershell
docker compose --env-file .env.compose.local up -d --force-recreate backend
```

Frontend build env changes, such as `FRONTEND_PUBLIC_EMAIL_DOMAINS`:

```bash
docker compose --env-file .env.compose.local build frontend
docker compose --env-file .env.compose.local up -d frontend
```

PowerShell:

```powershell
docker compose --env-file .env.compose.local build frontend
docker compose --env-file .env.compose.local up -d frontend
```

Frontend runtime env changes, such as `FRONTEND_SERVER_JWT_ACCESS_SECONDS`, `FRONTEND_SERVER_JWT_REFRESH_SECONDS`, or `FRONTEND_SERVER_DJANGO_API_URL`:

```bash
docker compose --env-file .env.compose.local up -d --force-recreate frontend
```

PowerShell:

```powershell
docker compose --env-file .env.compose.local up -d --force-recreate frontend
```

For the clean full restart, use the startup script again:

```bash
sh scripts/docker-up.sh
```

PowerShell:

```powershell
.\scripts\docker-up.ps1
```

# 8. Stop Docker

Stop the app:

```bash
docker compose --env-file .env.compose.local down
```

PowerShell:

```powershell
docker compose --env-file .env.compose.local down
```

This stops and removes the app containers. It does not delete the external PostgreSQL database.

# 9. Useful Commands

Run Django checks:

```bash
docker compose --env-file .env.compose.local exec backend python manage.py check
```

Run Django tests:

```bash
docker compose --env-file .env.compose.local exec backend python manage.py test
```

Run migrations manually:

```bash
docker compose --env-file .env.compose.local exec backend python manage.py migrate
```

Open a backend shell:

```bash
docker compose --env-file .env.compose.local exec backend python manage.py shell
```

Rebuild without using cache:

```bash
docker compose --env-file .env.compose.local build --no-cache
docker compose --env-file .env.compose.local up -d
```

Clean old build cache older than 24 hours:

```bash
CLEAN_BUILD_CACHE=true sh scripts/docker-up.sh
```

PowerShell:

```powershell
$env:CLEAN_BUILD_CACHE = "true"
.\scripts\docker-up.ps1
Remove-Item Env:CLEAN_BUILD_CACHE
```
