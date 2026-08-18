# Configuração do Ambiente de Desenvolvimento

Este projeto usa **Docker Compose** para rodar o PostgreSQL e o backend. O backend, ao
ser construído, já inclui o build de produção do frontend. Para desenvolvimento com
hot-reload, backend e frontend também podem ser executados separadamente fora do Docker.

## Dependências

- Docker e Docker Compose
- Node.js 22 LTS (apenas para rodar o frontend fora do Docker)
- Python 3.12 (apenas para rodar o backend fora do Docker)

## 1. Configurar variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Gere valores aleatórios para `SESSION_SECRET_KEY` e `JWT_SECRET_KEY`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**NUNCA** faça commit do arquivo `.env`.

## 2. Credenciais OAuth (Google)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Crie um "OAuth 2.0 Client ID" do tipo "Web application"
3. Adicione como Redirect URI (desenvolvimento): `http://localhost:8000/api/auth/callback/google`
4. Copie o Client ID e o Client Secret para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`

## 3. Subir o projeto com Docker

```bash
make up
```

Isso builda a imagem do backend (que inclui o build do frontend) e sobe o Postgres.
A aplicação fica disponível em `http://localhost:8000`.

Na primeira vez, gere e aplique as migrations:

```bash
make makemigration m="create user table"
make migrate
```

## 4. Fluxo de desenvolvimento (com hot-reload)

Suba apenas o banco de dados via Docker:

```bash
docker compose up db
```

Em outro terminal, rode o backend localmente:

```bash
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn src.main:app --reload --env-file ../.env
```

> Ao rodar o backend fora do Docker, ajuste `DATABASE_URL` no `.env` para usar
> `localhost` no lugar de `db` como host do Postgres — `db` só é resolvido dentro
> da rede do Docker Compose.

Em outro terminal, rode o frontend:

```bash
cd web
npm install
npm run dev
```

O Vite roda em `http://localhost:5173` e faz proxy de `/api` para `http://localhost:8000`,
então o frontend sempre chama caminhos relativos (`/api/...`) tanto em desenvolvimento
quanto em produção.

## Comandos úteis (Makefile)

```bash
make up                            # sobe tudo via Docker
make down                          # derruba os containers
make logs                          # segue os logs
make migrate                       # aplica as migrations pendentes
make makemigration m="mensagem"    # gera uma nova migration
make lint                          # roda ruff (backend) e eslint (frontend)
make test                          # roda os testes do backend
```
