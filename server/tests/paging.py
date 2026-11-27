from collections.abc import Callable

from fastapi import status
from fastapi.testclient import TestClient

PAGE_KEYS = {"items", "total", "page", "page_size", "total_pages"}


def read_pages(client: TestClient, url: str, page_size: int, **params) -> list[dict]:
    pages = []
    page = 1
    while True:
        query = {**params, "page": page, "page_size": page_size}
        response = client.get(url, params=query)
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert PAGE_KEYS <= set(body)
        pages.append(body)
        if page >= body["total_pages"]:
            return pages
        page += 1


Key = str | Callable[[dict], object]


def keys_of(pages: list[dict], key: Key = "public_id") -> list:
    read = key if callable(key) else lambda item: item[key]
    return [read(item) for page in pages for item in page["items"]]


def assert_pages_cover_everything(
    client: TestClient, url: str, expected: list, key: Key = "public_id", **params
) -> None:
    # duas por página, para os empates caírem na divisa entre as páginas
    pages = read_pages(client, url, 2, **params)
    first, last = pages[0], pages[-1]
    assert (first["page"], first["page_size"], first["total"]) == (1, 2, len(expected))
    assert first["total_pages"] == (len(expected) + 1) // 2
    assert len(last["items"]) == len(expected) - 2 * (len(pages) - 1)
    assert keys_of(pages, key) == expected
    whole = client.get(url, params={**params, "page_size": 100}).json()
    assert keys_of([whole], key) == expected


def assert_page_size_limits(client: TestClient, url: str) -> None:
    assert client.get(url).json()["page_size"] == 20
    assert client.get(url, params={"page_size": 100}).status_code == status.HTTP_200_OK
    for query in ({"page_size": 101}, {"page_size": 0}, {"page": 0}):
        response = client.get(url, params=query)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    past_the_end = client.get(url, params={"page": 99}).json()
    assert past_the_end["items"] == []
    assert past_the_end["page"] == 99
