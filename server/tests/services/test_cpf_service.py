import pytest

from src.services.cpf_service import validate_cpf


@pytest.mark.parametrize(
    "cpf, digits",
    [
        ("529.982.247-25", "52998224725"),
        ("52998224725", "52998224725"),
        (" 529 982 247 25 ", "52998224725"),
        ("123.456.789-09", "12345678909"),
    ],
    ids=["pontuado", "so-digitos", "com-espacos", "verificador-zero"],
)
def test_validate_cpf_returns_only_the_digits(cpf: str, digits: str):
    assert validate_cpf(cpf) == digits


@pytest.mark.parametrize(
    "cpf",
    [
        "",
        "529.982.247-24",
        "529.982.247-15",
        "111.111.111-11",
        "000.000.000-00",
        "5299822472",
        "529982247250",
        "529/982/247-25",
        "529.982.247-2a",
        # verificadores em ASCII: só assim o valor passaria sem o re.ASCII
        "５２９９８２２４７25",
    ],
    ids=[
        "vazio",
        "segundo-verificador-errado",
        "primeiro-verificador-errado",
        "digitos-repetidos",
        "zeros",
        "curto",
        "longo",
        "barra",
        "letra",
        "digitos-nao-ascii",
    ],
)
def test_validate_cpf_rejects_invalid_values(cpf: str):
    with pytest.raises(ValueError, match="CPF"):
        validate_cpf(cpf)
