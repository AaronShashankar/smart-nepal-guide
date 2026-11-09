"""Read-only shared trips (V2 Phase 2). The token is the only key: 128 random bits."""

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models import Trip, TripStop
from app.models.enums import Lang
from app.schemas.community import SharedTripOut, ShareOut
from app.services.trips import trip_detail

APP_SCHEME = "smartnepalguide"  # the app's URL scheme (app.json); kept from Version 1


def share_links(request: Request, token: str) -> ShareOut:
    base = get_settings().public_base_url.rstrip("/") or str(request.base_url).rstrip("/")
    return ShareOut(token=token, url=f"{base}/s/{token}", app_url=f"{APP_SCHEME}://shared/{token}")


def trip_by_token(db: Session, token: str) -> Trip:
    """A wrong token, a stopped share or a deleted trip all give the same 404."""
    trip = db.scalar(
        select(Trip)
        .where(Trip.share_token == token, Trip.deleted_at.is_(None))
        .options(selectinload(Trip.stops).selectinload(TripStop.place))
    )
    if trip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link does not work any more")
    return trip


def shared_trip(db: Session, trip: Trip, lang: Lang) -> SharedTripOut:
    d = trip_detail(db, trip, lang)
    return SharedTripOut(
        title=d.title,
        start_date=d.start_date,
        total_days=d.total_days,
        total_km=d.total_km,
        is_optimised=d.is_optimised,
        stops=d.stops,
        days=d.days,
    )
