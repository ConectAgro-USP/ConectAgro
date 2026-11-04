import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlmodel import Session

from src.models.user import User

USER = {"email": "user@example.com", "name": "João", "cellphone": "(11) 94464-4502"}


def test_user_model_validate_normalizes_cellphone():
    assert User.model_validate(USER).cellphone == "11944644502"


def test_user_model_validate_rejects_invalid_cellphone():
    with pytest.raises(ValidationError):
        User.model_validate({**USER, "cellphone": "abc"})


def test_user_cellphone_is_stored_as_digits(session: Session):
    session.add(User.model_validate(USER))
    session.commit()

    assert session.execute(text("SELECT cellphone FROM users")).scalar_one() == "11944644502"
