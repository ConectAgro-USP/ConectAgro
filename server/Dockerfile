# syntax=docker/dockerfile:1

FROM node:22-alpine3.24 AS web-build
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts
COPY web/ .
RUN npm run build

FROM python:3.12-slim-trixie AS runtime
WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/src ./src
COPY server/alembic ./alembic
COPY server/alembic.ini .
COPY --from=web-build /web/dist ./static

# Código do root e só leitura para o app, mesmo com umask restritiva ou checkout 0777 no WSL2
RUN useradd --create-home --shell /usr/sbin/nologin app && chmod -R a+rX,go-w /app
USER app

EXPOSE 8000
# Mesmo contrato do start.sh do Render, inline porque checkouts no Windows trazem o .sh com CRLF
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn src.main:app --host 0.0.0.0 --port 8000"]
