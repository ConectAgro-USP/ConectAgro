from src.core.rate_limiter import RateLimiter
from tests.helpers import FakeClock


def test_refuses_the_attempts_beyond_the_maximum():
    limiter = RateLimiter(max_attempts=2, window_seconds=60, clock=FakeClock().read)

    results = [limiter.count_attempt("ana") for _ in range(3)]

    assert results == [True, True, False]


def test_is_blocked_only_after_the_maximum():
    limiter = RateLimiter(max_attempts=2, window_seconds=60, clock=FakeClock().read)
    limiter.count_attempt("ana")

    blocked_before = limiter.is_blocked("ana")
    limiter.count_attempt("ana")

    assert not blocked_before
    assert limiter.is_blocked("ana")


def test_is_blocked_neither_counts_nor_keeps_the_key():
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=FakeClock().read)

    for _ in range(3):
        limiter.is_blocked("ana")

    assert limiter._attempts == {}
    assert limiter.count_attempt("ana")


def test_the_window_ends_on_time():
    clock = FakeClock()
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=clock.read)
    limiter.count_attempt("ana")

    clock.now += 59
    blocked_at_the_end = limiter.is_blocked("ana")
    clock.now += 1

    assert blocked_at_the_end
    assert not limiter.is_blocked("ana")


def test_a_new_window_starts_counting_from_zero():
    clock = FakeClock()
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=clock.read)
    limiter.count_attempt("ana")
    clock.now += 60

    assert limiter.count_attempt("ana")
    assert not limiter.count_attempt("ana")


def test_the_window_is_the_same_for_every_key():
    clock = FakeClock()
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=clock.read)
    limiter.count_attempt("ana")
    clock.now += 50
    limiter.count_attempt("bia")

    blocked_after_her_attempt = limiter.is_blocked("bia")
    clock.now += 10

    assert blocked_after_her_attempt
    assert not limiter.is_blocked("bia")


def test_reset_also_starts_a_new_window():
    clock = FakeClock()
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=clock.read)
    limiter.count_attempt("ana")
    clock.now += 59
    limiter.reset()
    limiter.count_attempt("bia")

    clock.now += 1

    assert limiter.is_blocked("bia")


def test_a_new_window_forgets_every_key():
    clock = FakeClock()
    limiter = RateLimiter(max_attempts=5, window_seconds=60, clock=clock.read)
    limiter.count_attempt("antigo")
    clock.now += 60

    limiter.count_attempt("novo")

    assert limiter._attempts == {"novo": 1}


def test_counts_each_key_apart():
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=FakeClock().read)
    limiter.count_attempt("ana")

    assert limiter.count_attempt("bia")


def test_a_refused_attempt_is_not_counted():
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=FakeClock().read)
    limiter.count_attempt("ana")

    limiter.count_attempt("ana")

    assert limiter._attempts["ana"] == 1


def test_undo_gives_one_attempt_back():
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=FakeClock().read)
    limiter.count_attempt("ana")

    limiter.undo_attempt("ana")

    assert limiter.count_attempt("ana")


def test_undo_never_gives_more_than_the_maximum():
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=FakeClock().read)
    limiter.count_attempt("ana")
    limiter.undo_attempt("ana")
    limiter.undo_attempt("ana")

    assert limiter.count_attempt("ana")
    assert not limiter.count_attempt("ana")


def test_undo_of_a_key_without_attempts_changes_nothing():
    limiter = RateLimiter(max_attempts=1, window_seconds=60, clock=FakeClock().read)

    limiter.undo_attempt("ana")

    assert limiter.count_attempt("ana")
    assert not limiter.count_attempt("ana")
