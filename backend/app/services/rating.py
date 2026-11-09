"""Ratings for places and treks: one grouped query per list, never one query per item."""

import uuid

from sqlalchemy import Float, cast, func, literal, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.algorithms.rating import DEFAULT_GLOBAL_MEAN, PRIOR_WEIGHT, bayesian_average
from app.models import Review
from app.models.enums import ReviewStatus
from app.schemas.content import RatingOut

VISIBLE = Review.status == ReviewStatus.visible


def global_mean(db: Session) -> float:
    """m: the mean of every visible review in the app (places and treks)."""
    mean = db.scalar(select(func.avg(Review.rating)).where(VISIBLE))
    return float(mean) if mean is not None else DEFAULT_GLOBAL_MEAN


def ratings(
    db: Session,
    column: InstrumentedAttribute,
    ids: list[uuid.UUID],
    m: float | None = None,
) -> dict[uuid.UUID, RatingOut]:
    """Bayesian rating per id. `column` is Review.place_id or Review.trek_id.

    Ids without a visible review get score = m and count = 0.
    """
    if not ids:
        return {}
    m = global_mean(db) if m is None else m
    rows = db.execute(
        select(column, func.count(), func.sum(Review.rating))
        .where(VISIBLE, column.in_(ids))
        .group_by(column)
    ).all()
    found = {item_id: (int(n), float(total)) for item_id, n, total in rows}
    out = {}
    for item_id in ids:
        n, total = found.get(item_id, (0, 0.0))
        out[item_id] = RatingOut(score=round(bayesian_average(total, n, m), 2), count=n)
    return out


def rating_order(db: Session, column: InstrumentedAttribute):
    """(aggregate subquery, ORDER BY expression) to sort a list by Bayesian rating in SQL.

    Outer-join the subquery on `subquery.c.item_id == Model.id`; unrated items sort as m.
    """
    m = global_mean(db)
    agg = (
        select(
            column.label("item_id"),
            func.count().label("n"),
            func.sum(Review.rating).label("total"),
        )
        .where(VISIBLE, column.is_not(None))
        .group_by(column)
        .subquery()
    )
    score = (literal(PRIOR_WEIGHT * m) + cast(func.coalesce(agg.c.total, 0), Float)) / (
        literal(float(PRIOR_WEIGHT)) + func.coalesce(agg.c.n, 0)
    )
    return agg, score
