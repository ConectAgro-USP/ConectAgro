# Troubleshooting

Problemas comuns durante a configuração e execução do projeto.

## `bind: address already in use` ao subir o Postgres

Se você já tem um PostgreSQL rodando localmente na porta 5432 (fora do Docker), o
`docker compose up` vai falhar ao tentar publicar essa porta. Mude `POSTGRES_PORT`
no `.env` para uma porta livre (ex.: `5433`) e suba novamente.

## O backend não conecta ao Postgres

Se estiver rodando o backend **fora** do Docker (`uvicorn` local) enquanto o Postgres
roda via `docker compose up db`, confirme que `DATABASE_URL` no `.env` aponta para
`localhost`, não para `db`, esse hostname só é resolvido dentro da rede do Docker Compose.

## Erro `redirect_uri_mismatch` no login com Google

A Redirect URI cadastrada no Google Cloud Console precisa ser **exatamente**
`<FRONTEND_URL>/api/auth/callback/google` (veja o passo 2 do [SETUP](SETUP.MD)). Verifique
também se `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no `.env` correspondem ao client OAuth
correto.

## `alembic` não encontra as tabelas / migration gerada vazia

Certifique-se de que o model novo está importado em `server/src/models/__init__.py`.

O Alembic só detecta tabelas cujos models foram importados antes de gerar a migration.

## Mudanças no frontend não aparecem no `make up`

O `make up` serve o build do frontend embutido na imagem do backend. Depois de alterar
código em `web/`, rode `make up` para gerar uma nova imagem e recriar o container (o
`make build` só gera a imagem). Em produção, o frontend é publicado na Vercel pelo
workflow Deploy a cada push na `main`.
