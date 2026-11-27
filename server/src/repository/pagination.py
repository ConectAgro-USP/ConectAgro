from sqlalchemy import func
from sqlmodel import Session, select

from src.models.pagination import PageParams


def fetch_page(session: Session, statement, params: PageParams) -> tuple[list, int]:
    # conta a mesma consulta sem a ordem, para valer em todas as páginas
    count = select(func.count()).select_from(statement.order_by(None).subquery())
    total = session.exec(count).one()
    rows = session.exec(statement.offset(params.offset).limit(params.page_size)).all()
    return list(rows), total
