"""AI / ML tables (database.md section 3.D)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at_col, pg_enum, uuid_pk
from app.models.content import Trek
from app.models.enums import FitnessLevel, MlAlgorithm, RiskLevel, TrekExperience

RISK_LEVEL = pg_enum(RiskLevel, "risk_level")


class MlModel(Base):
    __tablename__ = "ml_model"
    __table_args__ = (
        # At most one active model.
        Index("uq_ml_model_active", "is_active", unique=True, postgresql_where="is_active"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    version: Mapped[str] = mapped_column(Text, nullable=False)
    algorithm: Mapped[MlAlgorithm] = mapped_column(
        pg_enum(MlAlgorithm, "ml_algorithm"), nullable=False
    )
    accuracy: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    f1_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)  # macro F1
    trained_at: Mapped[datetime] = created_at_col()
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)


class TrainingSample(Base):
    __tablename__ = "training_sample"
    __table_args__ = (CheckConstraint("month BETWEEN 1 AND 12", name="month_range"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    max_altitude_m: Mapped[int] = mapped_column(Integer, nullable=False)
    max_daily_gain_m: Mapped[int] = mapped_column(Integer, nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_per_day_km: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    age: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fitness_level: Mapped[FitnessLevel] = mapped_column(
        pg_enum(FitnessLevel, "fitness_level"), nullable=False
    )
    trek_experience: Mapped[TrekExperience] = mapped_column(
        pg_enum(TrekExperience, "trek_experience"), nullable=False
    )
    has_health_issue: Mapped[bool] = mapped_column(Boolean, nullable=False)
    label: Mapped[RiskLevel] = mapped_column(RISK_LEVEL, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)  # agency / survey / rule


class RiskPrediction(Base):
    __tablename__ = "risk_prediction"
    __table_args__ = (
        CheckConstraint("month BETWEEN 1 AND 12", name="month_range"),
        Index("ix_risk_prediction_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    trek_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trek.id", ondelete="CASCADE"), nullable=False
    )
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ml_model.id", ondelete="SET NULL")
    )
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    predicted_level: Mapped[RiskLevel] = mapped_column(RISK_LEVEL, nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    # [{"code": "HIGH_DAILY_GAIN", "params": {"gain": 830, "day": 2}}, ...]
    reason_codes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    input_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = created_at_col()

    trek: Mapped[Trek] = relationship()
    model: Mapped[MlModel | None] = relationship()
