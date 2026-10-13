from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse

from src.api.deps import AuthServiceDep, CurrentUser
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
        value=create_access_token(user.id),
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
    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token["userinfo"]
        user = await run_in_threadpool(
            auth_service.authenticate_with_google,
            email=userinfo["email"].lower(),
            name=userinfo.get("name", userinfo["email"]),
            picture_url=userinfo.get("picture"),
            email_verified=userinfo.get("email_verified") is True,
            hosted_domain=userinfo.get("hd"),
        )
    except (OAuthError, GoogleLoginRejectedError):
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=google")

    response = RedirectResponse(url=settings.FRONTEND_URL)
    _set_auth_cookie(response, user)
    return response


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUser):
    return current_user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", httponly=True, secure=settings.is_prod)
    return {"ok": True}


# def e não async, para o FastAPI rodar o banco e o argon2 síncronos no threadpool
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, auth_service: AuthServiceDep) -> dict[str, str | int]:
    try:
        new_user = auth_service.register(user_in)
    except EmailAlreadyRegisteredError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "E-mail já cadastrado") from None

    return {"message": "Conta criada com sucesso", "user_id": new_user.id}


@router.post("/login")
def login(user_in: UserLogin, auth_service: AuthServiceDep, response: Response) -> dict[str, str]:
    try:
        user = auth_service.authenticate(user_in.email, user_in.password)
    except InvalidCredentialsError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos") from None

    _set_auth_cookie(response, user)
    return {"message": "Login realizado com sucesso"}
