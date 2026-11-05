from math import ceil
from typing import Self

from pydantic import BaseModel


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def paginate(cls, items: list[T], page: int, page_size: int) -> Self:
        total = len(items)
        total_pages = ceil(total / page_size) if total > 0 else 0
        start = (page - 1) * page_size
        end = start + page_size

        return cls(
            items=items[start:end],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
