"""'Recommended for you': content-based filtering with cosine similarity (algorithm.md, V2 P2),
improved in V2-SR (docs/product/search-recommendation.md).

1. Item vectors (18 numbers)

    [nature, culture, adventure, religious,   <- INTEREST_WEIGHTS by category (treks: TREK_WEIGHTS)
     12 tags (PLACE_TAGS) x TAG_WEIGHT,        <- what is special about the item (V2-SR-07)
     season_fit, budget_fit]

   - Place tags are set in data/place_tags.csv and the admin panel; trek tags are worked out
     from the trek (TREK_TAGS, + high_altitude above HIGH_ALTITUDE_M).
   - season_fit: places use the best-time score of this month (0..1, Version 1); treks are 1 in
     the main seasons (spring Mar-May, autumn Sep-Nov) and 0.3 otherwise.
   - budget_fit: 1 when the item is affordable at the user's budget level, 0.5 one level above,
     0 two levels above. Unknown budget level -> 1 for every item.

2. User vector (same 18 numbers): 1 for each chosen interest, the tag weights those interests
   suggest (TAG_INTERESTS), then season_fit = 1, budget_fit = 1. On top of that, it learns from
   what the user did (V2-SR-02): each review, trip stop and "Not interested" gives a signal
   (FEEDBACK), and the average of signal x item vector is added (negatives clipped to 0).

3. Score of an item = cosine(user, item) x risk factor + nearby bonus
   - risk factor (V2-SR-01): for treks, our risk model's level for this user and month
     (RISK_FACTOR); skipped when the profile is incomplete or no model is trained.
   - nearby bonus (V2-SR-04): NEAR_WEIGHT x e^(-d / NEAR_SCALE_KM), d = km from the user's GPS
     position (sent by the app when location is already allowed) or, without it, from the
     middle of the user's latest trip.

4. The list (V2-SR-05, -06): only items that share at least one interest or tag with the user;
   picked one at a time with MMR (maximal marginal relevance) so the list is not 10 temples:
       next = argmax  λ x score - (1 - λ) x max similarity(item, items already picked)
   where similarity = half cosine of what the items are about + half 'same kind' (temple, lake...).
   If fewer than `limit` items are left, the rest are filled with popular items marked
   EXPLORE_MORE.

A user with no interests and no feedback gets "Popular now" instead (Bayesian rating, then how
often the item was added to trips), still with the risk factor and nearby bonus.
"Not interested" (V2-SR-03) and items already reviewed or planned are never shown.
"""

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, selectinload

from app.algorithms.best_time import MonthClimate, month_score
from app.algorithms.haversine import haversine_km
from app.algorithms.similarity import cosine
from app.ml.features import LABELS, encode
from app.ml.registry import active_model
from app.models import (
    DismissedItem,
    Place,
    PlaceClimate,
    Review,
    Trek,
    TrekStage,
    Trip,
    TripStop,
    User,
)
from app.models.enums import PLACE_TAGS, BudgetLevel, Lang, Nationality, RiskLevel
from app.schemas.community import RecommendationOut, RecommendationsOut
from app.schemas.content import RatingOut
from app.services.content import (
    place_summary,
    published_places,
    published_treks,
    thumbnails,
    trek_summary,
)
from app.services.itinerary import stage_facts, trek_facts
from app.services.rating import global_mean, ratings
from app.services.risk import build_sample, missing_profile_fields

INTERESTS = ("nature", "culture", "adventure", "religious")
TAGS = PLACE_TAGS

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

