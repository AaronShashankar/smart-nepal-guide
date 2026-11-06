import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, lookups, me, places, risk, search, treks
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.ml.registry import active_model

settings = get_settings()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the active risk model once at startup (it is reloaded if another becomes active).
    try:
        with SessionLocal() as db:
            if active_model(db) is None:
                log.warning("No active risk model: run `uv run python -m app.ml.train`")
    except Exception:  # the API still starts, e.g. before the first migration
        log.exception("Could not load the risk model")
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    lifespan=lifespan,
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


for module in (auth, me, lookups, places, treks, search, risk):
    app.include_router(module.router)
