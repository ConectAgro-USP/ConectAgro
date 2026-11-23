from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from src.api.routes import api_router
from src.core.config import settings

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
SPA_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}

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
        {"type": item["type"], "loc": item["loc"], "msg": item["msg"]} for item in error.errors()
    ]
    return JSONResponse({"detail": detail}, status.HTTP_422_UNPROCESSABLE_CONTENT)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        return FileResponse(STATIC_DIR / "index.html", headers=SPA_HEADERS)
