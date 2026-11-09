"""Bounding box around a point, for the fast first step of "Near me" (algorithm.md, V2 Phase 2).

One degree of latitude is about 111 km everywhere; one degree of longitude is 111 km · cos(lat).
So a box of half-size r km is  Δlat = r / 111,  Δlng = r / (111 · cos lat).
The box is a little bigger than the circle, so the exact Haversine check comes after it.
"""

import math

KM_PER_DEGREE = 111.0
MIN_COS = 0.01  # avoid dividing by ~0 near the poles (never happens in Nepal)


def bounding_box(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """(min_lat, min_lng, max_lat, max_lng) of the box that contains the circle."""
    d_lat = radius_km / KM_PER_DEGREE
    d_lng = radius_km / (KM_PER_DEGREE * max(math.cos(math.radians(lat)), MIN_COS))
    return lat - d_lat, lng - d_lng, lat + d_lat, lng + d_lng
