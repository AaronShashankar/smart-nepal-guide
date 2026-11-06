import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.algorithms.acclimatisation import Code, Status
from app.models.enums import FitnessLevel, MlAlgorithm, RiskLevel, TrekExperience
from app.schemas.content import PlaceRef


# ----------------------------------------------------------------- itinerary
class StageOut(BaseModel):
    day: int
    from_place: PlaceRef
    to_place: PlaceRef
    sleep_altitude_m: int
    gain_m: int  # sleeping altitude change from the night before
    distance_km: float
    walk_hours: float
    highest_point_m: int | None
    is_rest_day: bool
    notes: str | None


class ItinerarySummary(BaseModel):
    start_place: PlaceRef | None
    end_place: PlaceRef | None
    total_days: int
    total_distance_km: float
    max_altitude_m: int
    max_sleep_altitude_m: int
    max_daily_gain_m: int
    max_daily_gain_day: int | None
    rest_days: int


class ItineraryOut(BaseModel):
    summary: ItinerarySummary
    stages: list[StageOut]


class DayCheckOut(BaseModel):
    day: int
    status: Status
    gain_m: int
    codes: list[Code]


class RestSuggestionOut(BaseModel):
    before_day: int
    place: str
    altitude_m: int


class AcclimatisationOut(BaseModel):
    status: Status
    passes: bool
    days: list[DayCheckOut]
    suggested_rest_days: list[RestSuggestionOut]


# ---------------------------------------------------------------------- risk
class PredictRiskIn(BaseModel):
    trek_id: uuid.UUID
    month: int = Field(ge=1, le=12)


class ReasonOut(BaseModel):
    code: str
    params: dict = Field(default_factory=dict)


class ModelInfo(BaseModel):
    version: str
    algorithm: MlAlgorithm


class RiskInput(BaseModel):
    """The feature values used (stored as risk_prediction.input_snapshot)."""

    max_altitude_m: int
    max_daily_gain_m: int
    total_days: int
    distance_per_day_km: float
    month: int
    age: int
    fitness_level: FitnessLevel
    trek_experience: TrekExperience
    has_health_issue: bool


class RiskOut(BaseModel):
    id: uuid.UUID
    trek_id: uuid.UUID
    trek_name: str
    month: int
    level: RiskLevel
    confidence: float
    reasons: list[ReasonOut]
    acclimatisation: AcclimatisationOut
    model: ModelInfo | None
    input: RiskInput
    created_at: datetime


class PredictionOut(BaseModel):
    id: uuid.UUID
    trek_id: uuid.UUID
    trek_name: str
    month: int
    level: RiskLevel
    confidence: float
    reasons: list[ReasonOut]
    created_at: datetime
