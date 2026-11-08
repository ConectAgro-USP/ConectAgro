import ipaddress
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from src.api.deps import CurrentUser
from src.core.rate_limiter import RateLimiter

MINUTE = 60
HOUR = 60 * MINUTE
TOO_MANY_ATTEMPTS = "Muitas tentativas. Tente novamente mais tarde"
# 45 é o IPv6 mais longo; sem o limite, o ip_address aceita uma zona (%) sem fim
MAX_IP_LENGTH = 45

# todos contam na memória do processo: valem enquanto a API roda num processo só
LOGIN_FAILURES_PER_EMAIL = RateLimiter(max_attempts=5, window_seconds=15 * MINUTE)
PROFILE_REQUESTS_PER_USER = RateLimiter(max_attempts=20, window_seconds=HOUR)
# folgados de propósito: uma turma inteira pode usar o mesmo IP
LOGIN_FAILURES_PER_IP = RateLimiter(max_attempts=30, window_seconds=15 * MINUTE)
SIGNUPS_PER_IP = RateLimiter(max_attempts=50, window_seconds=HOUR)
PROFILE_REQUESTS_PER_IP = RateLimiter(max_attempts=200, window_seconds=HOUR)
# o conftest zera estes limites antes de cada teste
ALL_LIMITERS = (
    LOGIN_FAILURES_PER_EMAIL,
    PROFILE_REQUESTS_PER_USER,
    LOGIN_FAILURES_PER_IP,
    SIGNUPS_PER_IP,
    PROFILE_REQUESTS_PER_IP,
)


def _ip_or_empty(text: str) -> str:
    text = text.strip()
    if len(text) > MAX_IP_LENGTH:
        return ""
    try:
        return str(ipaddress.ip_address(text))
    except ValueError:
        return ""


def get_ip_key(request: Request) -> str:
    # pelo Vercel, o 1º do X-Forwarded-For é o visitante; direto, é forjável
    forwarded_for = request.headers.get("x-forwarded-for", "")
    forwarded_ip = _ip_or_empty(forwarded_for.split(",", maxsplit=1)[0])
    connected_ip = _ip_or_empty(request.headers.get("cf-connecting-ip", ""))
    if forwarded_ip or connected_ip:
        # CF-Connecting-IP é do Cloudflare: quem forja não gasta o limite alheio
        return f"{forwarded_ip}|{connected_ip}"
    if request.client is None:
        return ""
    return request.client.host


IpKey = Annotated[str, Depends(get_ip_key)]


def reject_if_blocked(limiter: RateLimiter, key: str) -> None:
    if limiter.is_blocked(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS)


def count_or_reject(limiter: RateLimiter, key: str) -> None:
    if not limiter.count_attempt(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS)


def limit_profile_requests(current_user: CurrentUser, ip_key: IpKey) -> None:
    count_or_reject(PROFILE_REQUESTS_PER_IP, ip_key)
    if not PROFILE_REQUESTS_PER_USER.count_attempt(str(current_user.id)):
        # a recusa é da conta: não gasta o limite de quem divide o IP com ela
        PROFILE_REQUESTS_PER_IP.undo_attempt(ip_key)
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS)
