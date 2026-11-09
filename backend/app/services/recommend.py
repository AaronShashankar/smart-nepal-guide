"""'Recommended for you': content-based filtering with cosine similarity (algorithm.md, V2 P2).

Every place and trek becomes a vector with the same 6 dimensions:

    [nature, culture, adventure, religious, season_fit, budget_fit]

- The 4 interest values come from INTEREST_WEIGHTS below (one table, copied into the report).
- season_fit: places use the best-time score of this month (0..1, Version 1); treks are 1 in
  the main seasons (spring Mar-May, autumn Sep-Nov) and 0.3 otherwise.
- budget_fit: 1 when the item is affordable at the user's budget level, 0.5 when it is one
  level above, 0 when two levels above. Unknown budget level -> 1 for every item.

The user vector has 1 for each chosen interest, 0 otherwise, then season_fit = 1, budget_fit = 1.
Items are sorted by cos(user, item). A user with no interests gets "Popular now" instead
(Bayesian rating, then how often the item was added to trips).
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.algorithms.best_time import MonthClimate, month_score
from app.algorithms.similarity import cosine
from app.models import Place, PlaceClimate, Review, Trek, Trip, TripStop, User
from app.models.enums import BudgetLevel, Lang, Nationality
from app.schemas.community import RecommendationOut, RecommendationsOut
from app.schemas.content import RatingOut
from app.services.content import (
    place_summary,
    published_places,
    published_treks,
    thumbnails,
    trek_summary,
)
from app.services.rating import global_mean, ratings

INTERESTS = ("nature", "culture", "adventure", "religious")

# Category -> interest weights (0..1). Copy this table into the report.
INTEREST_WEIGHTS: dict[str, dict[str, float]] = {
    "temple": {"religious": 1.0, "culture": 0.7},
    "heritage": {"culture": 1.0, "religious": 0.3},
    "lake": {"nature": 1.0, "adventure": 0.2},
    "viewpoint": {"nature": 0.9, "adventure": 0.5},
    "national_park": {"nature": 1.0, "adventure": 0.4},
    "village": {"culture": 0.5, "nature": 0.5, "adventure": 0.3},
}
TREK_WEIGHTS: dict[str, float] = {"adventure": 1.0, "nature": 0.8}

# Trek villages are stops on a trek: we recommend the trek, not Gorak Shep on its own.
NOT_RECOMMENDED_CATEGORIES = {"village"}

MAIN_TREK_MONTHS = {3, 4, 5, 9, 10, 11}
OFF_SEASON_FIT = 0.3
GOOD_SEASON_MIN = 0.6  # season_fit at or above this earns the GOOD_SEASON reason
NO_CLIMATE_FIT = 0.5

LEVELS = [BudgetLevel.low, BudgetLevel.medium, BudgetLevel.high]
# An item's cost level: entry fee (for the user's nationality) or trek length.
PLACE_FEE_LOW_MAX, PLACE_FEE_MEDIUM_MAX = 500, 1500  # NPR
TREK_DAYS_LOW_MAX, TREK_DAYS_MEDIUM_MAX = 5, 9

DEFAULT_LIMIT = 10
NEPAL_TZ = ZoneInfo("Asia/Kathmandu")


@dataclass
class Candidate:
    type: str  # "place" | "trek"
    id: uuid.UUID
    obj: Place | Trek
    name: str
    vector: list[float]
    rating: RatingOut | None = None
    trip_count: int = 0
    score: float = 0.0
    because: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- the vectors
def interest_part(weights: dict[str, float]) -> list[float]:
    return [weights.get(i, 0.0) for i in INTERESTS]


def trek_season_fit(month: int) -> float:
    return 1.0 if month in MAIN_TREK_MONTHS else OFF_SEASON_FIT


def place_fee(place: Place, nationality: Nationality) -> int:
    fee = {
        Nationality.foreign: place.entry_fee_npr,
        Nationality.saarc: place.entry_fee_saarc_npr,
        Nationality.nepali: place.entry_fee_nepali_npr,
    }[nationality]
    return fee or 0


def place_cost_level(place: Place, nationality: Nationality) -> BudgetLevel:
    fee = place_fee(place, nationality)
    if fee <= PLACE_FEE_LOW_MAX:
        return BudgetLevel.low
    return BudgetLevel.medium if fee <= PLACE_FEE_MEDIUM_MAX else BudgetLevel.high


def trek_cost_level(trek: Trek) -> BudgetLevel:
    if trek.total_days <= TREK_DAYS_LOW_MAX:
        return BudgetLevel.low
    return BudgetLevel.medium if trek.total_days <= TREK_DAYS_MEDIUM_MAX else BudgetLevel.high


def budget_fit(item_level: BudgetLevel, user_level: BudgetLevel | None) -> float:
    """1 if affordable at the user's level, 0.5 one level above it, 0 two levels above."""
    if user_level is None:
        return 1.0
    over = LEVELS.index(item_level) - LEVELS.index(user_level)
    return 1.0 if over <= 0 else 0.5 if over == 1 else 0.0


def user_vector(interest_codes: set[str]) -> list[float]:
    return [1.0 if i in interest_codes else 0.0 for i in INTERESTS] + [1.0, 1.0]