# Tag -> interest weights: which tags a user with these interests probably likes.
TAG_INTERESTS: dict[str, dict[str, float]] = {
    "sunrise": {"nature": 0.6},
    "mountain_views": {"nature": 0.8, "adventure": 0.4},
    "hiking": {"adventure": 0.8, "nature": 0.4},
    "boating": {"nature": 0.5, "adventure": 0.3},
    "wildlife": {"nature": 1.0, "adventure": 0.3},
    "pilgrimage": {"religious": 1.0},
    "unesco": {"culture": 0.8, "religious": 0.3},
    "architecture": {"culture": 0.8},
    "local_culture": {"culture": 1.0},
    "family": {},
    "high_altitude": {"adventure": 1.0},
    "few_crowds": {"nature": 0.3, "adventure": 0.3},
}
TAG_WEIGHT = 0.5  # tags count half as much as the 4 interests
TREK_TAGS = ("hiking", "mountain_views", "local_culture")
HIGH_ALTITUDE_M = 4000

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

# Learning from feedback (V2-SR-02): signal per action
FEEDBACK = {5: 1.0, 4: 0.5, 3: 0.0, 2: -0.5, 1: -1.0}  # review stars
TRIP_SIGNAL = 0.5  # a place the user put in a trip
DISMISS_SIGNAL = -1.0  # "Not interested"
SIMILAR_TO_LIKED_MIN = 0.8  # cosine with the liked items for the SIMILAR_TO_LIKED reason

# Risk-aware (V2-SR-01): how much of the score a trek keeps at each predicted level
RISK_FACTOR = {"easy": 1.0, "moderate": 1.0, "hard": 0.7, "risky": 0.4}

# Nearby (V2-SR-04)
NEAR_WEIGHT = 0.15
NEAR_SCALE_KM = 40.0
NEAR_REASON_KM = 25.0

SAME_KIND_WEIGHT = 0.5  # in item_similarity
MMR_LAMBDA = 0.75  # 1 = only relevance, 0 = only variety; chosen with app/recommend_benchmark.py

DEFAULT_LIMIT = 10
NEPAL_TZ = ZoneInfo("Asia/Kathmandu")


@dataclass
class Candidate:
    type: str  # "place" | "trek"
    id: uuid.UUID
    obj: Place | Trek
    name: str
    vector: list[float]
    lat: float | None = None
    lng: float | None = None
    rating: RatingOut | None = None
    trip_count: int = 0
    relevance: float = 0.0  # cosine (personal) or rating / 5 (popular)
    risk: str | None = None  # predicted level for treks
    distance_km: float | None = None
    score: float = 0.0
    because: list[str] = field(default_factory=list)

    @property
    def content(self) -> list[float]:
        """The interest and tag part: what the item is about (no season or budget)."""
        return self.vector[: len(INTERESTS) + len(TAGS)]

    @property
    def kind(self) -> str:
        """'trek' or the place's category code (temple, lake, ...)."""
        return "trek" if self.type == "trek" else self.obj.category.code


@dataclass
class Origin:
    lat: float
    lng: float
    reason: str  # NEAR_YOU (GPS) or NEAR_YOUR_TRIP


# ---------------------------------------------------------------- the vectors
def interest_part(weights: dict[str, float]) -> list[float]:
    return [weights.get(i, 0.0) for i in INTERESTS]


def tag_part(tags: list[str] | tuple[str, ...]) -> list[float]:
    return [TAG_WEIGHT if t in tags else 0.0 for t in TAGS]


def user_tag_part(interest_codes: set[str]) -> list[float]:
    """The tags these interests suggest: the strongest link from any chosen interest."""
    return [
        TAG_WEIGHT * max((TAG_INTERESTS[t].get(i, 0.0) for i in interest_codes), default=0.0)
        for t in TAGS
    ]


def trek_tags(trek: Trek, max_altitude_m: int | None) -> list[str]:
    tags = list(TREK_TAGS)
    if (max_altitude_m or 0) >= HIGH_ALTITUDE_M:
        tags.append("high_altitude")
    return tags


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


def user_vector(interest_codes: set[str], learned: list[float] | None = None) -> list[float]:
    """Interests + the tags they suggest (+ what was learned from feedback), then season and
    budget fit 1."""
    taste = [1.0 if i in interest_codes else 0.0 for i in INTERESTS]
    taste += user_tag_part(interest_codes)
    if learned:
        taste = [max(0.0, a + b) for a, b in zip(taste, learned, strict=True)]
    return taste + [1.0, 1.0]


