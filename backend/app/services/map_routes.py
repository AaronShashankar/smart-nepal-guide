"""Trek routes for the main map (V2-MAP-01).

Each trek becomes a line through its stage villages, in day order: the first stage's start,
then every stage's end. The line is straight between villages; real trail tracks (GPX) are
future work, so the line shows the route, not the exact path.

For a signed-in user with a complete profile, each trek also gets the risk model's level for
them this month (`my_risk`), so the map can colour treks by personal risk.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ml.features import LABELS, encode
from app.ml.registry import active_model
from app.models import Trek, TrekStage, User
from app.models.enums import Lang
from app.schemas.content import TrekRoute
from app.services.content import published_treks, trek_summary
from app.services.itinerary import stage_facts, trek_facts
from app.services.risk import build_sample, missing_profile_fields


def route_coordinates(trek: Trek) -> list[tuple[float, float]]:
    """[lng, lat] points in day order; a rest day (same village) adds no point."""
    points: list[tuple[float, float]] = []
    for i, s in enumerate(trek.stages):
        places = [s.from_place, s.to_place] if i == 0 else [s.to_place]
        for p in places:
            point = (float(p.longitude), float(p.latitude))
            if not points or points[-1] != point:
                points.append(point)
    return points


def trek_routes(db: Session, user: User | None, month: int, lang: Lang) -> list[TrekRoute]:
    treks = db.scalars(
        select(Trek)
        .where(published_treks())
        .options(
            selectinload(Trek.translations),
            selectinload(Trek.stages).selectinload(TrekStage.from_place),
            selectinload(Trek.stages).selectinload(TrekStage.to_place),
        )
        .order_by(Trek.id)
    ).all()

    loaded = None
    if user is not None and not missing_profile_fields(user.profile):
        loaded = active_model(db)

    out = []
    for t in treks:
        coords = route_coordinates(t)
        if len(coords) < 2:
            continue  # nothing to draw
        my_risk = None
        if loaded is not None:
            x = encode(build_sample(user.profile, trek_facts(stage_facts(t, lang)), month))
            my_risk = LABELS[int(loaded.model.predict_proba([x])[0].argmax())]
        out.append(
            TrekRoute(**trek_summary(t, lang).model_dump(), coordinates=coords, my_risk=my_risk)
        )
    return out
