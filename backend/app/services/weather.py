"""7-day weather forecast from Open-Meteo (free, no API key), cached in Redis.

Pattern: cache-aside with a time-to-live.
1. Look in Redis under `weather:{lat:.2f}:{lng:.2f}`. Rounding to 2 decimals (about 1 km) lets
   nearby requests share one entry. Found -> HIT.
2. Not found -> call Open-Meteo, keep the answer for WEATHER_CACHE_SECONDS (1 hour) -> MISS.
   A second copy, `weather:stale:...`, is kept for 24 hours.
3. Open-Meteo fails -> return the 24-hour copy with `stale: true` -> STALE, or 503 if there is none.
"""

import logging
from datetime import UTC, datetime
from typing import Literal

import requests
from fastapi import HTTPException, status

from app.core.cache import get_json, set_json
from app.core.config import get_settings

log = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
STALE_SECONDS = 24 * 3600
CacheStatus = Literal["HIT", "MISS", "STALE"]


def fetch_open_meteo(lat: float, lng: float) -> dict:
    r = requests.get(
        OPEN_METEO_URL,
        params={
            "latitude": f"{lat:.2f}",
            "longitude": f"{lng:.2f}",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
            "timezone": "Asia/Kathmandu",
            "forecast_days": 7,
        },
        timeout=5,
    )
    r.raise_for_status()
    return r.json()


def parse_daily(raw: dict) -> list[dict]:
    daily = raw["daily"]
    return [
        {"date": d, "code": code, "max_c": hi, "min_c": lo, "rain_mm": rain}
        for d, code, hi, lo, rain in zip(
            daily["time"],
            daily["weather_code"],
            daily["temperature_2m_max"],
            daily["temperature_2m_min"],
            daily["precipitation_sum"],
            strict=True,
        )
    ]


def cache_key(lat: float, lng: float) -> str:
    return f"weather:{lat:.2f}:{lng:.2f}"


def forecast(lat: float, lng: float) -> tuple[dict, CacheStatus]:
    """({fetched_at, stale, days[]}, cache status)."""
    key = cache_key(lat, lng)
    stale_key = key.replace("weather:", "weather:stale:", 1)
    cached = get_json(key)
    if cached is not None:
        return cached, "HIT"
    try:
        days = parse_daily(fetch_open_meteo(lat, lng))
    except (requests.RequestException, KeyError, TypeError, ValueError) as e:
        log.warning("Open-Meteo failed for %s: %s", key, e)
        old = get_json(stale_key)
        if old is not None:
            return {**old, "stale": True}, "STALE"
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Weather forecast is not available right now"
        ) from e
    data = {"fetched_at": datetime.now(UTC).isoformat(), "stale": False, "days": days}
    set_json(key, data, get_settings().weather_cache_seconds)
    set_json(stale_key, data, STALE_SECONDS)
    return data, "MISS"
