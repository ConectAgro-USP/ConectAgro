from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlmodel import select

from src.api.deps import CurrentUser, SessionDep
from src.auth.oauth import oauth
from src.core.config import settings
from src.core.security import create_access_token, get_password_hash, verify_password
from src.models.user import User, UserCreate, UserLogin, UserRead

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


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_farmer(user_in: UserCreate, session: SessionDep):
    existing_user = session.exec(select(User).where(User.email == user_in.email)).first()

    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já cadastrado")
    
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        address=user_in.address,
        hashed_password=get_password_hash(user_in.password),
    )

    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return {"status_code": status.HTTP_201_CREATED, "message": "Conta criada com sucesso",
            "user_id": new_user.id}


@router.post("/login")
async def login_farmer(user_in: UserLogin, session: SessionDep, response: Response):
    user = session.exec(select(User).where(User.email == user_in.email)).first()
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="E-mail ou senha incorretos")
    
    access_token = create_access_token(subject=str(user.id))
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"status_code": status.HTTP_200_OK, "message": "Login realizado com sucesso"}