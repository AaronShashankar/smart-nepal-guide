import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    AuthProvider,
    BudgetLevel,
    FitnessLevel,
    Lang,
    TravelStyle,
    TrekExperience,
    UserRole,
)


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None
    phone: str | None
    role: UserRole
    auth_provider: AuthProvider
    preferred_lang: Lang
    has_profile: bool = False


class MeUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=20, pattern=r"^\+?[0-9 \-]{7,20}$")
    preferred_lang: Lang | None = None


class ProfileIn(BaseModel):
    date_of_birth: date | None = None
    fitness_level: FitnessLevel | None = None
    trek_experience: TrekExperience | None = None
    has_heart_condition: bool | None = None
    has_asthma: bool | None = None
    budget_level: BudgetLevel | None = None
    travel_style: TravelStyle | None = None
    interests: list[str] = Field(default_factory=list, description="interest codes")


class InterestOut(BaseModel):
    code: str
    name: str


class ProfileOut(BaseModel):
    date_of_birth: date | None = None
    fitness_level: FitnessLevel | None = None
    trek_experience: TrekExperience | None = None
    has_heart_condition: bool | None = None
    has_asthma: bool | None = None
    budget_level: BudgetLevel | None = None
    travel_style: TravelStyle | None = None
    interests: list[InterestOut] = Field(default_factory=list)
