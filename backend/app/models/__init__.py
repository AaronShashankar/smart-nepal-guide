"""All ORM models; importing this package registers every table on Base.metadata."""

from app.models.base import Base
from app.models.content import (
    Category,
    CategoryTranslation,
    Permit,
    PermitTranslation,
    Place,
    PlaceAlias,
    PlaceClimate,
    PlacePhoto,
    PlaceTranslation,
    StageTranslation,
    Trek,
    TrekPermit,
    TrekStage,
    TrekTranslation,
)
from app.models.ml import MlModel, RiskPrediction, TrainingSample
from app.models.user import Interest, InterestTranslation, TravellerProfile, User, UserInterest

__all__ = [
    "Base",
    "Category",
    "CategoryTranslation",
    "Interest",
    "InterestTranslation",
    "MlModel",
    "Permit",
    "PermitTranslation",
    "Place",
    "PlaceAlias",
    "PlaceClimate",
    "PlacePhoto",
    "PlaceTranslation",
    "RiskPrediction",
    "StageTranslation",
    "TrainingSample",
    "TravellerProfile",
    "Trek",
    "TrekPermit",
    "TrekStage",
    "TrekTranslation",
    "User",
    "UserInterest",
]
