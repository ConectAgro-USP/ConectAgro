import pytest

from src.core.text import hide_email, short_name


@pytest.mark.parametrize(
    "full_name, expected",
    [
        ("Ana Souza", "Ana S."),
        ("Maria da Silva Souza", "Maria S."),
        ("  João   Pereira  ", "João P."),
        ("Cláudia", "Cláudia"),
        ("  Cláudia ", "Cláudia"),
        ("", ""),
    ],
    ids=[
        "nome-e-sobrenome",
        "varios-sobrenomes",
        "espacos-extras",
        "um-nome",
        "um-nome-com-espacos",
        "vazio",
    ],
)
def test_short_name_keeps_the_first_name_and_the_last_initial(full_name: str, expected: str):
    assert short_name(full_name) == expected


def test_short_name_hides_an_email():
    # sem o nome do Google, o cadastro guarda o e-mail no lugar do nome
    assert short_name("ana.souza@gmail.com") == ""


@pytest.mark.parametrize(
    "name, expected",
    [("ana.souza@gmail.com", ""), ("Ana Souza Lima", "Ana Souza Lima"), ("", "")],
    ids=["e-mail", "nome", "vazio"],
)
def test_hide_email_keeps_a_real_name_whole(name: str, expected: str):
    assert hide_email(name) == expected
