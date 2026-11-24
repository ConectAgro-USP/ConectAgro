from collections.abc import Callable
from typing import Any

INVALID_VALUE = "Valor inválido"


def _plural(count: Any, singular: str, plural: str) -> str:
    return f"{count} {singular if str(count) == '1' else plural}"


def _options(expected: Any) -> str:
    return f"Escolha uma destas opções: {str(expected).replace(' or ', ' ou ')}"


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
    "int_type": "Informe um número inteiro",
    "int_parsing": "Informe um número inteiro",
    "int_from_float": "Informe um número inteiro",
    "float_type": "Informe um número",
    "float_parsing": "Informe um número",
    "decimal_type": "Informe um número",
    "decimal_parsing": "Informe um número",
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
    "date_type": "Informe uma data válida",
    "date_parsing": "Informe uma data válida",
    "date_from_datetime_parsing": "Informe uma data válida",
    "date_from_datetime_inexact": "Informe só a data, sem a hora",
    "datetime_type": "Informe uma data e hora válidas",
    "datetime_parsing": "Informe uma data e hora válidas",
    "datetime_from_date_parsing": "Informe uma data e hora válidas",
    "url_type": "Informe uma URL válida",
    "url_parsing": "Informe uma URL válida",
    "url_scheme": "Informe uma URL válida",
    "url_too_long": "A URL é longa demais",
    "enum": lambda ctx: _options(ctx["expected"]),
    "literal_error": lambda ctx: _options(ctx["expected"]),
    "json_invalid": "O corpo do pedido não é um JSON válido",
    "json_type": "O corpo do pedido não é um JSON válido",
    "dict_type": "Envie um objeto JSON",
    "model_type": "Envie um objeto JSON",
    "model_attributes_type": "Envie um objeto JSON",
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
