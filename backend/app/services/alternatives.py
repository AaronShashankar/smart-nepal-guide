"""Safer alternatives: K-nearest neighbours over trek features + the active risk model.

1. Each published trek becomes a vector of its 4 trek features (the trek half of the risk model's
   input): highest point, biggest daily sleeping gain, days, km per day.
2. Min-max normalise the vectors over all published treks, then take the K = 4 treks nearest to the
   chosen one by Euclidean distance (app/algorithms/knn.py).
3. Rate each neighbour with the active model for *this* traveller and month (not saved), and keep
   only treks rated lower than the chosen trek. Show the 3 nearest of those, or nothing.

With only 8 treks, the 4 nearest are half of all treks; KNN gets more useful as treks are added.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.algorithms.knn import k_nearest, normalise
from app.ml.features import LABELS, encode
from app.models import Trek, TrekStage, User
from app.models.enums import Lang, RiskLevel
from app.schemas.smart import AlternativeOut, SaferAlternativesOut
from app.services.content import published_treks, trek_summary
from app.services.itinerary import TrekFacts, stage_facts, trek_facts
from app.services.risk import build_sample, require_model, require_profile

K = 4
SHOW = 3
TREK_FEATURES = ("max_altitude_m", "max_daily_gain_m", "total_days", "distance_per_day_km")
# Reason code for the feature where an alternative improves most on the chosen trek
WHY = {
    "max_altitude_m": "LOWER_ALTITUDE",
    "max_daily_gain_m": "SMALLER_GAIN",
    "total_days": "FEWER_DAYS",
    "distance_per_day_km": "SHORTER_DAYS",
}


def trek_vector(facts: TrekFacts) -> list[float]:
    return [float(getattr(facts, name)) for name in TREK_FEATURES]


def main_reason(chosen: list[float], alternative: list[float]) -> str | None:
    """The feature (by normalised value) where the alternative is lowest compared with the
    chosen trek, or None when it is lower in none of them (the model rated it lower anyway)."""
    gains = [c - a for c, a in zip(chosen, alternative, strict=True)]
    best = max(range(len(gains)), key=lambda i: gains[i])
    return TREK_FEATURES[best] if gains[best] > 0 else None


def safer_alternatives(
    db: Session, user: User, trek_id: uuid.UUID, month: int, lang: Lang
) -> SaferAlternativesOut:
    profile = require_profile(user)
    loaded = require_model(db)
    treks = db.scalars(
        select(Trek)
        .where(published_treks())
        .options(
            selectinload(Trek.stages).selectinload(TrekStage.from_place),
            selectinload(Trek.stages).selectinload(TrekStage.to_place),
        )
        .order_by(Trek.id)
    ).all()
    by_id = {t.id: t for t in treks}
    if trek_id not in by_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trek not found")

    facts = {t.id: trek_facts(stage_facts(t, lang)) for t in treks}
    ids = list(by_id)
    norm = dict(zip(ids, normalise([trek_vector(facts[i]) for i in ids]), strict=True))
    others = [i for i in ids if i != trek_id]

    def level_index(i: uuid.UUID) -> int:
        x = encode(build_sample(profile, facts[i], month))
        return int(loaded.model.predict_proba([x])[0].argmax())

    chosen_level = level_index(trek_id)
    items = []
    for index, distance in k_nearest(norm[trek_id], [norm[i] for i in others], K):
        other = others[index]
        level = level_index(other)
        if level >= chosen_level:
            continue  # never suggest a trek that is just as risky
        reason = main_reason(norm[trek_id], norm[other])
        items.append(
            AlternativeOut(
                trek=trek_summary(by_id[other], lang),
                level=RiskLevel(LABELS[level]),
                distance=round(distance, 3),
                why=WHY[reason] if reason else "LOWER_RISK",
                why_from=getattr(facts[trek_id], reason) if reason else None,
                why_to=getattr(facts[other], reason) if reason else None,
            )
        )
    return SaferAlternativesOut(
        trek_id=trek_id,
        month=month,
        level=RiskLevel(LABELS[chosen_level]),
        k=K,
        items=items[:SHOW],
    )
