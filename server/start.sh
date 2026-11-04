#!/bin/sh
set -e
alembic upgrade head
# 1 explícito: sem ele, o uvicorn lê o WEB_CONCURRENCY e multiplica os limites
exec uvicorn src.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
