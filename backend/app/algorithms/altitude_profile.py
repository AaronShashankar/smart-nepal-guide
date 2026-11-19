"""Altitude profile of a trek: known points per day, joined by linear interpolation.

Each walking day has up to three known altitudes:

* ``start``: where the previous night was spent (only the very first point of the trek),
* ``high``: the day's highest point, placed halfway through the day's distance, but only when
  it is higher than both the start and the end of the day (a pass or a viewpoint like Kala Patthar),
* ``sleep``: where the day ends.

Between two known points the altitude is assumed to change in a straight line
(linear interpolation)::

    alt(x) = a1 + (a2 - a1) * (x - x1) / (x2 - x1)

A rest day (``from == to``) adds a ``sleep`` point at the same km and altitude: the walk on a rest
day is an out-and-back acclimatisation hike, so it does not move you along the route.
"""

from bisect import bisect_right
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class Kind(StrEnum):
    start = "start"
    high = "high"
    sleep = "sleep"


@dataclass(frozen=True)
class Point:
    km: float  # distance added up along the trek
    altitude_m: int
    day: int  # 0 for the start point, otherwise the day this point belongs to
    place: str  # where you are ("" for a high point that is not a named place)
    kind: Kind


class StageLike(Protocol):
    """What the profile needs from a stage (app.services.itinerary.StageFacts has it)."""

    day: int
    from_name: str
    to_name: str
    from_altitude_m: int
    to_altitude_m: int
    distance_km: float
    highest_point_m: int | None

    @property
    def is_rest_day(self) -> bool: ...


def profile_points(stages: list[StageLike]) -> list[Point]:
    """Known altitude points of a trek, in walking order."""
    if not stages:
        return []
    first = stages[0]
    points = [Point(0.0, first.from_altitude_m, 0, first.from_name, Kind.start)]
    km = 0.0
    for s in stages:
        if s.is_rest_day:
            points.append(Point(km, s.to_altitude_m, s.day, s.to_name, Kind.sleep))
            continue
        high = s.highest_point_m
        if high is not None and high > max(s.from_altitude_m, s.to_altitude_m):
            points.append(Point(round(km + s.distance_km / 2, 2), high, s.day, "", Kind.high))
        km = round(km + s.distance_km, 2)
        points.append(Point(km, s.to_altitude_m, s.day, s.to_name, Kind.sleep))
    return points


def lerp(x1: float, a1: float, x2: float, a2: float, x: float) -> float:
    """Linear interpolation between (x1, a1) and (x2, a2)."""
    if x2 == x1:
        return a2
    return a1 + (a2 - a1) * (x - x1) / (x2 - x1)


def interpolate(points: list[Point], km: float) -> float:
    """Altitude at `km` along the trek. Outside the trek, the first or last altitude.

    Where several points share one km (a rest day), the last of them counts.
    """
    if not points:
        raise ValueError("no points")
    kms = [p.km for p in points]
    if km <= kms[0]:
        return float(points[0].altitude_m)
    if km >= kms[-1]:
        return float(points[-1].altitude_m)
    i = bisect_right(kms, km)  # points[i - 1].km <= km < points[i].km
    a, b = points[i - 1], points[i]
    return lerp(a.km, a.altitude_m, b.km, b.altitude_m, km)
