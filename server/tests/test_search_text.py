import pytest

from src.core.search_text import fold


@pytest.mark.parametrize(
    ("text", "folded"),
    [
        ("Feijão", "feijao"),
        ("MAÇÃ", "maca"),
        ("  Sítio   São João ", "sitio sao joao"),
        ("Abóbora cabotiá", "abobora cabotia"),
        ("alface", "alface"),
    ],
)
def test_fold_removes_accents_case_and_extra_spaces(text: str, folded: str):
    assert fold(text) == folded


@pytest.mark.parametrize("text", [None, "", "   "])
def test_fold_turns_missing_text_into_empty_string(text: str | None):
    assert fold(text) == ""


def test_folded_query_matches_folded_text():
    assert fold("feijao") in fold("Feijão carioca do Sítio")
