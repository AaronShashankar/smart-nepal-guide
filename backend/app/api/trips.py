import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.i18n import get_lang
from app.models import Trip, User
from app.models.enums import Lang
from app.schemas.trip import OptimiseIn, StopIn, TripDetail, TripIn, TripSummary, TripUpdate
from app.services import trips as svc

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("", response_model=list[TripSummary])
def list_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Trip)
        .where(Trip.user_id == user.id, Trip.deleted_at.is_(None))
        .options(selectinload(Trip.stops))
        .order_by(Trip.updated_at.desc())
    ).all()
    return [svc.trip_summary(t) for t in rows]


@router.post("", response_model=TripDetail, status_code=status.HTTP_201_CREATED)
def create_trip(
    body: TripIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> TripDetail:
    trip = Trip(user_id=user.id, title=body.title.strip(), start_date=body.start_date)
    db.add(trip)
    for place_id in dict.fromkeys(body.place_ids):  # keep order, drop duplicates
        svc.add_stop(db, trip, place_id)
    db.commit()
    return svc.trip_detail(db, svc.get_trip(db, user, trip.id), lang)


@router.get("/{trip_id}", response_model=TripDetail)
def get_trip(
    trip_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> TripDetail:
    return svc.trip_detail(db, svc.get_trip(db, user, trip_id), lang)


@router.patch("/{trip_id}", response_model=TripDetail)
def update_trip(
    trip_id: uuid.UUID,
    body: TripUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> TripDetail:
    trip = svc.get_trip(db, user, trip_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "title" and value is None:
            continue
        setattr(trip, field, value.strip() if isinstance(value, str) else value)
    trip.updated_at = datetime.now(UTC)
    db.commit()
    return svc.trip_detail(db, trip, lang)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    trip = svc.get_trip(db, user, trip_id)
    trip.deleted_at = trip.updated_at = datetime.now(UTC)  # soft delete (offline sync)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{trip_id}/stops", response_model=TripDetail, status_code=status.HTTP_201_CREATED)
def add_stop(
    trip_id: uuid.UUID,
    body: StopIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> TripDetail:
    trip = svc.get_trip(db, user, trip_id)
    svc.add_stop(db, trip, body.place_id, body.visit_hours)
    db.commit()
    return svc.trip_detail(db, svc.get_trip(db, user, trip_id), lang)


@router.delete("/{trip_id}/stops/{stop_id}", response_model=TripDetail)
def remove_stop(
    trip_id: uuid.UUID,
    stop_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> TripDetail:
    trip = svc.get_trip(db, user, trip_id)
    stop = next((s for s in trip.stops if s.id == stop_id), None)
    if stop is not None:
        trip.stops.remove(stop)
        svc.clear_plan(trip)
        db.commit()
    return svc.trip_detail(db, trip, lang)


@router.post("/{trip_id}/optimise", response_model=TripDetail)
def optimise_trip(
    trip_id: uuid.UUID,
    body: OptimiseIn | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> TripDetail:
    """Best visiting order (nearest neighbour + 2-opt) split into days (greedy, 8 h/day).
    Saves visit_order and day_no on each stop."""
    body = body or OptimiseIn()
    trip = svc.get_trip(db, user, trip_id)
    start = (
        (body.start_lat, body.start_lng)
        if body.start_lat is not None and body.start_lng is not None
        else None
    )
    nn_km = svc.optimise(trip, start, body.max_hours_per_day)
    db.commit()
    return svc.trip_detail(db, trip, lang, nn_km)
