from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, lookups, me, places, search, treks
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Bato (Smart Nepal Tourist & Trek Guide) API. Send `Accept-Language: en` or `ne`; "
        "content falls back to English when a Nepali translation is missing."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


for module in (auth, me, lookups, places, treks, search):
    app.include_router(module.router)
