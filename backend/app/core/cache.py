"""A small JSON cache in Redis.

If Redis is down, every call logs a warning and behaves like an empty cache: `get_json` returns
None and `set_json` does nothing. The app keeps working, only slower.
"""

import json
import logging
from typing import Any

import redis

from app.core.config import get_settings

log = logging.getLogger(__name__)
_client: redis.Redis | None = None


def client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            get_settings().redis_url,
            decode_responses=True,
            socket_timeout=0.5,
            socket_connect_timeout=0.5,
        )
    return _client


def get_json(key: str) -> Any | None:
    try:
        raw = client().get(key)
    except redis.RedisError as e:
        log.warning("Redis unavailable, cache skipped (%s)", e)
        return None
    return json.loads(raw) if raw else None


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        client().set(key, json.dumps(value), ex=ttl_seconds)
    except redis.RedisError as e:
        log.warning("Redis unavailable, not cached (%s)", e)
