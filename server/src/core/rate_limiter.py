import threading
import time
from collections.abc import Callable


class RateLimiter:
    def __init__(
        self,
        max_attempts: int,
        window_seconds: int,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.clock = clock
        self._lock = threading.Lock()
        self._attempts: dict[str, int] = {}
        self._window_end = 0.0

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            self._start_new_window_if_ended()
            return self._attempts.get(key, 0) >= self.max_attempts

    def count_attempt(self, key: str) -> bool:
        with self._lock:
            self._start_new_window_if_ended()
            attempts = self._attempts.get(key, 0)
            if attempts >= self.max_attempts:
                return False
            self._attempts[key] = attempts + 1
            return True

    def undo_attempt(self, key: str) -> None:
        with self._lock:
            self._start_new_window_if_ended()
            attempts = self._attempts.get(key, 0)
            if attempts > 0:
                self._attempts[key] = attempts - 1

    def reset(self) -> None:
        with self._lock:
            self._attempts = {}
            self._window_end = 0.0

    def _start_new_window_if_ended(self) -> None:
        # uma janela para todas as chaves: no fim dela, a memória se esvazia
        now = self.clock()
        if now >= self._window_end:
            self._attempts = {}
            self._window_end = now + self.window_seconds
