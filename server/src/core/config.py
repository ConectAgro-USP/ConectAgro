from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")

    APP_FLAVOR: Literal["dev", "prod"] = "prod"

    DATABASE_URL: str
    DB_ECHO: bool = False

    SESSION_SECRET_KEY: str = Field(min_length=32)
    JWT_SECRET_KEY: str = Field(min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_METADATA_URL: str = "https://accounts.google.com/.well-known/openid-configuration"
    GOOGLE_CLIENT_SECRET: str = ""

    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_CORS_ORIGINS: str = ""

    @field_validator("DATABASE_URL")
    @classmethod
    def use_psycopg_driver(cls, url: str) -> str:
        # provedores entregam o esquema postgres ou postgresql, e só o psycopg 3 está instalado
        scheme, _, rest = url.partition("://")
        if scheme in ("postgres", "postgresql"):
            return f"postgresql+psycopg://{rest}"
        return url

    @field_validator("FRONTEND_URL")
    @classmethod
    def strip_trailing_slash(cls, url: str) -> str:
        return url.rstrip("/")

    @field_validator("BACKEND_CORS_ORIGINS")
    @classmethod
    def reject_wildcard_origin(cls, origins: str) -> str:
        if "*" in origins:
            raise ValueError("use origens explícitas: '*' com cookies libera qualquer site")
        return origins

    @property
    def cors_origins(self) -> list[str]:
        raw_origins = self.BACKEND_CORS_ORIGINS.split(",")
        origins = [origin.strip().rstrip("/") for origin in raw_origins if origin.strip()]
        return origins or [self.FRONTEND_URL]

    @property
    def is_prod(self) -> bool:
        return self.APP_FLAVOR == "prod"


settings = Settings()
