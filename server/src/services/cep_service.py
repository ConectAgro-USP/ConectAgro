from src.connectors.brasilapi import BrasilApiConnector, normalize_cep
from src.connectors.models import Address
from src.services.recent_cache import RecentCache


class CepService:
    def __init__(self, ceps: BrasilApiConnector, recent_addresses: RecentCache[Address]):
        self.ceps = ceps
        self.recent_addresses = recent_addresses

    def get_address(self, cep: str) -> Address:
        digits = normalize_cep(cep)
        address = self.recent_addresses.get(digits)
        if address is None:
            address = self.ceps.get_address(digits)
            self.recent_addresses.save(digits, address)
        return address