def learned_taste(signals: list[tuple[float, list[float]]]) -> list[float] | None:
    """Average of signal x item content vector: liked items pull the user towards them,
    disliked ones push away. None when there is nothing to learn from."""
    useful = [(s, v) for s, v in signals if s != 0]
    if not useful:
        return None
    size = len(useful[0][1])
    return [sum(s * v[k] for s, v in useful) / len(useful) for k in range(size)]


def near_bonus(distance_km: float) -> float:
    return NEAR_WEIGHT * math.exp(-distance_km / NEAR_SCALE_KM)


def item_similarity(a: "Candidate", b: "Candidate") -> float:
    """How alike two items look to a user, for MMR: half the cosine of what they are about,
    half 'same kind of item'. The cosine alone sees two temples with different tags as quite
    different, so lists stayed all temples; the kind part fixes that."""
    same_kind = 1.0 if a.kind == b.kind else 0.0
    return SAME_KIND_WEIGHT * same_kind + (1 - SAME_KIND_WEIGHT) * cosine(a.content, b.content)


def mmr(items: list["Candidate"], k: int, lam: float = MMR_LAMBDA) -> list["Candidate"]:
    """Maximal marginal relevance: pick the item with the best mix of a high score and being
    different from what is already picked (item_similarity)."""
    left, picked = list(items), []
    while left and len(picked) < k:
        best = max(
            left,
            key=lambda c: (
                lam * c.score
                - (1 - lam) * max((item_similarity(c, p) for p in picked), default=0.0)
            ),
        )
        picked.append(best)
        left.remove(best)
    return picked


def interest_reasons(user: list[float], item: list[float]) -> list[str]:
    """Shared interests, strongest first."""
    pairs = sorted(
        ((user[k] * item[k], f"INTEREST_{INTERESTS[k].upper()}") for k in range(len(INTERESTS))),
        key=lambda pair: -pair[0],
    )
    return [code for weight, code in pairs if weight > 0]


def because(
    c: Candidate,
    interests: list[str],
    origin: Origin | None,
    liked: list[float] | None,
    has_budget: bool,
) -> list[str]:
    """The two best reasons, most telling first: the top shared interest, then nearby, similar
    to what you liked, fits you (low risk), another interest, good season, fits your budget."""
    codes = interests[:1]
    if origin and c.distance_km is not None and c.distance_km <= NEAR_REASON_KM:
        codes.append(origin.reason)
    if liked and cosine(liked, c.content) >= SIMILAR_TO_LIKED_MIN:
        codes.append("SIMILAR_TO_LIKED")
    if c.risk in ("easy", "moderate"):
        codes.append("FITS_YOU")
    codes += interests[1:]
    if c.vector[-2] >= GOOD_SEASON_MIN:
        codes.append("GOOD_SEASON")
    if has_budget and c.vector[-1] == 1.0:
        codes.append("FITS_BUDGET")
    return codes[:2]


# ------------------------------------------------------------------ the data
def current_month() -> int:
    return datetime.now(NEPAL_TZ).month


def _place_season(c: PlaceClimate | None, month: int) -> float:
    if c is None:
        return NO_CLIMATE_FIT
    temp = float(c.avg_temp_c) if c.avg_temp_c is not None else None
    return month_score(MonthClimate(month, temp, c.rainfall_mm, c.visibility_score))


