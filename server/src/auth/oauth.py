from authlib.integrations.starlette_client import OAuth

from src.core.config import settings

oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url=settings.GOOGLE_METADATA_URL,
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    client_kwargs={"scope": "openid email profile"},
)
