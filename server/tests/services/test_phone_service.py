import pytest

from src.services.phone_service import validate_cellphone, validate_homephone


@pytest.mark.parametrize("number", ["(11) 94464-4502", "11 94464 4502", "11944644502"])
def test_validate_cellphone_keeps_only_digits(number: str):
    assert validate_cellphone(number) == "11944644502"


@pytest.mark.parametrize(
    "number, error",
    [
        ("(11) 944-402", "Não é um número de telefone celular válido"),
        ("(11) 2464-4502", "Não é um número de telefone celular válido"),
        ("(25) 94464-4502", "O DDD 25 é inválido"),
    ],
)
def test_validate_cellphone_rejects_invalid_numbers(number: str, error: str):
    with pytest.raises(ValueError, match=error):
        validate_cellphone(number)


@pytest.mark.parametrize("number", ["(11) 2464-4502", "11 2464 4502", "1124644502"])
def test_validate_homephone_keeps_only_digits(number: str):
    assert validate_homephone(number) == "1124644502"


@pytest.mark.parametrize(
    "number, error",
    [
        ("(11) 2464-450", "Não é um número de telefone fixo válido"),
        ("(11) 94464-4502", "Não é um número de telefone fixo válido"),
        ("(25) 2464-4502", "O DDD 25 é inválido"),
    ],
)
def test_validate_homephone_rejects_invalid_numbers(number: str, error: str):
    with pytest.raises(ValueError, match=error):
        validate_homephone(number)
