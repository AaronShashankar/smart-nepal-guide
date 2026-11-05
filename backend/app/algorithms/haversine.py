"""Haversine great-circle distance (algorithm.md, Part 1 §3).

d = 2R · asin( sqrt( sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2) ) ),  R = 6371 km
"""

import math
from collections.abc import Iterable

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def nearest[T](
    origin: tuple[float, float],
    items: Iterable[tuple[T, float, float]],
    k: int = 5,
) -> list[tuple[T, float]]:
    """The k items closest to `origin`, as (item, distance_km), closest first."""
    lat0, lon0 = origin
    scored = [(item, haversine_km(lat0, lon0, lat, lon)) for item, lat, lon in items]
    scored.sort(key=lambda pair: pair[1])
    return scored[:k]
