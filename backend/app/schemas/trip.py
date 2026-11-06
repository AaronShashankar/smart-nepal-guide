import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.content import PlaceSummary


class TripIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    start_date: date | None = None
    place_ids: list[uuid.UUID] = Field(default_factory=list, description="optional first stops")


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    start_date: date | None = None


class StopIn(BaseModel):
    place_id: uuid.UUID
    visit_hours: float = Field(default=1.5, gt=0, le=12)


class OptimiseIn(BaseModel):
    """Optional start point (e.g. the phone's location or the hotel)."""

    start_lat: float | None = Field(default=None, ge=-90, le=90)
    start_lng: float | None = Field(default=None, ge=-180, le=180)
    max_hours_per_day: float = Field(default=8, ge=2, le=14)


class StopOut(BaseModel):
    id: uuid.UUID
    place: PlaceSummary
    visit_order: int | None
    day_no: int | None
    visit_hours: float


class DayOut(BaseModel):
    day_no: int
    stop_ids: list[uuid.UUID]
    km: float  # straight-line km between this day's stops
    travel_hours: float
    visit_hours: float


class TripSummary(BaseModel):
    id: uuid.UUID
    title: str
    start_date: date | None
    stop_count: int
    total_days: int | None
    total_km: float | None
    updated_at: datetime


class TripDetail(TripSummary):
    is_optimised: bool
    stops: list[StopOut]  # in visiting order once optimised, else in the order added
    days: list[DayOut]
    nearest_neighbour_km: float | None = None  # only in the /optimise response
