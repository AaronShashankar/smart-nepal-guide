"""Version 2 Phase 2: budget rates and teahouses (database.md sections 3.G and 3.H)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, pg_enum, updated_at_col, uuid_pk
from app.models.content import Place
from app.models.enums import BudgetLevel
from app.models.user import LANG, Lang

CITY_REGION = "city"  # rates for sightseeing trips; the other rows are trek regions
OTHER_REGION = "other"  # used for a trek whose region has no row of its own


class BudgetRate(Base):
    """Per-person daily costs for one budget level in one region (seeded from budget_rates.csv)."""

    __tablename__ = "budget_rate"

    budget_level: Mapped[BudgetLevel] = mapped_column(
        pg_enum(BudgetLevel, "budget_level"), primary_key=True
    )
    region: Mapped[str] = mapped_column(String(40), primary_key=True)
    food_per_day_npr: Mapped[int] = mapped_column(Integer, nullable=False)
    stay_per_day_npr: Mapped[int] = mapped_column(Integer, nullable=False)
    # City trips: taxi / bus cost per km between stops.
    transport_per_km_npr: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    # Treks: return trip Kathmandu ↔ trailhead (bus, jeep or flight, by budget level).
    trailhead_transport_npr: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime] = updated_at_col()


class Teahouse(Base):
    """A real lodge in a trek village. Only entries from a source we can name (see `source`)."""

    __tablename__ = "teahouse"

    id: Mapped[uuid.UUID] = uuid_pk()
    place_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("place.id", ondelete="CASCADE"), nullable=False, index=True
    )
    phone: Mapped[str | None] = mapped_column(Text)
    has_wifi: Mapped[bool | None] = mapped_column(Boolean)  # null = not known
    has_hot_shower: Mapped[bool | None] = mapped_column(Boolean)
    source: Mapped[str | None] = mapped_column(Text)  # where the name came from (report)
    updated_at: Mapped[datetime] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    place: Mapped[Place] = relationship()
    translations: Mapped[list["TeahouseTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class TeahouseTranslation(Base):
    __tablename__ = "teahouse_translation"

    teahouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teahouse.id", ondelete="CASCADE"), primary_key=True
    )
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    price_note: Mapped[str | None] = mapped_column(Text)
