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
# com o IP na chave, quem erra a senha de outra pessoa não trava o login dela
LOGIN_FAILURES_PER_EMAIL_AND_IP = RateLimiter(max_attempts=5, window_seconds=15 * MINUTE)
# sem o IP, quem forja o cabeçalho ainda para em 50 senhas erradas por conta
LOGIN_FAILURES_PER_EMAIL = RateLimiter(max_attempts=50, window_seconds=15 * MINUTE)
PROFILE_REQUESTS_PER_USER = RateLimiter(max_attempts=20, window_seconds=HOUR)
# cada foto pode ter 1 MB guardado no banco
PICTURE_UPLOADS_PER_USER = RateLimiter(max_attempts=30, window_seconds=HOUR)
# folgados de propósito: uma turma inteira pode usar o mesmo IP
LOGIN_FAILURES_PER_IP = RateLimiter(max_attempts=30, window_seconds=15 * MINUTE)
SIGNUPS_PER_IP = RateLimiter(max_attempts=50, window_seconds=HOUR)
PROFILE_REQUESTS_PER_IP = RateLimiter(max_attempts=200, window_seconds=HOUR)
PICTURE_UPLOADS_PER_IP = RateLimiter(max_attempts=300, window_seconds=HOUR)
# o conftest zera estes limites antes de cada teste
ALL_LIMITERS = (
    LOGIN_FAILURES_PER_EMAIL_AND_IP,
    LOGIN_FAILURES_PER_EMAIL,
    PROFILE_REQUESTS_PER_USER,
    LOGIN_FAILURES_PER_IP,
    SIGNUPS_PER_IP,
    PROFILE_REQUESTS_PER_IP,
    PICTURE_UPLOADS_PER_USER,
    PICTURE_UPLOADS_PER_IP,
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


def login_key(email: str, ip_key: str) -> str:
    return f"{email}|{ip_key}"


def reject_if_blocked(limiter: RateLimiter, key: str) -> None:
    if limiter.is_blocked(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS)


def count_or_reject(limiter: RateLimiter, key: str) -> None:
    if not limiter.count_attempt(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS)


def count_both(first: RateLimiter, first_key: str, second: RateLimiter, second_key: str) -> None:
    count_or_reject(first, first_key)
    if not second.count_attempt(second_key):
        # a recusa é do segundo, então o primeiro não gasta à toa
        first.undo_attempt(first_key)
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS)


def limit_profile_requests(current_user: CurrentUser, ip_key: IpKey) -> None:
    count_both(PROFILE_REQUESTS_PER_IP, ip_key, PROFILE_REQUESTS_PER_USER, str(current_user.id))


def limit_picture_uploads(current_user: CurrentUser, ip_key: IpKey) -> None:
    count_both(PICTURE_UPLOADS_PER_IP, ip_key, PICTURE_UPLOADS_PER_USER, str(current_user.id))
