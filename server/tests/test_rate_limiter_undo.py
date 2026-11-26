from src.core.rate_limiter import RateLimiter
from tests.helpers import FakeClock


def test_undo_of_the_last_attempt_forgets_the_key():
    limiter = RateLimiter(max_attempts=3, window_seconds=60, clock=FakeClock().read)
    limiter.count_attempt("ana")

    limiter.undo_attempt("ana")

    assert limiter._attempts == {}


def test_undo_keeps_the_attempts_left_until_the_window_ends():
    clock = FakeClock()
    limiter = RateLimiter(max_attempts=2, window_seconds=60, clock=clock.read)
    limiter.count_attempt("ana")
    limiter.count_attempt("ana")

    limiter.undo_attempt("ana")
    clock.now += 59
    limiter.count_attempt("ana")
    blocked_at_the_end = limiter.is_blocked("ana")
    clock.now += 1

    assert blocked_at_the_end
    assert not limiter.is_blocked("ana")
