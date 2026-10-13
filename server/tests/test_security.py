import time
from concurrent.futures import ThreadPoolExecutor

import pytest

from src.core import security


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
