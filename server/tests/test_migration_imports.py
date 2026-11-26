import ast
from pathlib import Path

from tests.test_migrations import SERVER_DIR

VERSIONS = sorted((SERVER_DIR / "alembic" / "versions").glob("*.py"))


def imported_packages(path: Path) -> set[str]:
    packages = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            packages.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            packages.add(node.module.split(".")[0])
    return packages


def test_migrations_do_not_import_the_application_code():
    importing = [path.name for path in VERSIONS if "src" in imported_packages(path)]

    assert VERSIONS
    assert importing == []