def because(user: list[float], item: list[float], has_budget: bool) -> list[str]:
    """The top two matching dimensions. Shared interests come first (they are why the user sees
    the item); season and budget fill the remaining place."""
    interest = sorted(
        ((user[k] * item[k], f"INTEREST_{INTERESTS[k].upper()}") for k in range(4)),
        key=lambda pair: -pair[0],
    )
    codes = [code for weight, code in interest if weight > 0]
    if item[4] >= GOOD_SEASON_MIN:
        codes.append("GOOD_SEASON")
    if has_budget and item[5] == 1.0:
        codes.append("FITS_BUDGET")
    return codes[:2]


# ------------------------------------------------------------------ the data
def current_month() -> int:
    return datetime.now(NEPAL_TZ).month


def _candidates(
    db: Session, lang: Lang, month: int, user_level: BudgetLevel | None, nationality: Nationality
) -> list[Candidate]:
    places = [
        p
        for p in db.scalars(select(Place).where(published_places())).all()
        if p.category.code not in NOT_RECOMMENDED_CATEGORIES
    ]
    climate = {
        c.place_id: c
        for c in db.scalars(
            select(PlaceClimate).where(
                PlaceClimate.month == month, PlaceClimate.place_id.in_([p.id for p in places])
            )
        )
    }
    out = []
    for p in places:
        c = climate.get(p.id)
        season = (
            month_score(
                MonthClimate(
                    month,
                    float(c.avg_temp_c) if c.avg_temp_c is not None else None,
                    c.rainfall_mm,
                    c.visibility_score,
                )
            )
            if c
            else NO_CLIMATE_FIT
        )
        vec = interest_part(INTEREST_WEIGHTS.get(p.category.code, {}))
        vec += [season, budget_fit(place_cost_level(p, nationality), user_level)]
        name = next((t.name for t in p.translations if t.lang == lang), None) or next(
            (t.name for t in p.translations if t.lang == Lang.en), ""
        )
        out.append(Candidate("place", p.id, p, name, vec))
    for t in db.scalars(select(Trek).where(published_treks())).all():
        vec = interest_part(TREK_WEIGHTS)
        vec += [trek_season_fit(month), budget_fit(trek_cost_level(t), user_level)]
        name = next((tr.name for tr in t.translations if tr.lang == lang), None) or next(
            (tr.name for tr in t.translations if tr.lang == Lang.en), ""
        )
        out.append(Candidate("trek", t.id, t, name, vec))
    return out


def _already_used(db: Session, user: User) -> set[uuid.UUID]:
    """Items the user has reviewed or put in one of their trips: no need to recommend them."""
    reviewed = db.execute(
        select(Review.place_id, Review.trek_id).where(Review.user_id == user.id)
    ).all()
    planned = db.scalars(
        select(TripStop.place_id)
        .join(Trip, Trip.id == TripStop.trip_id)
        .where(Trip.user_id == user.id, Trip.deleted_at.is_(None))
    ).all()
    return {i for row in reviewed for i in row if i is not None} | set(planned)


def _add_popularity(db: Session, items: list[Candidate]) -> None:
    m = global_mean(db)
    place_ids = [c.id for c in items if c.type == "place"]
    trek_ids = [c.id for c in items if c.type == "trek"]
    rated = ratings(db, Review.place_id, place_ids, m) | ratings(db, Review.trek_id, trek_ids, m)
    trips = dict(
        db.execute(
            select(TripStop.place_id, func.count(func.distinct(TripStop.trip_id)))
            .join(Trip, Trip.id == TripStop.trip_id)
            .where(Trip.deleted_at.is_(None), TripStop.place_id.in_(place_ids))
            .group_by(TripStop.place_id)
        ).all()
    )
    for c in items:
        c.rating = rated[c.id]
        c.trip_count = trips.get(c.id, 0)


# ------------------------------------------------------------------ the result
def recommend(
    db: Session, user: User, lang: Lang, limit: int = DEFAULT_LIMIT, month: int | None = None
) -> RecommendationsOut:
    month = month or current_month()
    profile = user.profile
    level = profile.budget_level if profile else None
    nationality = profile.nationality if profile else Nationality.foreign
    interests = {i.code for i in user.interests}

    used = _already_used(db, user)
    items = [c for c in _candidates(db, lang, month, level, nationality) if c.id not in used]
    _add_popularity(db, items)

    if interests:
        mode = "personal"
        u = user_vector(interests)
        for c in items:
            c.score = cosine(u, c.vector)
            c.because = because(u, c.vector, has_budget=level is not None)
        items.sort(key=lambda c: (-c.score, -c.rating.score, c.name.casefold()))
    else:
        mode = "popular"  # cold start: nothing to compare with yet
        for c in items:
            c.score = c.rating.score
            c.because = (["HIGHLY_RATED"] if c.rating.count else []) + (
                ["OFTEN_PLANNED"] if c.trip_count else []
            )
        items.sort(key=lambda c: (-c.rating.score, -c.trip_count, c.name.casefold()))

    top = items[:limit]
    thumbs = thumbnails(db, [c.id for c in top if c.type == "place"])
    return RecommendationsOut(
        mode=mode,
        month=month,
        items=[
            RecommendationOut(
                type=c.type,
                item=(
                    place_summary(c.obj, lang, thumbs.get(c.id), c.rating)
                    if c.type == "place"
                    else trek_summary(c.obj, lang, c.rating)
                ),
                score=round(c.score, 4),
                because=c.because,
            )
            for c in top
        ],
    )
