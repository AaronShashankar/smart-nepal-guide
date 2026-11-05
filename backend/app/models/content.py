"""Content: categories, places, treks, stages, permits (database.md section 3.B)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, pg_enum, updated_at_col, uuid_pk
from app.models.enums import RiskLevel
from app.models.user import LANG, Lang


def _fk(target: str, **kw) -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey(target, ondelete="CASCADE"), **kw)


# ---------------------------------------------------------------- categories
class Category(Base):
    __tablename__ = "category"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(80))

    translations: Mapped[list["CategoryTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class CategoryTranslation(Base):
    __tablename__ = "category_translation"

    category_id: Mapped[uuid.UUID] = _fk("category.id", primary_key=True)
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)


# -------------------------------------------------------------------- places
class Place(Base):
    __tablename__ = "place"
    __table_args__ = (Index("ix_place_lat_lng", "latitude", "longitude"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("category.id"), nullable=False, index=True
    )
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    altitude_m: Mapped[int | None] = mapped_column(Integer)
    district: Mapped[str | None] = mapped_column(Text)
    province: Mapped[str | None] = mapped_column(Text)
    entry_fee_npr: Mapped[int | None] = mapped_column(Integer)  # null = free
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    category: Mapped[Category] = relationship(lazy="joined")
    translations: Mapped[list["PlaceTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    aliases: Mapped[list["PlaceAlias"]] = relationship(cascade="all, delete-orphan")
    photos: Mapped[list["PlacePhoto"]] = relationship(
        cascade="all, delete-orphan", order_by="PlacePhoto.sort_order"
    )
    climate: Mapped[list["PlaceClimate"]] = relationship(
        cascade="all, delete-orphan", order_by="PlaceClimate.month"
    )


class PlaceTranslation(Base):
    __tablename__ = "place_translation"
    __table_args__ = (
        Index(
            "ix_place_translation_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    place_id: Mapped[uuid.UUID] = _fk("place.id", primary_key=True)
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    how_to_reach: Mapped[str | None] = mapped_column(Text)
    is_machine_translated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL")
    )


class PlaceAlias(Base):
    __tablename__ = "place_alias"
    __table_args__ = (
        Index(
            "ix_place_alias_alias_trgm",
            "alias",
            postgresql_using="gin",
            postgresql_ops={"alias": "gin_trgm_ops"},
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    place_id: Mapped[uuid.UUID] = _fk("place.id", nullable=False, index=True)
    alias: Mapped[str] = mapped_column(Text, nullable=False)


class PlacePhoto(Base):
    __tablename__ = "place_photo"

    id: Mapped[uuid.UUID] = uuid_pk()
    place_id: Mapped[uuid.UUID] = _fk("place.id", nullable=False, index=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PlaceClimate(Base):
    __tablename__ = "place_climate"
    __table_args__ = (CheckConstraint("month BETWEEN 1 AND 12", name="month_range"),)

    place_id: Mapped[uuid.UUID] = _fk("place.id", primary_key=True)
    month: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    avg_temp_c: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    rainfall_mm: Mapped[int | None] = mapped_column(Integer)
    visibility_score: Mapped[int | None] = mapped_column(SmallInteger)  # 1 (poor) .. 10 (clear)


# --------------------------------------------------------------------- treks
class Trek(Base):
    __tablename__ = "trek"

    id: Mapped[uuid.UUID] = uuid_pk()
    region: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    total_days: Mapped[int] = mapped_column(Integer, nullable=False)
    total_distance_km: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    max_altitude_m: Mapped[int | None] = mapped_column(Integer)
    base_difficulty: Mapped[RiskLevel] = mapped_column(
        pg_enum(RiskLevel, "risk_level"), nullable=False
    )
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    translations: Mapped[list["TrekTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    stages: Mapped[list["TrekStage"]] = relationship(
        cascade="all, delete-orphan", order_by="TrekStage.day_no"
    )
    permits: Mapped[list["Permit"]] = relationship(secondary="trek_permit")


class TrekTranslation(Base):
    __tablename__ = "trek_translation"
    __table_args__ = (
        Index(
            "ix_trek_translation_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    trek_id: Mapped[uuid.UUID] = _fk("trek.id", primary_key=True)
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    overview: Mapped[str | None] = mapped_column(Text)
    is_machine_translated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class TrekStage(Base):
    __tablename__ = "trek_stage"
    __table_args__ = (UniqueConstraint("trek_id", "day_no", name="uq_trek_stage_trek_day"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    trek_id: Mapped[uuid.UUID] = _fk("trek.id", nullable=False)
    day_no: Mapped[int] = mapped_column(Integer, nullable=False)
    from_place_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("place.id"), nullable=False
    )
    to_place_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("place.id"), nullable=False
    )
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    walk_hours: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    highest_point_m: Mapped[int | None] = mapped_column(Integer)

    from_place: Mapped[Place] = relationship(foreign_keys=[from_place_id])
    to_place: Mapped[Place] = relationship(foreign_keys=[to_place_id])
    translations: Mapped[list["StageTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class StageTranslation(Base):
    __tablename__ = "stage_translation"

    stage_id: Mapped[uuid.UUID] = _fk("trek_stage.id", primary_key=True)
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    notes: Mapped[str | None] = mapped_column(Text)


# ------------------------------------------------------------------- permits
class Permit(Base):
    __tablename__ = "permit"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    fee_nepali_npr: Mapped[int | None] = mapped_column(Integer)
    fee_saarc_npr: Mapped[int | None] = mapped_column(Integer)
    fee_foreign_npr: Mapped[int | None] = mapped_column(Integer)

    translations: Mapped[list["PermitTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class PermitTranslation(Base):
    __tablename__ = "permit_translation"

    permit_id: Mapped[uuid.UUID] = _fk("permit.id", primary_key=True)
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class TrekPermit(Base):
    __tablename__ = "trek_permit"

    trek_id: Mapped[uuid.UUID] = _fk("trek.id", primary_key=True)
    permit_id: Mapped[uuid.UUID] = _fk("permit.id", primary_key=True)
