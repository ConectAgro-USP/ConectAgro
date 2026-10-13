# reexportadas para as rotas tratarem os erros dos connectors sem importá-los
from src.connectors.exceptions import CepNotFoundError as CepNotFoundError
from src.connectors.exceptions import ExternalServiceError as ExternalServiceError
from src.connectors.exceptions import InvalidCepError as InvalidCepError
from src.connectors.exceptions import RouteNotFoundError as RouteNotFoundError


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class GoogleLoginRejectedError(Exception):
    pass


class CepWithoutCoordinatesError(Exception):
    pass
