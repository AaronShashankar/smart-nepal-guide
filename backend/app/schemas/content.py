import uuid
from typing import Literal

from pydantic import BaseModel

from app.models.enums import RiskLevel


class CategoryOut(BaseModel):
    id: uuid.UUID
    code: str
    icon: str | None
    name: str


class RatingOut(BaseModel):
    """Bayesian average of the visible reviews (score) and how many there are (count)."""

    score: float
    count: int


class PlaceSummary(BaseModel):
    id: uuid.UUID
    name: str
    category: CategoryOut
    latitude: float
    longitude: float
    altitude_m: int | None
    district: str | None
    province: str | None
    entry_fee_npr: int | None  # foreign rate; null = free
    thumbnail_url: str | None
    rating: RatingOut | None = None  # V2: filled in place lists and detail


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class PhotoOut(BaseModel):
    url: str
    sort_order: int


class NearbyPlace(BaseModel):
    id: uuid.UUID
    name: str
    category: CategoryOut
    distance_km: float


class PlaceDetail(PlaceSummary):
    entry_fee_saarc_npr: int | None
    entry_fee_nepali_npr: int | None
    tags: list[str] = []  # codes from PLACE_TAGS; the app shows them as chips (V2-SR-07)
    area: str | None = None  # city or trek region, in the user's language (V2-SR-14)
    description: str | None
    how_to_reach: str | None
    photos: list[PhotoOut]
    best_months: list[int]
    nearby: list[NearbyPlace]


class PlaceRef(BaseModel):
    id: uuid.UUID
    name: str
    altitude_m: int | None
    latitude: float
    longitude: float


class TrekSummary(BaseModel):
    id: uuid.UUID
    name: str
    region: str
    total_days: int
    total_distance_km: float | None
    max_altitude_m: int | None
    base_difficulty: RiskLevel
    rating: RatingOut | None = None  # V2: filled in trek lists and detail


class PermitOut(BaseModel):
    code: str
    name: str
    description: str | None
    fee_nepali_npr: int | None
    fee_saarc_npr: int | None
    fee_foreign_npr: int | None


class TrekDetail(TrekSummary):
    overview: str | None
    permits: list[PermitOut]
    start_place: PlaceRef | None
    end_place: PlaceRef | None
    stage_count: int


class AreaOut(BaseModel):
    code: str
    name: str


class SearchHit(BaseModel):
    type: str  # "place" | "trek"
    id: uuid.UUID
    name: str
    subtitle: str | None  # kept for old app versions; the app builds its own from the fields below
    score: float
    matched: str  # the name, alias, district, category or village that matched
    # What matched: the item's own name (or alias), its district, its area (city or trek region),
    # its category, or (treks) a village on the way
    match: Literal["name", "district", "area", "category", "via"] = "name"
    category: CategoryOut | None = None  # places
    district: str | None = None  # places
    # The city or trek region in the user's language: places always (if they have one), treks
    # when they matched through it
    area: str | None = None
    region: str | None = None  # treks
    total_days: int | None = None  # treks
    via: str | None = None  # treks matched through a village: that village's name


class SearchOut(BaseModel):
    query: str
    places: list[SearchHit]
    treks: list[SearchHit]
