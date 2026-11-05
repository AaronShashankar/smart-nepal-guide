"""Users & authentication (database.md section 3.A)."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at_col, pg_enum, updated_at_col, uuid_pk
from app.models.enums import (
    AuthProvider,
    BudgetLevel,
    FitnessLevel,
    Lang,
    TravelStyle,
    TrekExperience,
    UserRole,
)

LANG = pg_enum(Lang, "lang")


class User(Base):
    __tablename__ = "user"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text)  # null for Google-only accounts
    full_name: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    role: Mapped[UserRole] = mapped_column(
        pg_enum(UserRole, "user_role"), nullable=False, default=UserRole.traveller
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        pg_enum(AuthProvider, "auth_provider"), nullable=False, default=AuthProvider.email
    )
    preferred_lang: Mapped[Lang] = mapped_column(LANG, nullable=False, default=Lang.en)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()

    profile: Mapped["TravellerProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    interests: Mapped[list["Interest"]] = relationship(secondary="user_interest")


class TravellerProfile(Base):
    __tablename__ = "traveller_profile"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
    )
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    fitness_level: Mapped[FitnessLevel | None] = mapped_column(
        pg_enum(FitnessLevel, "fitness_level")
    )
    trek_experience: Mapped[TrekExperience | None] = mapped_column(
        pg_enum(TrekExperience, "trek_experience")
    )
    # Optional health questions: only used for risk prediction; the user may skip them.
    has_heart_condition: Mapped[bool | None] = mapped_column(Boolean)
    has_asthma: Mapped[bool | None] = mapped_column(Boolean)
    budget_level: Mapped[BudgetLevel | None] = mapped_column(pg_enum(BudgetLevel, "budget_level"))
    travel_style: Mapped[TravelStyle | None] = mapped_column(pg_enum(TravelStyle, "travel_style"))
    updated_at: Mapped[datetime] = updated_at_col()

    user: Mapped[User] = relationship(back_populates="profile")


class Interest(Base):
    __tablename__ = "interest"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    translations: Mapped[list["InterestTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class InterestTranslation(Base):
    __tablename__ = "interest_translation"

    interest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interest.id", ondelete="CASCADE"), primary_key=True
    )
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class UserInterest(Base):
    __tablename__ = "user_interest"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
    )
    interest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interest.id", ondelete="CASCADE"), primary_key=True
    )
