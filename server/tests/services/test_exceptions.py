import pytest

from src.connectors import exceptions as connector_exceptions
from src.services import exceptions as service_exceptions

CONNECTOR_ERRORS = [
    error for error in vars(connector_exceptions).values() if isinstance(error, type)
]


@pytest.mark.parametrize("error", CONNECTOR_ERRORS, ids=lambda error: error.__name__)
def test_service_exceptions_reexport_connector_errors(error: type[Exception]):
    assert getattr(service_exceptions, error.__name__) is error
