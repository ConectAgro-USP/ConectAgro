from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse

from src.api.deps import AuthServiceDep, CurrentUser, OptionalUser
from src.api.rate_limits import (
    LOGIN_FAILURES_PER_EMAIL,
    LOGIN_FAILURES_PER_EMAIL_AND_IP,
    LOGIN_FAILURES_PER_IP,
    SIGNUPS_PER_IP,
    IpKey,
    count_both,
    count_or_reject,
    login_key,
    reject_if_blocked,
)
from src.auth.oauth import oauth
from src.core.config import settings
from src.core.security import create_access_token
from src.models.user import User, UserCreate, UserLogin, UserRead
from src.services.exceptions import (
    EmailAlreadyRegisteredError,
    GoogleLoginRejectedError,
    InvalidCredentialsError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        key="access_token",
        value=create_access_token(user.id, user.session_version),
        httponly=True,
        secure=settings.is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/login/google")
async def login_google(request: Request):
    # O callback passa pelo /api do frontend (Vite/Vercel) para receber o cookie de estado do OAuth.
    callback_path = request.url_for("auth_google_callback").path
    redirect_uri = settings.FRONTEND_URL + callback_path
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback/google", name="auth_google_callback")
async def auth_google_callback(request: Request, auth_service: AuthServiceDep):
    google_error = RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=google")
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        return google_error
    # sem id_token o Authlib não monta o userinfo, e sem e-mail não há conta
    userinfo = token.get("userinfo") or {}
    email = userinfo.get("email")
    if not isinstance(email, str) or not email:
        return google_error
    try:
        user = await run_in_threadpool(
            auth_service.authenticate_with_google,
            email=email.lower(),
            name=userinfo.get("name", email),
            picture_url=userinfo.get("picture"),
            email_verified=userinfo.get("email_verified") is True,
            hosted_domain=userinfo.get("hd"),
        )
    except GoogleLoginRejectedError:
        return google_error

    response = RedirectResponse(url=settings.FRONTEND_URL)
    _set_auth_cookie(response, user)
    return response


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUser):
    return current_user


@router.post("/logout")
def logout(response: Response, auth_service: AuthServiceDep, user: OptionalUser):
    if user is not None:
        auth_service.end_sessions(user)
    response.delete_cookie("access_token", httponly=True, secure=settings.is_prod)
    return {"ok": True}


# def e não async, para o FastAPI rodar o banco e o argon2 síncronos no threadpool
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, auth_service: AuthServiceDep, ip_key: IpKey) -> dict[str, str]:
    count_or_reject(SIGNUPS_PER_IP, ip_key)
    try:
        auth_service.register(user_in)
    except EmailAlreadyRegisteredError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "E-mail já cadastrado") from None

    return {"message": "Conta criada com sucesso"}


def _undo_login_attempt(attempt_key: str, email: str) -> None:
    LOGIN_FAILURES_PER_EMAIL_AND_IP.undo_attempt(attempt_key)
    LOGIN_FAILURES_PER_EMAIL.undo_attempt(email)


@router.post("/login")
def login(
    user_in: UserLogin, auth_service: AuthServiceDep, response: Response, ip_key: IpKey
) -> dict[str, str]:
    # o IP só conta senhas erradas: logins certos de uma turma não o bloqueiam
    reject_if_blocked(LOGIN_FAILURES_PER_IP, ip_key)
    # o e-mail conta antes do argon2: pedidos simultâneos não furam o limite
    attempt_key = login_key(user_in.email, ip_key)
    count_both(
        LOGIN_FAILURES_PER_EMAIL_AND_IP, attempt_key, LOGIN_FAILURES_PER_EMAIL, user_in.email
    )
    try:
        user = auth_service.authenticate(user_in.email, user_in.password)
    except InvalidCredentialsError:
        LOGIN_FAILURES_PER_IP.count_attempt(ip_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos") from None
    except Exception:
        # o erro é do servidor, não da senha: a tentativa não conta
        _undo_login_attempt(attempt_key, user_in.email)
        raise

    _undo_login_attempt(attempt_key, user_in.email)
    _set_auth_cookie(response, user)
    return {"message": "Login realizado com sucesso"}
