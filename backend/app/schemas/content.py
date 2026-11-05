import uuid

from pydantic import BaseModel

from app.models.enums import RiskLevel


class CategoryOut(BaseModel):
    id: uuid.UUID
    code: str
    icon: str | None
    name: str


class PlaceSummary(BaseModel):
    id: uuid.UUID
    name: str
    category: CategoryOut
    latitude: float
    longitude: float
    altitude_m: int | None
    district: str | None
    province: str | None
    entry_fee_npr: int | None
    thumbnail_url: str | None


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


class SearchHit(BaseModel):
    type: str  # "place" | "trek"
    id: uuid.UUID
    name: str
    subtitle: str | None
    score: float
    matched: str  # the name or alias that matched


class SearchOut(BaseModel):
    query: str
    places: list[SearchHit]
    treks: list[SearchHit]
