import time
from concurrent.futures import ThreadPoolExecutor

import pytest

from src.core import security


def test_access_token_carries_the_user_and_the_session_version():
    token = security.create_access_token(42, session_version=3)

    assert security.decode_access_token(token) == security.TokenData(user_id=42, session_version=3)


def test_argon2_operations_share_a_limit_of_four(monkeypatch: pytest.MonkeyPatch):
    running = []
    peak = []

    def slow_argon2(*args):
        running.append(args)
        peak.append(len(running))
        time.sleep(0.05)
        running.pop()

    for method in ("hash", "verify"):
        monkeypatch.setattr(security.password_hash, method, slow_argon2)
    with ThreadPoolExecutor(max_workers=6) as pool:
        for _ in range(3):
            pool.submit(security.get_password_hash, "senha")
            pool.submit(security.verify_password, "senha", "hash")

    assert max(peak) <= 4
