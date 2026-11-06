"""Trip planner and reviews (database.md sections 3.C and 3.F)."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at_col, pg_enum, updated_at_col, uuid_pk
from app.models.content import Place, Trek
from app.models.enums import ReviewStatus
from app.models.user import LANG, Lang, User

DEFAULT_VISIT_HOURS = Decimal("1.5")


class Trip(Base):
    __tablename__ = "trip"
    __table_args__ = (Index("ix_trip_user_updated", "user_id", "updated_at"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    total_days: Mapped[int | None] = mapped_column(Integer)  # set by "Optimise"
    total_km: Mapped[Decimal | None] = mapped_column(Numeric(7, 1))  # set by "Optimise"
    estimated_budget_npr: Mapped[int | None] = mapped_column(Integer)  # Version 2
    share_token: Mapped[str | None] = mapped_column(Text, unique=True)  # Version 2
    updated_at: Mapped[datetime] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    stops: Mapped[list["TripStop"]] = relationship(
        cascade="all, delete-orphan",
        order_by="TripStop.added_at",  # the service sorts by visit_order once optimised
    )


class TripStop(Base):
    __tablename__ = "trip_stop"
    __table_args__ = (
        CheckConstraint("visit_hours > 0 AND visit_hours <= 12", name="visit_hours_range"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip.id", ondelete="CASCADE"), nullable=False, index=True
    )
    place_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("place.id"), nullable=False
    )
    visit_order: Mapped[int | None] = mapped_column(Integer)  # nearest neighbour + 2-opt
    day_no: Mapped[int | None] = mapped_column(Integer)  # greedy day split
    visit_hours: Mapped[Decimal] = mapped_column(
        Numeric(3, 1), nullable=False, default=DEFAULT_VISIT_HOURS
    )
    added_at: Mapped[datetime] = created_at_col()

    place: Mapped[Place] = relationship()


class Review(Base):
    __tablename__ = "review"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),
        # A review is about exactly one place or one trek.
        CheckConstraint("(place_id IS NULL) <> (trek_id IS NULL)", name="one_target"),
        Index("ix_review_created", "created_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    place_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("place.id", ondelete="CASCADE"), index=True
    )
    trek_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trek.id", ondelete="CASCADE"), index=True
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    lang: Mapped[Lang] = mapped_column(LANG, nullable=False, default=Lang.en)
    status: Mapped[ReviewStatus] = mapped_column(
        pg_enum(ReviewStatus, "review_status"), nullable=False, default=ReviewStatus.visible
    )
    created_at: Mapped[datetime] = created_at_col()

    user: Mapped[User] = relationship()
    place: Mapped[Place | None] = relationship()
    trek: Mapped[Trek | None] = relationship()
