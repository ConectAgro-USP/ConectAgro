import re

SEPARATORS = re.compile(r"[.\-\s]")
# re.ASCII barra dígitos de outros alfabetos, que burlariam o CPF único
CPF_PATTERN = re.compile(r"\d{11}", re.ASCII)
INVALID_CPF = "Não é um CPF válido"


def validate_cpf(cpf: str) -> str:
    digits = SEPARATORS.sub("", cpf)
    if not CPF_PATTERN.fullmatch(digits):
        raise ValueError(INVALID_CPF)
    # 111.111.111-11 e afins passam na conta dos verificadores, mas não existem
    if digits == digits[0] * 11:
        raise ValueError(INVALID_CPF)

    base = digits[:9]
    check_digits = digits[9:]
    if check_digits != _check_digits(base):
        raise ValueError(INVALID_CPF)
    return digits


def _check_digits(base: str) -> str:
    first = _check_digit(base, first_weight=10)
    return first + _check_digit(base + first, first_weight=11)


def _check_digit(digits: str, first_weight: int) -> str:
    total = 0
    weight = first_weight
    for digit in digits:
        total += int(digit) * weight
        weight -= 1
    remainder = total % 11
    return "0" if remainder < 2 else str(11 - remainder)
