from math import ceil
from typing import Self

from pydantic import BaseModel, Field

from src.models.product import INT4_MAX


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1, le=INT4_MAX)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def paginate(cls, items: list[T], page: int, page_size: int) -> Self:
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size

        return cls.from_page(items[start:end], page, page_size, total)

    @classmethod
    def from_page(
        cls, items: list[T], page: int, page_size: int, total: int, **extra
    ) -> Self:
        total_pages = ceil(total / page_size) if total > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            **extra,
        )

    @classmethod
    def from_params(cls, items: list[T], params: PageParams, total: int, **extra) -> Self:
        return cls.from_page(items, params.page, params.page_size, total, **extra)
