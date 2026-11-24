from datetime import UTC, datetime

from sqlalchemy import DateTime, LargeBinary
from sqlmodel import Field, SQLModel


class ProductPicture(SQLModel, table=True):
    # o Render gratuito não tem disco persistente, então a foto fica no banco
    __tablename__ = "product_pictures"

    id: int | None = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="products.id", unique=True, ondelete="CASCADE")
    data: bytes = Field(sa_type=LargeBinary)
    content_type: str = Field(max_length=20)
    etag: str = Field(max_length=64)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
