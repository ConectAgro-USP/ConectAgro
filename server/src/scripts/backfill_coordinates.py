"""Preenche as coordenadas de agricultores e prédios cadastrados antes delas.

Rode uma vez, de dentro da pasta server, com o DATABASE_URL do banco a corrigir:

    python -m src.scripts.backfill_coordinates

Cada CEP é consultado uma só vez na BrasilAPI. O perfil cujo CEP não existe, não
tem coordenadas ou não respondeu fica como estava e sai listado no resumo, para
correção manual. Rodar de novo só consulta os perfis que ainda faltam.
"""

from dataclasses import dataclass, field

import httpx
from sqlmodel import Session

from src.connectors.brasilapi import BrasilApiConnector
from src.connectors.models import Address
from src.core.db import engine
from src.models.apartment import Apartment
from src.models.farmer import Farmer
from src.repository.profile_repository import ProfileRepository
from src.services.cep_service import CepService
from src.services.exceptions import CepNotFoundError, ExternalServiceError, InvalidCepError
from src.services.recent_cache import RecentCache

HOUR = 60 * 60
LOOKUP_ERRORS = (InvalidCepError, CepNotFoundError, ExternalServiceError)


@dataclass
class BackfillSummary:
    filled: int = 0
    skipped: list[str] = field(default_factory=list)


def backfill_coordinates(profiles: ProfileRepository, ceps: CepService) -> BackfillSummary:
    summary = BackfillSummary()
    # o CepService só guarda os CEPs achados, então a rodada lembra as falhas
    failures: dict[str, str] = {}
    for profile in profiles.list_profiles_without_coordinates():
        if profile.zip_code in failures:
            summary.skipped.append(_describe(profile, failures[profile.zip_code]))
            continue
        try:
            address = ceps.get_address(profile.zip_code)
        except LOOKUP_ERRORS as error:
            failures[profile.zip_code] = type(error).__name__
            summary.skipped.append(_describe(profile, failures[profile.zip_code]))
            continue
        if address.coordinates is None:
            summary.skipped.append(_describe(profile, "CEP sem coordenadas"))
            continue
        profile.latitude = address.coordinates.latitude
        profile.longitude = address.coordinates.longitude
        # grava um por vez, uma falha no meio não perde o que já foi preenchido
        profiles.commit()
        summary.filled += 1
    return summary


def _describe(profile: Farmer | Apartment, reason: str) -> str:
    kind = "agricultor" if isinstance(profile, Farmer) else "prédio"
    return f"{kind} {profile.public_id}, CEP {profile.zip_code}: {reason}"


def main() -> None:
    with httpx.Client() as client, Session(engine) as session:
        ceps = CepService(BrasilApiConnector(client), RecentCache[Address](keep_seconds=HOUR))
        summary = backfill_coordinates(ProfileRepository(session), ceps)
    print(f"Perfis preenchidos: {summary.filled}")
    print(f"Perfis sem coordenadas: {len(summary.skipped)}")
    for line in summary.skipped:
        print(f"  {line}")


if __name__ == "__main__":
    main()
