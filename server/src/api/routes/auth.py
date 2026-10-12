from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse

from src.api.deps import AuthServiceDep, CurrentUser
from src.auth.oauth import oauth
from src.core.config import settings
from src.core.security import create_access_token
from src.models.user import User, UserCreate, UserLogin, UserRead
from src.services.exceptions import EmailAlreadyRegisteredError, InvalidCredentialsError

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        key="access_token",
        value=create_access_token(subject=str(user.id)),
        httponly=True,
        secure=settings.is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/login/google")
async def login_google(request: Request):
    # O callback passa pelo /api do frontend (Vite/Vercel) para receber o cookie de estado do OAuth.
    callback_path = request.url_for("auth_google_callback").path
    redirect_uri = settings.FRONTEND_URL.rstrip("/") + callback_path
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback/google", name="auth_google_callback")
async def auth_google_callback(request: Request, auth_service: AuthServiceDep):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token["userinfo"]

    user = auth_service.get_or_create_google_user(
        email=userinfo["email"],
        name=userinfo["name"],
        picture_url=userinfo.get("picture"),
    )

    response = RedirectResponse(url=settings.FRONTEND_URL)
    _set_auth_cookie(response, user)
    return response


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUser):
    return current_user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_farmer(user_in: UserCreate, auth_service: AuthServiceDep):
    try:
        new_user = auth_service.register(user_in)
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já cadastrado"
        ) from None

    return {"status_code": status.HTTP_201_CREATED, "message": "Conta criada com sucesso",
            "user_id": new_user.id}


@router.post("/login")
async def login_farmer(user_in: UserLogin, auth_service: AuthServiceDep, response: Response):
    try:
        user = auth_service.authenticate(user_in.email, user_in.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos"
        ) from None

    _set_auth_cookie(response, user)
    return {"status_code": status.HTTP_200_OK, "message": "Login realizado com sucesso"}
