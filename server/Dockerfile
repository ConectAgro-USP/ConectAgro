# syntax=docker/dockerfile:1

FROM node:22-alpine AS web-build
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ .
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/src ./src
COPY server/alembic ./alembic
COPY server/alembic.ini .
COPY --from=web-build /web/dist ./static

RUN useradd --create-home --shell /usr/sbin/nologin app \
    && chown -R app:app /app
USER app

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
