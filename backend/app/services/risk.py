"""Personal risk prediction: profile + trek summary + month -> model -> level and reasons."""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.i18n import pick_one
from app.ml.features import LABELS, Sample, encode
from app.ml.forest import RandomForest
from app.ml.reasons import explain
from app.ml.registry import active_model
from app.models import RiskPrediction, TravellerProfile, Trek, User
from app.models.enums import Lang, RiskLevel
from app.schemas.risk import ModelInfo, PredictionOut, ReasonOut, RiskInput, RiskOut
from app.services.itinerary import acclimatisation, acclimatisation_out, stage_facts, trek_facts

REQUIRED_PROFILE_FIELDS = ("date_of_birth", "fitness_level", "trek_experience")


def age_on(born: date, today: date) -> int:
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def missing_profile_fields(profile: TravellerProfile | None) -> list[str]:
    if profile is None:
        return list(REQUIRED_PROFILE_FIELDS)
    return [f for f in REQUIRED_PROFILE_FIELDS if getattr(profile, f) is None]


def has_health_issue(profile: TravellerProfile) -> bool:
    """Heart condition OR asthma. An unanswered question counts as 'no'."""
    return bool(profile.has_heart_condition) or bool(profile.has_asthma)


def predict(db: Session, user: User, trek: Trek, month: int, lang: Lang) -> RiskOut:
    missing = missing_profile_fields(user.profile)
    if missing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "code": "PROFILE_INCOMPLETE",
                "missing": missing,
                "message": "Complete your traveller profile first.",
            },
        )
    loaded = active_model(db)
    if loaded is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "No trained model yet: run `uv run python -m app.ml.train`.",
        )

    stages = stage_facts(trek, lang)
    facts = trek_facts(stages)
    profile = user.profile
    sample = Sample(
        max_altitude_m=facts.max_altitude_m,
        max_daily_gain_m=facts.max_daily_gain_m,
        total_days=facts.total_days,
        distance_per_day_km=facts.distance_per_day_km,
        month=month,
        age=age_on(profile.date_of_birth, date.today()),
        fitness_level=profile.fitness_level.value,
        trek_experience=profile.trek_experience.value,
        has_health_issue=has_health_issue(profile),
    )
    x = encode(sample)
    model = loaded.model
    proba = model.predict_proba([x])[0]
    level = LABELS[int(proba.argmax())]
    paths = (
        model.winning_paths([x]) if isinstance(model, RandomForest) else [model.decision_path(x)]
    )
    reasons = explain(paths, sample, level, {"gain_day": facts.max_daily_gain_day})
    reason_dicts = [{"code": r.code, "params": r.params} for r in reasons]

    row = RiskPrediction(
        user_id=user.id,
        trek_id=trek.id,
        model_id=loaded.row.id,
        month=month,
        predicted_level=RiskLevel(level),
        confidence=round(float(proba.max()), 3),
        reason_codes=reason_dicts,
        input_snapshot=sample.as_dict(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return RiskOut(
        id=row.id,
        trek_id=trek.id,
        trek_name=pick_one(trek.translations, lang),
        month=month,
        level=row.predicted_level,
        confidence=float(row.confidence),
        reasons=[ReasonOut(**r) for r in reason_dicts],
        acclimatisation=acclimatisation_out(acclimatisation(stages)),
        model=ModelInfo(version=loaded.row.version, algorithm=loaded.row.algorithm),
        input=RiskInput(**sample.as_dict()),
        created_at=row.created_at,
    )


def prediction_out(p: RiskPrediction, lang: Lang) -> PredictionOut:
    return PredictionOut(
        id=p.id,
        trek_id=p.trek_id,
        trek_name=pick_one(p.trek.translations, lang),
        month=p.month,
        level=p.predicted_level,
        confidence=float(p.confidence),
        reasons=[ReasonOut(**r) for r in p.reason_codes],
        created_at=p.created_at,
    )
