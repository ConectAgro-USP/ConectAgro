import re

# para o ruff não formatar automaticamente a tabela de DDDs
# fmt: off
VALID_DDD = {
    # Sudeste
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    21, 22, 24, 27, 28,
    31, 32, 33, 34, 35, 37, 38,
    # Sul
    41, 42, 43, 44, 45, 46, 47, 48, 49,
    51, 53, 54, 55,
    # Centro-Oeste
    61, 62, 64, 65, 66, 67,
    # Nordeste
    71, 73, 74, 75, 77, 79,
    81, 82, 83, 84, 85, 86, 87, 88, 89,
    98, 99,
    # Norte
    63, 68, 69,
    91, 92, 93, 94, 95, 96, 97,
}
# fmt: on

# re.ASCII barra dígitos de outros alfabetos, como japoneses, que parecem certos mas não funcionam
CELLPHONE_PATTERN = re.compile(r"^([1-9]{2})9\d{8}$", re.ASCII)
HOMEPHONE_PATTERN = re.compile(r"^([1-9]{2})[2-5]\d{7}$", re.ASCII)
NON_DIGITS = re.compile(r"\D", re.ASCII)


def _validate_phone(number: str, pattern: re.Pattern[str], message: str) -> str:
    digits = NON_DIGITS.sub("", number)
    match = pattern.match(digits)
    if not match:
        raise ValueError(message)
    ddd = match.group(1)
    if int(ddd) not in VALID_DDD:
        raise ValueError(f"O DDD {ddd} é inválido")
    return digits


def validate_cellphone(number: str) -> str:
    return _validate_phone(number, CELLPHONE_PATTERN, "Não é um número de telefone celular válido")


def validate_homephone(number: str) -> str:
    return _validate_phone(number, HOMEPHONE_PATTERN, "Não é um número de telefone fixo válido")
