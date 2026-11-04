import threading
import time
from collections.abc import Callable

from src.connectors.models import Company


class CompanyCache:
    def __init__(self, keep_seconds: int, clock: Callable[[], float] = time.monotonic):
        self.keep_seconds = keep_seconds
        self.clock = clock
        self._lock = threading.Lock()
        self._companies: dict[str, Company] = {}
        self._expires_at: dict[str, float] = {}

    def get(self, tax_id: str) -> Company | None:
        with self._lock:
            self._forget_expired()
            return self._companies.get(tax_id)

    def save(self, tax_id: str, company: Company) -> None:
        with self._lock:
            self._companies[tax_id] = company
            self._expires_at[tax_id] = self.clock() + self.keep_seconds

    def reset(self) -> None:
        with self._lock:
            self._companies = {}
            self._expires_at = {}

    def _forget_expired(self) -> None:
        now = self.clock()
        expired_tax_ids = []
        for tax_id, expires_at in self._expires_at.items():
            if now >= expires_at:
                expired_tax_ids.append(tax_id)
        for tax_id in expired_tax_ids:
            del self._companies[tax_id]
            del self._expires_at[tax_id]
