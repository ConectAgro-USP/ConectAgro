from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import event
from sqlmodel import Session


@contextmanager
def counted_queries(session: Session) -> Iterator[list[str]]:
    queries: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    engine = session.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield queries
    finally:
        event.remove(engine, "before_cursor_execute", record)
