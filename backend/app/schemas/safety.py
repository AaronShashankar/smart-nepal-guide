"""Version 2 Phase 3: emergency contacts, SOS events and symptom checks."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.algorithms.lake_louise import RedFlag, Severity
from app.models.enums import SymptomResult


# --------------------------------------------------------- emergency contacts
class EmergencyContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    # Checked and turned into +977… by the API (services/safety.normalise_phone).
    phone: str = Field(min_length=3, max_length=25)
    email: EmailStr | None = None
    relation: str | None = Field(default=None, max_length=40)


class EmergencyContactPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    phone: str | None = Field(default=None, min_length=3, max_length=25)
    email: EmailStr | None = None
    relation: str | None = Field(default=None, max_length=40)
    sort_order: int | None = Field(default=None, ge=0)


class EmergencyContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    email: str | None
    relation: str | None
    sort_order: int


# ------------------------------------------------------------------------ SOS
class SosEventIn(BaseModel):
    """Sent by the phone's offline queue, maybe hours after the SOS itself (`sent_at`)."""

    id: uuid.UUID  # made by the phone, so sending the same event twice saves it once
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy_m: int | None = Field(default=None, ge=0, le=100_000)
    message: str = Field(min_length=1, max_length=1000)
    sent_at: datetime

    @model_validator(mode="after")
    def _both_or_neither(self) -> "SosEventIn":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Send both latitude and longitude, or neither")
        return self


class SosEventOut(BaseModel):
    id: uuid.UUID
    sent_at: datetime


# ------------------------------------------------------------- symptom checks
class SymptomCheckIn(BaseModel):
    id: uuid.UUID  # made by the phone (the check may be done offline and sent later)
    trek_id: uuid.UUID | None = None
    altitude_m: int | None = Field(default=None, ge=-500, le=9000)
    headache: int = Field(ge=0, le=3)
    gi: int = Field(ge=0, le=3)  # nausea / vomiting / poor appetite
    fatigue: int = Field(ge=0, le=3)
    dizziness: int = Field(ge=0, le=3)
    red_flags: list[RedFlag] = Field(default_factory=list, max_length=len(RedFlag))
    checked_at: datetime


class SymptomCheckOut(BaseModel):
    id: uuid.UUID
    trek_id: uuid.UUID | None
    trek_name: str | None
    altitude_m: int | None
    headache: int
    gi: int
    fatigue: int
    dizziness: int
    red_flags: list[RedFlag]
    total: int
    severity: Severity
    result: SymptomResult
    reasons: list[str]
    checked_at: datetime