def _name(translations, lang: Lang) -> str:
    return next((t.name for t in translations if t.lang == lang), None) or next(
        (t.name for t in translations if t.lang == Lang.en), ""
    )


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
        vec = interest_part(INTEREST_WEIGHTS.get(p.category.code, {})) + tag_part(p.tags or [])
        vec += [
            _place_season(climate.get(p.id), month),
            budget_fit(place_cost_level(p, nationality), user_level),
        ]
        out.append(
            Candidate(
                "place",
                p.id,
                p,
                _name(p.translations, lang),
                vec,
                lat=float(p.latitude),
                lng=float(p.longitude),
            )  # fmt: skip
        )
    treks = db.scalars(
        select(Trek)
        .where(published_treks())
        .options(
            selectinload(Trek.stages).selectinload(TrekStage.from_place),
            selectinload(Trek.stages).selectinload(TrekStage.to_place),
        )
    ).all()
    for t in treks:
        vec = interest_part(TREK_WEIGHTS) + tag_part(trek_tags(t, t.max_altitude_m))
        vec += [trek_season_fit(month), budget_fit(trek_cost_level(t), user_level)]
        start = t.stages[0].from_place if t.stages else None  # where the walk begins
        out.append(
            Candidate(
                "trek",
                t.id,
                t,
                _name(t.translations, lang),
                vec,
                lat=float(start.latitude) if start else None,
                lng=float(start.longitude) if start else None,
            )  # fmt: skip
        )
    return out


def _dismissed(db: Session, user: User) -> set[uuid.UUID]:
    rows = db.execute(
        select(DismissedItem.place_id, DismissedItem.trek_id).where(
            DismissedItem.user_id == user.id
        )
    ).all()
    return {i for row in rows for i in row if i is not None}


def _feedback(db: Session, user: User) -> tuple[dict[uuid.UUID, float], set[uuid.UUID]]:
    """(signal per item, items not to show). Reviewed, planned and "Not interested" items are
    not recommended again; they are also what the user taught us about their taste."""
    signals: dict[uuid.UUID, float] = {}
    used: set[uuid.UUID] = set()
    planned = db.scalars(
        select(TripStop.place_id)
        .join(Trip, Trip.id == TripStop.trip_id)
        .where(Trip.user_id == user.id, Trip.deleted_at.is_(None))
        .distinct()
    ).all()
    for pid in planned:
        signals[pid] = TRIP_SIGNAL
        used.add(pid)
    reviews = db.execute(
        select(Review.place_id, Review.trek_id, Review.rating).where(Review.user_id == user.id)
    ).all()
    for place_id, trek_id, rating in reviews:
        item = place_id or trek_id
        signals[item] = FEEDBACK[rating]  # a review says more than a trip stop
        used.add(item)
    for item in _dismissed(db, user):
        signals[item] = DISMISS_SIGNAL
        used.add(item)
    return signals, used


def _origin(db: Session, user: User, lat: float | None, lng: float | None) -> Origin | None:
    """Where the user is (GPS) or, without it, the middle of their latest trip."""
    if lat is not None and lng is not None:
        return Origin(lat, lng, "NEAR_YOU")
    trip = db.scalar(
        select(Trip)
        .where(Trip.user_id == user.id, Trip.deleted_at.is_(None), Trip.stops.any())
        .order_by(Trip.updated_at.desc())
        .limit(1)
    )
    if trip is None:
        return None
    points = [(float(s.place.latitude), float(s.place.longitude)) for s in trip.stops]
    return Origin(
        sum(p[0] for p in points) / len(points),
        sum(p[1] for p in points) / len(points),
        "NEAR_YOUR_TRIP",
    )


def _add_risk(db: Session, user: User, items: list[Candidate], month: int, lang: Lang) -> None:
    """Our risk model's level for each trek (V2-SR-01). Skipped without a complete profile or a
    trained model: then no trek is marked down."""
    if missing_profile_fields(user.profile):
        return
    loaded = active_model(db)
    if loaded is None:
        return
    for c in items:
        if c.type == "trek":
            facts = trek_facts(stage_facts(c.obj, lang))
            x = encode(build_sample(user.profile, facts, month))
            c.risk = LABELS[int(loaded.model.predict_proba([x])[0].argmax())]


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


