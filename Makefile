.PHONY: up down build logs migrate makemigration server-shell db-shell lint test dev-server dev-web

up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

migrate:
	cd server && dotenv -f ../.env run -- alembic upgrade head

makemigration:
	cd server && dotenv -f ../.env run -- alembic revision --autogenerate -m "$(m)"

server-shell:
	docker compose exec server bash

db-shell:
	docker compose exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

lint:
	cd server && ruff check .
	cd web && npm run lint && npx tsc -b

test:
	cd server && pytest
	cd web && npm test

dev-server:
	cd server && uvicorn src.main:app --reload --env-file ../.env

dev-web:
	cd web && npm run dev
