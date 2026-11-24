from src.connectors.models import Company
from src.services.recent_cache import RecentCache


class CompanyCache(RecentCache[Company]):
    pass
