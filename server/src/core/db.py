from sqlmodel import create_engine

from src.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    hide_parameters=settings.is_prod,
    pool_pre_ping=True,
)
