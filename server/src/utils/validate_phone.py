import re
from typing import Annotated

from pydantic import BeforeValidator

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


def validate_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    match = re.match(r"^([1-9]{2})(9\d{8}|[2-5]\d{7})$", digits)
    
    if not match:
        raise ValueError("Não é um número válido") 

    ddd = int(match.group(1))
	
    if ddd not in VALID_DDD:
        raise ValueError(f"O DDD {ddd} é inválido")

    return digits


Phone = Annotated[str, BeforeValidator(validate_phone)]