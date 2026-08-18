# Troubleshooting

Problemas comuns durante a configuração e execução do projeto.

## `bind: address already in use` ao subir o Postgres

Se você já tem um PostgreSQL rodando localmente na porta 5432 (fora do Docker), o
`docker compose up` vai falhar ao tentar publicar essa porta. Mude `POSTGRES_PORT`
no `.env` para uma porta livre (ex.: `5433`) e suba novamente.

## O backend não conecta ao Postgres

Se estiver rodando o backend **fora** do Docker (`uvicorn` local) enquanto o Postgres
roda via `docker compose up db`, confirme que `DATABASE_URL` no `.env` aponta para
`localhost`, não para `db` — esse hostname só é resolvido dentro da rede do Docker Compose.

## Erro `redirect_uri_mismatch` no login com Google

A Redirect URI cadastrada no Google Cloud Console precisa ser **exatamente igual** à
usada pela aplicação: `http://localhost:8000/api/auth/callback/google` em
desenvolvimento. Verifique também se `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no
`.env` correspondem ao client OAuth correto.

## `alembic` não encontra as tabelas / migration gerada vazia

Certifique-se de que o model novo está importado em `server/src/models/__init__.py` —
o Alembic só detecta tabelas cujos models foram importados antes de gerar a migration.

## Mudanças no frontend não aparecem em produção

O build do frontend acontece durante a build da imagem Docker do backend. Depois de
alterar código em `web/`, rode `docker compose up --build` (ou `make build`) para
gerar uma nova imagem com o build atualizado.
