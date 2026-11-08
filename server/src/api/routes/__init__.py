from fastapi import APIRouter

from src.api.routes import apartments, auth, products, profiles

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profiles.router)
api_router.include_router(apartments.router)
api_router.include_router(products.router)
