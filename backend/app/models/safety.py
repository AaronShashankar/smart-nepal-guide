"""Version 2 Phase 3: safety (database.md section 3.E).

Emergency contacts, SOS events and symptom checks. SOS events and symptom checks can be made on
the trail without internet: the phone gives them their UUID, keeps them in a queue and sends them
when it is online again. Sending one twice is harmless (the second insert is ignored).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at_col, pg_enum, updated_at_col, uuid_pk
from app.models.content import Trek
from app.models.enums import SymptomResult

MAX_EMERGENCY_CONTACTS = 5


class EmergencyContact(Base):
    """Someone the traveller wants told in an emergency (at most 5 per user)."""

    __tablename__ = "emergency_contact"
    __table_args__ = (Index("ix_emergency_contact_user_order", "user_id", "sort_order"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)  # E.164: +9779812345678
    email: Mapped[str | None] = mapped_column(Text)
    relation: Mapped[str | None] = mapped_column(Text)  # "Father", "Friend", …
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SosEvent(Base):
    """An SOS the traveller sent from the app (the SMS itself goes through the phone)."""

    __tablename__ = "sos_event"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # made by the phone
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Null when the phone had no position at all; the SMS then says so.
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    accuracy_m: Mapped[int | None] = mapped_column(Integer)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # phone
    created_at: Mapped[datetime] = created_at_col()  # when the server received it


class SymptomCheck(Base):
    """One Lake Louise self-check. The server scores it again; it never trusts the phone's score."""

    __tablename__ = "symptom_check"
    __table_args__ = (
        CheckConstraint(
            "headache BETWEEN 0 AND 3 AND gi_symptoms BETWEEN 0 AND 3 "
            "AND fatigue BETWEEN 0 AND 3 AND dizziness BETWEEN 0 AND 3",
            name="scores_0_to_3",
        ),
        Index("ix_symptom_check_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # made by the phone
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    trek_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trek.id", ondelete="SET NULL")
    )
    altitude_m: Mapped[int | None] = mapped_column(Integer)
    headache: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    gi_symptoms: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fatigue: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    dizziness: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    red_flags: Mapped[list[str]] = mapped_column(
        ARRAY(String(30)), nullable=False, default=list, server_default="{}"
    )
    total_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    result: Mapped[SymptomResult] = mapped_column(
        pg_enum(SymptomResult, "symptom_result"), nullable=False
    )
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # phone
    created_at: Mapped[datetime] = created_at_col()

    trek: Mapped[Trek | None] = relationship()
