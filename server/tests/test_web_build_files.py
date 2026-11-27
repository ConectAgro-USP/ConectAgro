from pathlib import Path
from urllib.parse import quote

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from src.main import serve_web_build

INDEX = "<!doctype html><title>ConectAgro</title>"
ICON = b"\x00\x00\x01\x00icone"
PNG = b"\x89PNG\r\n\x1a\nicone"


@pytest.fixture
def web(tmp_path: Path) -> TestClient:
    build = tmp_path / "static"
    (build / "assets").mkdir(parents=True)
    (build / "pasta").mkdir()
    (build / "index.html").write_text(INDEX, encoding="utf-8")
    (build / "favicon.ico").write_bytes(ICON)
    (build / "apple-touch-icon.png").write_bytes(PNG)
    (build / "pasta" / "favicon.ico").write_bytes(ICON)
    (build / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    (tmp_path / "segredo.txt").write_text("fora do build", encoding="utf-8")
    app = FastAPI()
    serve_web_build(app, build)
    return TestClient(app)


def test_files_at_the_root_of_the_build_are_served_as_themselves(web: TestClient):
    icon = web.get("/favicon.ico")
    touch_icon = web.get("/apple-touch-icon.png")

    assert icon.content == ICON
    assert "icon" in icon.headers["content-type"]
    assert touch_icon.content == PNG
    assert touch_icon.headers["content-type"] == "image/png"


def test_built_scripts_are_served_from_the_assets_folder(web: TestClient):
    assert web.get("/assets/app.js").text == "console.log(1)"


@pytest.mark.parametrize("path", ["/", "/produtos/abc", "/pasta/favicon.ico", "/assets-falso"])
def test_app_routes_get_the_page_of_the_app(web: TestClient, path: str):
    response = web.get(path)

    assert response.text == INDEX
    assert response.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize(
    "path", ["/%2e%2e/segredo.txt", "/..%2fsegredo.txt", "/%2e%2e%2fsegredo.txt"]
)
def test_files_outside_the_build_are_never_served(web: TestClient, path: str):
    assert web.get(path).text == INDEX


def test_an_absolute_path_never_leaves_the_build(web: TestClient, tmp_path: Path):
    secret = quote(str(tmp_path / "segredo.txt"), safe="")

    assert web.get(f"/{secret}").text == INDEX


@pytest.mark.parametrize(
    "path", ["/%00", "/favicon.ico%00.txt", "/" + "a/" * 2500, "/%5c%5cexemplo%5cpasta%5cx.ico"]
)
def test_malformed_paths_get_the_page_of_the_app(web: TestClient, path: str):
    response = web.get(path)

    assert response.status_code == status.HTTP_200_OK
    assert response.text == INDEX


def test_unknown_api_path_is_not_found(web: TestClient):
    assert web.get("/api/nada").status_code == status.HTTP_404_NOT_FOUND
