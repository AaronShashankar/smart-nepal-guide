"""Version 2 Phase 2: reviews, recommendations, near me, budget, sharing, teahouses."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.enums import BudgetLevel, Lang, Nationality, ReviewStatus
from app.schemas.content import PlaceSummary, RatingOut, TrekSummary
from app.schemas.trip import DayOut, StopOut


# ------------------------------------------------------------------- reviews
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator("comment")
    @classmethod
    def blank_is_none(cls, v: str | None) -> str | None:
        return v.strip() or None if v is not None else None


class ReviewOut(BaseModel):
    id: uuid.UUID
    rating: int
    comment: str | None
    lang: Lang
    author_name: str | None  # the user's full name; never the email
    status: ReviewStatus
    is_mine: bool
    created_at: datetime
    updated_at: datetime


class ReviewPage(BaseModel):
    items: list[ReviewOut]  # visible reviews, newest first
    total: int
    page: int
    page_size: int
    rating: RatingOut
    mine: ReviewOut | None = None  # your own review (even if an admin hid it), when logged in


# ------------------------------------------------------------ recommendations
Because = Literal[
    "INTEREST_NATURE",
    "INTEREST_CULTURE",
    "INTEREST_ADVENTURE",
    "INTEREST_RELIGIOUS",
    "GOOD_SEASON",
    "FITS_BUDGET",
    "HIGHLY_RATED",
    "OFTEN_PLANNED",
]


class RecommendationOut(BaseModel):
    type: Literal["place", "trek"]
    item: PlaceSummary | TrekSummary
    score: float  # cosine similarity (personal) or Bayesian rating (popular)
    because: list[Because]


class RecommendationsOut(BaseModel):
    mode: Literal["personal", "popular"]
    month: int
    items: list[RecommendationOut]


# ------------------------------------------------------------------- near me
class NearPlaceOut(PlaceSummary):
    distance_km: float


# -------------------------------------------------------------------- budget
class BudgetLine(BaseModel):
    code: Literal["FOOD", "STAY", "TRANSPORT", "ENTRY_FEE", "PERMIT", "TRAILHEAD_TRANSPORT"]
    label: str | None = None  # place or permit name for ENTRY_FEE / PERMIT lines
    qty: float  # days, km, or 1
    rate: float  # NPR per unit
    amount: int  # NPR, rounded


class BudgetOut(BaseModel):
    total_npr: int
    budget_level: BudgetLevel
    nationality: Nationality
    region: str  # "city" for trips, the trek region (or "other") for treks
    days: int
    lines: list[BudgetLine]


# -------------------------------------------------------------------- sharing
class ShareOut(BaseModel):
    token: str
    url: str  # web page for people without the app
    app_url: str  # deep link that opens the trip in the app


class SharedTripOut(BaseModel):
    """Read-only trip for a share link: no user data, no trip id."""

    title: str
    start_date: date | None
    total_days: int | None
    total_km: float | None
    is_optimised: bool
    stops: list[StopOut]
    days: list[DayOut]


# ------------------------------------------------------------------ teahouses
class TeahouseOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    price_note: str | None
    has_wifi: bool | None
    has_hot_shower: bool | None
    updated_at: datetime
