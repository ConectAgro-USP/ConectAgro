from pathlib import Path

from alembic.config import Config

SERVER_DIR = Path(__file__).resolve().parent.parent


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    return config
