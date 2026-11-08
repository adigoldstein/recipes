# syntax=docker/dockerfile:1
# One production container (Story 6.1, AD-15): Node builds the React app, then a slim
# Python image serves the API, the photos and the built app from one port.
# Build and run with `docker compose up --build` (see docker-compose.yml).

# ---------- Stage 1: build the React app with Vite ----------
FROM node:24-slim AS web
WORKDIR /repo
ENV NX_DAEMON=false NX_NO_CLOUD=true
# Same npm as local development and CI (`packageManager` in package.json).
RUN npm install -g npm@12.1.0

# Install dependencies first, from the package files only, so this slow layer is
# reused until a dependency changes. Every npm workspace needs its package.json.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY libs/data-access/package.json libs/data-access/
COPY libs/feature-auth/package.json libs/feature-auth/
COPY libs/feature-import/package.json libs/feature-import/
COPY libs/feature-recipes/package.json libs/feature-recipes/
COPY libs/feature-tags/package.json libs/feature-tags/
COPY libs/feature-users/package.json libs/feature-users/
COPY libs/i18n/package.json libs/i18n/
COPY libs/recipe-domain/package.json libs/recipe-domain/
COPY libs/ui-components/package.json libs/ui-components/
COPY tools/lint-checks/package.json tools/lint-checks/
RUN npm ci --no-audit --no-fund

# Then the source, and a plain Vite build (output: apps/web/dist).
COPY tsconfig.base.json tsconfig.json ./
COPY apps/web apps/web
COPY libs libs
RUN npx vite build --config apps/web/vite.config.mts

# ---------- Stage 2: the Python image that runs everything ----------
FROM python:3.13-slim AS app
# uv from its official image, the same version as local development.
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONUNBUFFERED=1

# Runtime dependencies only (no dev tools), exactly as pinned in uv.lock.
COPY apps/recipe-service/pyproject.toml apps/recipe-service/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY apps/recipe-service/app ./app
COPY --from=web /repo/apps/web/dist ./web

# Run as a normal user, never root. /data is created here so the volume that is
# mounted on it starts out owned by that user.
RUN useradd --create-home --uid 1000 app && mkdir /data && chown app:app /data
USER app

# Defaults for the container; secrets (JWT_SECRET, API keys) are never baked in:
# they come from the environment at run time.
ENV PATH=/app/.venv/bin:$PATH \
    ENV=production \
    DATA_DIR=/data \
    WEB_DIR=/app/web

VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"]
# Migrations run inside the app's startup (AD-29), so a failed one stops the container.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
