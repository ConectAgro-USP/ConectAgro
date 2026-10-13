# Configuração do Ambiente de Desenvolvimento

Este projeto usa **Docker Compose** para rodar o PostgreSQL e o backend localmente. A imagem
do backend já inclui o build do frontend (em produção, o frontend fica na Vercel e o backend
no Render). Para desenvolvimento com hot-reload, backend e frontend também podem ser
executados separadamente fora do Docker.

## Dependências

- Docker e Docker Compose
- GNU Make e um shell POSIX (no Windows, use o WSL2)
- Node.js 22.12+ e Python 3.12, para o fluxo com hot-reload, as migrations, `make lint` e `make test`

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
3. Adicione as Redirect URIs `http://localhost:5173/api/auth/callback/google` (Vite) e
   `http://localhost:8000/api/auth/callback/google` (`make up`)
4. Copie o Client ID e o Client Secret para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`

## 3. Subir o projeto com Docker

```bash
make up
```

Isso builda a imagem do backend (que inclui o build do frontend), sobe o Postgres e aplica
as migrations pendentes. A aplicação fica disponível em `http://localhost:8000`.

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
dotenv -f ../.env run -- alembic upgrade head
uvicorn src.main:app --reload --env-file ../.env
```

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
make up                            # builda a imagem e sobe tudo via Docker
make down                          # derruba os containers
make build                         # só builda a imagem, sem recriar os containers
make logs                          # segue os logs
make migrate                       # aplica as migrations pendentes (venv ativa)
make makemigration m="mensagem"    # gera uma nova migration (venv ativa)
make server-shell                  # abre um shell no container do backend
make db-shell                      # abre o psql no container do banco
make dev-server                    # backend com hot-reload (venv ativa)
make dev-web                       # frontend com hot-reload
make lint                          # roda ruff (backend, venv ativa), eslint e tsc (frontend)
make test                          # roda os testes do backend (venv ativa)
```
