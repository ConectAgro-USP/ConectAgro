from sqlmodel import create_engine

from src.core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=not settings.is_prod)
