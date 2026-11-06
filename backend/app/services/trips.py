"""Trip planner service: ownership checks, stops and the optimise step."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.algorithms.route import distance_matrix, plan_trip, travel_hours
from app.models import Place, Trip, TripStop, User
from app.models.enums import Lang
from app.schemas.trip import DayOut, StopOut, TripDetail, TripSummary
from app.services.content import place_summary, published_places, thumbnails


def get_trip(db: Session, user: User, trip_id: uuid.UUID) -> Trip:
    trip = db.scalar(
        select(Trip)
        .where(Trip.id == trip_id, Trip.user_id == user.id, Trip.deleted_at.is_(None))
        .options(selectinload(Trip.stops).selectinload(TripStop.place))
    )
    if trip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    return trip


def get_place(db: Session, place_id: uuid.UUID) -> Place:
    place = db.scalar(select(Place).where(Place.id == place_id, published_places()))
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    return place


def clear_plan(trip: Trip) -> None:
    """The stops changed, so the stored order and days are no longer valid."""
    for s in trip.stops:
        s.visit_order = s.day_no = None
    trip.total_days = trip.total_km = None
    trip.updated_at = datetime.now(UTC)


def add_stop(db: Session, trip: Trip, place_id: uuid.UUID, visit_hours: float = 1.5) -> None:
    if any(s.place_id == place_id for s in trip.stops):
        raise HTTPException(status.HTTP_409_CONFLICT, "This place is already in the trip")
    get_place(db, place_id)
    clear_plan(trip)
    trip.stops.append(TripStop(place_id=place_id, visit_hours=Decimal(str(visit_hours))))


def optimise(trip: Trip, start: tuple[float, float] | None, max_hours: float) -> float | None:
    """Nearest neighbour + 2-opt + greedy day split; stores visit_order and day_no.

    Returns the nearest-neighbour length (before 2-opt) for the response."""
    stops = list(trip.stops)
    if not stops:
        clear_plan(trip)
        return None
    points = [(float(s.place.latitude), float(s.place.longitude)) for s in stops]
    plan = plan_trip(points, [float(s.visit_hours) for s in stops], start, max_hours)
    for order, idx in enumerate(plan.order, start=1):
        stops[idx].visit_order = order
    for day in plan.days:
        for idx in day.stops:
            stops[idx].day_no = day.day_no
    trip.total_days = len(plan.days)
    trip.total_km = Decimal(f"{plan.total_km:.1f}")
    trip.updated_at = datetime.now(UTC)
    return plan.nearest_neighbour_km


def _ordered(trip: Trip) -> list[TripStop]:
    return sorted(trip.stops, key=lambda s: (s.visit_order is None, s.visit_order or 0, s.added_at))


def _days(stops: list[TripStop]) -> list[DayOut]:
    """Group the optimised stops by day; km/hours between consecutive stops of a day."""
    if not stops or any(s.day_no is None for s in stops):
        return []
    points = [(float(s.place.latitude), float(s.place.longitude)) for s in stops]
    m = distance_matrix(points)
    days: dict[int, DayOut] = {}
    for k, s in enumerate(stops):
        d = days.setdefault(
            s.day_no, DayOut(day_no=s.day_no, stop_ids=[], km=0, travel_hours=0, visit_hours=0)
        )
        if d.stop_ids:  # travel from the previous stop of the same day
            d.km += m[k - 1][k]
            d.travel_hours += travel_hours(m[k - 1][k])
        d.stop_ids.append(s.id)
        d.visit_hours += float(s.visit_hours)
    for d in days.values():
        d.km, d.travel_hours = round(d.km, 1), round(d.travel_hours, 2)
    return [days[k] for k in sorted(days)]


def trip_summary(trip: Trip) -> TripSummary:
    return TripSummary(
        id=trip.id,
        title=trip.title,
        start_date=trip.start_date,
        stop_count=len(trip.stops),
        total_days=trip.total_days,
        total_km=float(trip.total_km) if trip.total_km is not None else None,
        updated_at=trip.updated_at,
    )


def trip_detail(db: Session, trip: Trip, lang: Lang, nn_km: float | None = None) -> TripDetail:
    stops = _ordered(trip)
    thumbs = thumbnails(db, [s.place_id for s in stops])
    return TripDetail(
        **trip_summary(trip).model_dump(),
        is_optimised=bool(stops) and all(s.visit_order is not None for s in stops),
        stops=[
            StopOut(
                id=s.id,
                place=place_summary(s.place, lang, thumbs.get(s.place_id)),
                visit_order=s.visit_order,
                day_no=s.day_no,
                visit_hours=float(s.visit_hours),
            )
            for s in stops
        ],
        days=_days(stops),
        nearest_neighbour_km=round(nn_km, 1) if nn_km is not None else None,
    )
