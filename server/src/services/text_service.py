def reject_null_character(text: str) -> str:
    # o PostgreSQL recusa o caractere nulo, e o pedido terminaria em erro 500
    if "\x00" in text:
        raise ValueError("O texto tem um caractere inválido")
    return text
