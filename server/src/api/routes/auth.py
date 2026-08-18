from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse
from sqlmodel import select

from src.api.deps import CurrentUser, SessionDep
from src.auth.oauth import oauth
from src.core.config import settings
from src.core.security import create_access_token
from src.models.user import User, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login/google")
async def login_google(request: Request):
    redirect_uri = str(request.url_for("auth_google_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback/google", name="auth_google_callback")
async def auth_google_callback(request: Request, session: SessionDep):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token["userinfo"]

    user = session.exec(select(User).where(User.email == userinfo["email"])).first()
    if user is None:
        user = User(
            email=userinfo["email"],
            name=userinfo["name"],
            picture_url=userinfo.get("picture"),
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    access_token = create_access_token(subject=str(user.id))

    response = RedirectResponse(url=settings.FRONTEND_URL)
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        secure=settings.is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return response


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUser):
    return current_user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}
