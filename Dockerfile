FROM python:3.14-slim AS backend

LABEL com.mailread.project="mailread"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8002

WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY backend/ ./
COPY docker/backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8002
CMD ["/entrypoint.sh"]


FROM node:24-slim AS frontend-deps

LABEL com.mailread.project="mailread"

WORKDIR /app/frontend
RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


FROM frontend-deps AS frontend-builder

ARG NEXT_PUBLIC_FRONTEND_EMAIL_DOMAINS=zoryo.uk,gmail.com
ENV NEXT_PUBLIC_FRONTEND_EMAIL_DOMAINS=${NEXT_PUBLIC_FRONTEND_EMAIL_DOMAINS}

COPY frontend/ ./
RUN pnpm build


FROM node:24-slim AS frontend

LABEL com.mailread.project="mailread"

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3002

WORKDIR /app/frontend

COPY --from=frontend-builder /app/frontend/public ./public
COPY --from=frontend-builder /app/frontend/.next/standalone ./
COPY --from=frontend-builder /app/frontend/.next/static ./.next/static

EXPOSE 3002
CMD ["node", "server.js"]
