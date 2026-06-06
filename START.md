# Backend

For Docker startup, use [DOCKER_START.md](DOCKER_START.md).

Create `backend/.env.backend.local` from the example if it does not exist:

```powershell
Copy-Item backend/.env.backend.example backend/.env.backend.local
```

```bash
cp backend/.env.backend.example backend/.env.backend.local
```

PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8002
```

Linux/macOS Bash:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8002
```

Git Bash on Windows:

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8002
```

If you need an admin account:

PowerShell:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py createsuperuser
```

Linux/macOS Bash:

```bash
cd backend
source .venv/bin/activate
python manage.py createsuperuser
```

Git Bash on Windows:

```bash
cd backend
source .venv/Scripts/activate
python manage.py createsuperuser
```

# Frontend

Create `frontend/.env.local` from the example if it does not exist:

```powershell
Copy-Item frontend/.env.local.example frontend/.env.local
```

```bash
cp frontend/.env.local.example frontend/.env.local
```

Frontend env naming:

- `FRONTEND_SERVER_*`: used by the Next server only.
- `NEXT_PUBLIC_FRONTEND_*`: intentionally visible in the browser.

```powershell
cd frontend
cmd /c pnpm install
cmd /c pnpm dev
```

```bash
cd frontend
pnpm install
pnpm dev
```

Next runs at `http://localhost:3002` and proxies API calls to Django through `FRONTEND_SERVER_DJANGO_API_URL`.

# Elevated Users

Staff and superuser creation sends an approval email.

For real email delivery, configure SMTP in `backend/.env.backend.local`:

```text
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=your-smtp-user
EMAIL_HOST_PASSWORD=your-smtp-password
DEFAULT_FROM_EMAIL=Mailread <no-reply@your-domain.com>
ADMIN_APPROVAL_EMAIL=approver@example.com
```

`ADMIN_APPROVAL_EMAIL` receives the approval button. If it is empty, the email is sent to the logged-in superuser who requested the elevated account.
