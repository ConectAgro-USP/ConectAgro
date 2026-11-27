import unicodedata


def fold(text: str | None) -> str:
    # a busca casa sem acentos, maiúsculas nem espaços repetidos
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    letters = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(letters.casefold().split())