def _popular_reasons(c: Candidate, origin: Origin | None) -> list[str]:
    codes = []
    if origin and c.distance_km is not None and c.distance_km <= NEAR_REASON_KM:
        codes.append(origin.reason)
    if c.rating.count:
        codes.append("HIGHLY_RATED")
    if c.trip_count:
        codes.append("OFTEN_PLANNED")
    if c.risk in ("easy", "moderate"):
        codes.append("FITS_YOU")
    return codes[:2]


# ------------------------------------------------------------------ the result
def recommend(
    db: Session,
    user: User,
    lang: Lang,
    limit: int = DEFAULT_LIMIT,
    month: int | None = None,
    lat: float | None = None,
    lng: float | None = None,
    mmr_lambda: float = MMR_LAMBDA,
) -> RecommendationsOut:
    month = month or current_month()
    profile = user.profile
    level = profile.budget_level if profile else None
    nationality = profile.nationality if profile else Nationality.foreign
    interests = {i.code for i in user.interests}

    every = _candidates(db, lang, month, level, nationality)
    signals, used = _feedback(db, user)
    by_id = {c.id: c for c in every}
    # An item we do not recommend (e.g. a trek village in a trip) does not teach anything
    known = [(s, by_id[i].content) for i, s in signals.items() if i in by_id]
    learned = learned_taste(known)
    liked = learned_taste([(s, v) for s, v in known if s > 0])

    items = [c for c in every if c.id not in used]
    _add_popularity(db, items)
    _add_risk(db, user, items, month, lang)
    origin = _origin(db, user, lat, lng)
    for c in items:
        if origin and c.lat is not None:
            c.distance_km = haversine_km(origin.lat, origin.lng, c.lat, c.lng)

    def final(c: Candidate) -> float:
        bonus = near_bonus(c.distance_km) if c.distance_km is not None else 0.0
        return c.relevance * RISK_FACTOR.get(c.risk or "easy", 1.0) + bonus

    if interests or learned:
        mode = "personal"
        u = user_vector(interests, learned)
        taste = u[: len(INTERESTS) + len(TAGS)]
        matching, other = [], []
        for c in items:
            c.relevance = cosine(u, c.vector)
            c.score = final(c)
            shared = interest_reasons(u, c.vector)
            # V2-SR-06: only items that share an interest or a tag with the user
            if any(a > 0 and b > 0 for a, b in zip(taste, c.content, strict=True)):
                c.because = because(c, shared, origin, liked, has_budget=level is not None)
                matching.append(c)
            else:
                other.append(c)
        top = mmr(matching, limit, mmr_lambda)
        if len(top) < limit:  # fill the list with popular items the user might also like
            for c in other:
                c.because = ["EXPLORE_MORE"]
            other.sort(key=lambda c: (-c.rating.score, -c.trip_count, c.name.casefold()))
            top += other[: limit - len(top)]
    else:
        mode = "popular"  # cold start: nothing to compare with yet
        for c in items:
            c.relevance = c.rating.score / 5
            c.score = final(c)
            c.because = _popular_reasons(c, origin)
        items.sort(key=lambda c: (-c.score, -c.trip_count, c.name.casefold()))
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
                risk_level=RiskLevel(c.risk) if c.risk else None,
                distance_km=round(c.distance_km, 1) if c.distance_km is not None else None,
            )
            for c in top
        ],
    )


# ------------------------------------------------------------- not interested
def dismiss(db: Session, user: User, item_type: str, item_id: uuid.UUID) -> None:
    """'Not interested' (V2-SR-03). Saying it twice is fine."""
    column = "place_id" if item_type == "place" else "trek_id"
    stmt = insert(DismissedItem).values(id=uuid.uuid4(), user_id=user.id, **{column: item_id})
    db.execute(stmt.on_conflict_do_nothing())
    db.commit()


def undo_dismiss(db: Session, user: User, item_type: str, item_id: uuid.UUID) -> None:
    column = DismissedItem.place_id if item_type == "place" else DismissedItem.trek_id
    db.execute(delete(DismissedItem).where(DismissedItem.user_id == user.id, column == item_id))
    db.commit()
