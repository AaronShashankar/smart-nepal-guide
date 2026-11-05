"""Application settings, read from environment variables / the .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Bato API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://snguide:snguide@localhost:5432/snguide"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30

    # Comma-separated OAuth client IDs whose Google ID tokens we accept
    # (web client ID + Android client ID).
    google_client_ids: str = ""

    # Comma-separated origins allowed to call the API from a browser (admin panel).
    cors_origins: str = "http://localhost:5173"

    @property
    def google_client_id_list(self) -> list[str]:
        return [c.strip() for c in self.google_client_ids.split(",") if c.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [c.strip() for c in self.cors_origins.split(",") if c.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
