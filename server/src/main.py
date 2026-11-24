from http import HTTPStatus
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from src.api.routes import api_router
from src.api.validation_messages import portuguese_message
from src.core.config import settings

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
SPA_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}
# trocam só o texto padrão em inglês, as rotas mandam mensagens próprias
DEFAULT_DETAILS = {
    status.HTTP_401_UNAUTHORIZED: "Não autenticado",
    status.HTTP_403_FORBIDDEN: "Acesso negado",
    status.HTTP_404_NOT_FOUND: "Recurso não encontrado",
    status.HTTP_405_METHOD_NOT_ALLOWED: "Método não permitido",
}
INTERNAL_ERROR = "Algo deu errado no servidor. Tente novamente mais tarde"

app = FastAPI(title="ConectAgro API", openapi_url=None if settings.is_prod else "/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY,
    https_only=settings.is_prod,
    max_age=60 * 60,  # só guarda o state do OAuth, que o Authlib expira em 1 h
)

app.include_router(api_router, prefix="/api")


@app.exception_handler(RequestValidationError)
async def hide_invalid_input(request: Request, error: RequestValidationError) -> JSONResponse:
    # o valor enviado fica fora da resposta, ele pode ser uma senha ou não caber em JSON
    detail = [
        {"type": item["type"], "loc": item["loc"], "msg": portuguese_message(item)}
        for item in error.errors()
    ]
    return JSONResponse({"detail": detail}, status.HTTP_422_UNPROCESSABLE_CONTENT)


@app.exception_handler(StarletteHTTPException)
async def translate_default_detail(request: Request, error: StarletteHTTPException) -> JSONResponse:
    default_phrase = HTTPStatus(error.status_code).phrase
    if error.detail == default_phrase and error.status_code in DEFAULT_DETAILS:
        detail = DEFAULT_DETAILS[error.status_code]
        error = StarletteHTTPException(error.status_code, detail, error.headers)
    return await http_exception_handler(request, error)


@app.exception_handler(Exception)
async def hide_internal_error(request: Request, error: Exception) -> JSONResponse:
    # o Starlette registra o erro depois, a resposta só não mostra o detalhe
    return JSONResponse({"detail": INTERNAL_ERROR}, status.HTTP_500_INTERNAL_SERVER_ERROR)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "commit": settings.RENDER_GIT_COMMIT}


if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        return FileResponse(STATIC_DIR / "index.html", headers=SPA_HEADERS)
