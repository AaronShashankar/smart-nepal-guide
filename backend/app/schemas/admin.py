"""Admin panel request/response bodies. Text comes as {en: ..., ne: ...} so the panel can show
English / नेपाली tabs; English is required, Nepali is optional (falls back to English)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import AuthProvider, ReviewStatus, RiskLevel, UserRole


class Page[T](BaseModel):
    items: list[T]
    total: int


# ---------------------------------------------------------------- categories
class CategoryAdminIn(BaseModel):
    code: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9_]+$")
    icon: str | None = Field(default=None, max_length=80)
    name_en: str = Field(min_length=1, max_length=80)
    name_ne: str | None = Field(default=None, max_length=80)


class CategoryAdminOut(CategoryAdminIn):
    id: uuid.UUID
    place_count: int


# -------------------------------------------------------------------- places
class PlaceText(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    how_to_reach: str | None = None


class ClimateRow(BaseModel):
    month: int = Field(ge=1, le=12)
    avg_temp_c: float | None = Field(default=None, ge=-60, le=50)
    rainfall_mm: int | None = Field(default=None, ge=0, le=3000)
    visibility_score: int | None = Field(default=None, ge=1, le=10)


class PlaceAdminIn(BaseModel):
    category_code: str
    latitude: float = Field(ge=26.3, le=30.5, description="inside Nepal")
    longitude: float = Field(ge=80.0, le=88.3, description="inside Nepal")
    altitude_m: int | None = Field(default=None, ge=0, le=8849)
    district: str | None = None
    province: str | None = None
    entry_fee_npr: int | None = Field(default=None, ge=0)
    is_published: bool = True
    en: PlaceText
    ne: PlaceText = Field(default_factory=PlaceText)
    aliases: list[str] = Field(default_factory=list)
    climate: list[ClimateRow] = Field(default_factory=list, description="0 or 12 rows")

    @field_validator("en")
    @classmethod
    def english_name_required(cls, v: PlaceText) -> PlaceText:
        if not (v.name or "").strip():
            raise ValueError("English name is required")
        return v


class PhotoAdminOut(BaseModel):
    id: uuid.UUID
    url: str  # absolute (Wikimedia) or relative to the API (/uploads/...)
    sort_order: int


class PlaceAdminOut(PlaceAdminIn):
    id: uuid.UUID
    photos: list[PhotoAdminOut]
    updated_at: datetime


class PlaceAdminRow(BaseModel):
    id: uuid.UUID
    name_en: str
    name_ne: str | None
    category_code: str
    district: str | None
    altitude_m: int | None
    latitude: float
    longitude: float
    is_published: bool
    photo_count: int
    updated_at: datetime


# ----------------------------------------------------------------- permits
class PermitAdminIn(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Z0-9_]+$")
    fee_nepali_npr: int | None = Field(default=None, ge=0)
    fee_saarc_npr: int | None = Field(default=None, ge=0)
    fee_foreign_npr: int | None = Field(default=None, ge=0)
    name_en: str = Field(min_length=1)
    description_en: str | None = None
    name_ne: str | None = None
    description_ne: str | None = None


class PermitAdminOut(PermitAdminIn):
    id: uuid.UUID
    trek_count: int


# ------------------------------------------------------------------- treks
class TrekText(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    overview: str | None = None


class StageAdmin(BaseModel):
    """One day. The day number is the position in the list (1, 2, 3 ...)."""

    from_place_id: uuid.UUID
    to_place_id: uuid.UUID  # same as from = rest / acclimatisation day
    distance_km: float = Field(ge=0, le=60)
    walk_hours: float = Field(ge=0, le=14)
    highest_point_m: int | None = Field(default=None, ge=0, le=8849)
    notes_en: str | None = None
    notes_ne: str | None = None


class TrekAdminIn(BaseModel):
    region: str = Field(min_length=1, max_length=80)
    base_difficulty: RiskLevel
    is_published: bool = True
    en: TrekText
    ne: TrekText = Field(default_factory=TrekText)
    permit_codes: list[str] = Field(default_factory=list)
    stages: list[StageAdmin] = Field(min_length=1, max_length=40)

    @field_validator("en")
    @classmethod
    def english_name_required(cls, v: TrekText) -> TrekText:
        if not (v.name or "").strip():
            raise ValueError("English name is required")
        return v


class TrekAdminOut(TrekAdminIn):
    id: uuid.UUID
    total_days: int
    total_distance_km: float | None
    max_altitude_m: int | None
    updated_at: datetime


class TrekAdminRow(BaseModel):
    id: uuid.UUID
    name_en: str
    name_ne: str | None
    region: str
    total_days: int
    max_altitude_m: int | None
    base_difficulty: RiskLevel
    is_published: bool
    updated_at: datetime


# ------------------------------------------------------------------- users
class UserAdminRow(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    role: UserRole
    auth_provider: AuthProvider
    is_blocked: bool
    created_at: datetime
    prediction_count: int
    trip_count: int


class BlockIn(BaseModel):
    is_blocked: bool


# ----------------------------------------------------------------- reviews
class ReviewAdminRow(BaseModel):
    id: uuid.UUID
    user_email: str
    target_type: str  # place | trek
    target_name: str
    rating: int
    comment: str | None
    status: ReviewStatus
    created_at: datetime


class ReviewStatusIn(BaseModel):
    status: ReviewStatus


# ------------------------------------------------------------------- stats
class StatsOut(BaseModel):
    users: int
    blocked_users: int
    places: int
    treks: int
    trips: int
    reviews: int
    risk_predictions: int
    predictions_by_level: dict[RiskLevel, int]
