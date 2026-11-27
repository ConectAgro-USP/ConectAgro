import re
from collections.abc import Callable
from typing import Any

INVALID_VALUE = "Valor inválido"
NOT_AN_INTEGER = "Informe um número inteiro"
NOT_A_NUMBER = "Informe um número"
INVALID_DATE = "Informe uma data válida"
INVALID_DATETIME = "Informe uma data e hora válidas"
INVALID_URL = "Informe uma URL válida"
NOT_AN_OBJECT = "Envie um objeto JSON"
# num literal de enum o pydantic mostra o repr do membro, e fica só o valor
ENUM_MEMBER_REPR = re.compile(r"<\w+\.\w+: (.+?)>(?=, | or |$)")


def _plural(count: Any, singular: str, plural: str) -> str:
    return f"{count} {singular if str(count) == '1' else plural}"


def _options(expected: Any) -> str:
    options = ENUM_MEMBER_REPR.sub(r"\1", str(expected)).replace(" or ", " ou ")
    return f"Escolha uma destas opções: {options}"


def _text_too_short(ctx: dict[str, Any]) -> str:
    return f"Informe ao menos {_plural(ctx['min_length'], 'caractere', 'caracteres')}"


def _text_too_long(ctx: dict[str, Any]) -> str:
    return f"Informe no máximo {_plural(ctx['max_length'], 'caractere', 'caracteres')}"


def _list_too_short(ctx: dict[str, Any]) -> str:
    return f"Envie ao menos {_plural(ctx['min_length'], 'item', 'itens')}"


def _list_too_long(ctx: dict[str, Any]) -> str:
    return f"Envie no máximo {_plural(ctx['max_length'], 'item', 'itens')}"


Message = Callable[[dict[str, Any]], str]
MESSAGES: dict[str, str | Message] = {
    "missing": "Campo obrigatório",
    "extra_forbidden": "Campo não permitido",
    "string_type": "Informe um texto",
    "string_too_short": _text_too_short,
    "string_too_long": _text_too_long,
    "string_pattern_mismatch": "Formato inválido",
    "string_unicode": "Texto inválido",
    "too_short": _list_too_short,
    "too_long": _list_too_long,
    "int_type": NOT_AN_INTEGER,
    "int_parsing": NOT_AN_INTEGER,
    "int_from_float": NOT_AN_INTEGER,
    "float_type": NOT_A_NUMBER,
    "float_parsing": NOT_A_NUMBER,
    "decimal_type": NOT_A_NUMBER,
    "decimal_parsing": NOT_A_NUMBER,
    "finite_number": "Informe um número finito",
    "greater_than": lambda ctx: f"Informe um valor maior que {ctx['gt']}",
    "greater_than_equal": lambda ctx: f"Informe um valor maior ou igual a {ctx['ge']}",
    "less_than": lambda ctx: f"Informe um valor menor que {ctx['lt']}",
    "less_than_equal": lambda ctx: f"Informe um valor menor ou igual a {ctx['le']}",
    "multiple_of": lambda ctx: f"Informe um múltiplo de {ctx['multiple_of']}",
    "decimal_max_places": lambda ctx: (
        f"Use no máximo {_plural(ctx['decimal_places'], 'casa decimal', 'casas decimais')}"
    ),
    "decimal_max_digits": lambda ctx: (
        f"Use no máximo {_plural(ctx['max_digits'], 'dígito', 'dígitos')}"
    ),
    "decimal_whole_digits": lambda ctx: (
        f"Use no máximo {_plural(ctx['whole_digits'], 'dígito', 'dígitos')} antes da vírgula"
    ),
    "bool_type": "Informe verdadeiro ou falso",
    "bool_parsing": "Informe verdadeiro ou falso",
    "uuid_type": "Identificador inválido",
    "uuid_parsing": "Identificador inválido",
    "date_type": INVALID_DATE,
    "date_parsing": INVALID_DATE,
    "date_from_datetime_parsing": INVALID_DATE,
    "date_from_datetime_inexact": "Informe só a data, sem a hora",
    "datetime_type": INVALID_DATETIME,
    "datetime_parsing": INVALID_DATETIME,
    "datetime_from_date_parsing": INVALID_DATETIME,
    "url_type": INVALID_URL,
    "url_parsing": INVALID_URL,
    "url_scheme": INVALID_URL,
    "url_too_long": "A URL é longa demais",
    "enum": lambda ctx: _options(ctx["expected"]),
    "literal_error": lambda ctx: _options(ctx["expected"]),
    "json_invalid": "O corpo do pedido não é um JSON válido",
    "json_type": "O corpo do pedido não é um JSON válido",
    "dict_type": NOT_AN_OBJECT,
    "model_type": NOT_AN_OBJECT,
    "model_attributes_type": NOT_AN_OBJECT,
    "list_type": "Envie uma lista",
}


def portuguese_message(error: dict[str, Any]) -> str:
    ctx = error.get("ctx") or {}
    if error["type"] == "value_error":
        # o ValueError dos validadores do projeto já vem em português
        if "error" in ctx:
            return str(ctx["error"])
        return INVALID_VALUE
    message = MESSAGES.get(error["type"], INVALID_VALUE)
    if isinstance(message, str):
        return message
    try:
        return message(ctx)
    except KeyError:
        return INVALID_VALUE
