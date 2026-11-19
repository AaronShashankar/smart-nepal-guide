"""Version 2 Phase 1: altitude profile, safer alternatives, weather, packing list."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.algorithms.acclimatisation import Status
from app.algorithms.altitude_profile import Kind
from app.algorithms.packing import Reason
from app.models.enums import PackingGroup, RiskLevel
from app.schemas.content import PlaceRef, TrekSummary


# ---------------------------------------------------------- altitude profile
class AltitudePointOut(BaseModel):
    km: float
    altitude_m: int
    day: int  # 0 = the start point
    place: str  # "" for a high point between two places
    kind: Kind
    status: Status  # acclimatisation status of `day`, to colour the line like the day badges


class AltitudeProfileOut(BaseModel):
    points: list[AltitudePointOut]
    max_altitude_m: int
    total_km: float
    total_days: int


# ------------------------------------------------------- safer alternatives
class AlternativeOut(BaseModel):
    trek: TrekSummary
    level: RiskLevel  # the model's rating of this trek for the same traveller and month
    distance: float  # Euclidean distance between the normalised trek vectors (0 = identical)
    # The trek feature where it improves most on the chosen trek; LOWER_RISK when none is lower
    why: Literal["LOWER_ALTITUDE", "SMALLER_GAIN", "FEWER_DAYS", "SHORTER_DAYS", "LOWER_RISK"]
    why_from: float | None  # that feature's value for the chosen trek ...
    why_to: float | None  # ... and for this alternative (metres, days or km per day)


class SaferAlternativesOut(BaseModel):
    trek_id: uuid.UUID
    month: int
    level: RiskLevel  # the chosen trek's rating for this traveller and month
    k: int  # neighbours looked at
    items: list[AlternativeOut]  # rated lower than `level`, nearest first; may be empty


# ------------------------------------------------------------------- weather
class WeatherDayOut(BaseModel):
    date: date
    code: int  # WMO weather code (0 = clear sky, 61 = light rain, ...)
    max_c: float | None
    min_c: float | None
    rain_mm: float | None


class WeatherOut(BaseModel):
    place: PlaceRef  # for a trek: its highest sleeping place
    fetched_at: datetime  # when Open-Meteo was asked
    stale: bool  # true: Open-Meteo failed, this is the last copy (up to 24 h old)
    days: list[WeatherDayOut]


# ---------------------------------------------------------------- packing list
class PackingItemOut(BaseModel):
    code: str  # rule code, or "permit:<CODE>" for a required permit
    name: str
    note: str | None
    reason: Reason  # why it is on the list
    value: int | None  # the number in the reason: metres (ALTITUDE, WINTER) or days (LONG_TREK)


class PackingGroupOut(BaseModel):
    group: PackingGroup
    items: list[PackingItemOut]


class PackingListOut(BaseModel):
    trek_id: uuid.UUID
    month: int
    max_altitude_m: int  # the facts the rules were checked against
    total_days: int
    total_items: int
    groups: list[PackingGroupOut]  # clothing, gear, health, documents; empty groups left out
