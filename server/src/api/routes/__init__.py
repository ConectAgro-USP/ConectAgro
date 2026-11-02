from fastapi import APIRouter

from src.api.routes import apartments, auth, profiles

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profiles.router)
api_router.include_router(apartments.router)
