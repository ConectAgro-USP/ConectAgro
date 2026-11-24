import threading
import time
from collections.abc import Callable


class RecentCache[T]:
    def __init__(self, keep_seconds: int, clock: Callable[[], float] = time.monotonic):
        self.keep_seconds = keep_seconds
        self.clock = clock
        self._lock = threading.Lock()
        self._values: dict[str, T] = {}
        self._expires_at: dict[str, float] = {}

    def get(self, key: str) -> T | None:
        with self._lock:
            self._forget_expired()
            return self._values.get(key)

    def save(self, key: str, value: T) -> None:
        with self._lock:
            self._values[key] = value
            self._expires_at[key] = self.clock() + self.keep_seconds

    def reset(self) -> None:
        with self._lock:
            self._values = {}
            self._expires_at = {}

    def _forget_expired(self) -> None:
        now = self.clock()
        expired_keys = []
        for key, expires_at in self._expires_at.items():
            if now >= expires_at:
                expired_keys.append(key)
        for key in expired_keys:
            del self._values[key]
            del self._expires_at[key]
