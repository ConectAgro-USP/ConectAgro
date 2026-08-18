from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")

    APP_FLAVOR: str = "dev"

    DATABASE_URL: str

    SESSION_SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_METADATA_URL: str = "" 
    GOOGLE_CLIENT_SECRET: str = ""

    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_CORS_ORIGINS: str = ""

    @property
    def cors_origins(self) -> list[str]:
        raw_origins = self.BACKEND_CORS_ORIGINS.split(",")
        origins = [origin.strip() for origin in raw_origins if origin.strip()]
        return origins or [self.FRONTEND_URL]

    @property
    def is_prod(self) -> bool:
        return self.APP_FLAVOR == "prod"


settings = Settings()
