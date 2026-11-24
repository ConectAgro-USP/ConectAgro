def reject_null_character(text: str) -> str:
    # o PostgreSQL recusa o caractere nulo, e o pedido terminaria em erro 500
    if "\x00" in text:
        raise ValueError("O texto tem um caractere inválido")
    return text


def short_name(full_name: str) -> str:
    # sem o nome do Google, o cadastro guarda o e-mail, que não pode vazar
    if "@" in full_name:
        return ""
    # o primeiro nome e a inicial do último: o morador reconhece o síndico
    words = full_name.split()
    if len(words) < 2:
        return full_name.strip()
    first_name = words[0]
    last_name = words[-1]
    return f"{first_name} {last_name[0]}."
