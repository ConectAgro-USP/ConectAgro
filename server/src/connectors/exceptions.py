class InvalidCepError(Exception):
    pass


class CepNotFoundError(Exception):
    pass


class InvalidCnpjError(Exception):
    pass


class CnpjNotFoundError(Exception):
    pass


class RouteNotFoundError(Exception):
    pass


class RateLimitedError(Exception):
    pass


class ExternalServiceError(Exception):
    pass
