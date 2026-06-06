#!/bin/sh
set -eu

python <<'PY'
import os
import time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "main.settings")

import django
from django.db import connections
from django.db.utils import OperationalError

django.setup()

attempts = int(os.environ.get("DB_WAIT_ATTEMPTS", "30"))
delay = float(os.environ.get("DB_WAIT_SECONDS", "2"))

for attempt in range(1, attempts + 1):
    try:
        connections["default"].ensure_connection()
        print("Database connection ready.")
        break
    except OperationalError as exc:
        if attempt == attempts:
            raise
        print(f"Database unavailable ({exc}); retrying {attempt}/{attempts}...")
        time.sleep(delay)
PY

python manage.py collectstatic --noinput
python manage.py migrate --noinput

exec gunicorn main.wsgi:application \
  --bind "0.0.0.0:${PORT:-8002}" \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-60}"
