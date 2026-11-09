"""Budget estimate: a formula over seeded rates (algorithm.md, V2 Phase 2). Estimate only.

Trip = days × (food + stay)[budget level, city]
     + total_km × transport rate[budget level, city]
     + Σ entry fees of the stops [nationality]

Trek = days × (teahouse food + stay)[budget level, region]
     + Σ permits [nationality]
     + transport Kathmandu ↔ trailhead [budget level, region]

Everything is per person, in NPR. No budget level in the profile -> medium; no nationality ->
foreign. An empty fee (null) means that group does not pay.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.i18n import pick_one
from app.models import BudgetRate, Permit, Place, TravellerProfile, Trek, Trip
from app.models.community import CITY_REGION, OTHER_REGION
from app.models.enums import BudgetLevel, Lang, Nationality
from app.schemas.community import BudgetLine, BudgetOut
from app.services.content import published_treks

DEFAULT_LEVEL = BudgetLevel.medium


def profile_choice(profile: TravellerProfile | None) -> tuple[BudgetLevel, Nationality]:
    level = (profile.budget_level if profile else None) or DEFAULT_LEVEL
    nationality = profile.nationality if profile else Nationality.foreign
    return level, nationality


def place_fee(place: Place, nationality: Nationality) -> int | None:
    return {
        Nationality.foreign: place.entry_fee_npr,
        Nationality.saarc: place.entry_fee_saarc_npr,
        Nationality.nepali: place.entry_fee_nepali_npr,
    }[nationality]


def permit_fee(permit: Permit, nationality: Nationality) -> int | None:
    return {
        Nationality.foreign: permit.fee_foreign_npr,
        Nationality.saarc: permit.fee_saarc_npr,
        Nationality.nepali: permit.fee_nepali_npr,
    }[nationality]


def get_rate(db: Session, level: BudgetLevel, region: str) -> tuple[BudgetRate, str]:
    """The rate row for this region, or the "other" row for a region we have no data for."""
    for name in (region, OTHER_REGION):
        rate = db.get(BudgetRate, (level, name))
        if rate is not None:
            return rate, name
    raise HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        {"code": "NO_BUDGET_RATES", "message": "Budget rates are missing: run app.seed."},
    )


def _line(code: str, qty: float, rate: float, label: str | None = None) -> BudgetLine:
    return BudgetLine(code=code, label=label, qty=qty, rate=rate, amount=round(qty * rate))


def _daily(days: int, rate: BudgetRate) -> list[BudgetLine]:
    return [
        _line("FOOD", days, rate.food_per_day_npr),
        _line("STAY", days, rate.stay_per_day_npr),
    ]


def trip_budget(db: Session, trip: Trip, profile: TravellerProfile | None, lang: Lang) -> BudgetOut:
    if not trip.stops or trip.total_days is None or any(s.visit_order is None for s in trip.stops):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "code": "NOT_OPTIMISED",
                "message": "Optimise the trip first, so that its days and km are known.",
            },
        )
    level, nationality = profile_choice(profile)
    rate, region = get_rate(db, level, CITY_REGION)
    km = float(trip.total_km or 0)
    lines = _daily(trip.total_days, rate)
    lines.append(_line("TRANSPORT", round(km, 1), float(rate.transport_per_km_npr or 0)))
    for stop in sorted(trip.stops, key=lambda s: s.visit_order):
        fee = place_fee(stop.place, nationality)
        if fee:
            lines.append(_line("ENTRY_FEE", 1, fee, pick_one(stop.place.translations, lang)))
    return BudgetOut(
        total_npr=sum(line.amount for line in lines),
        budget_level=level,
        nationality=nationality,
        region=region,
        days=trip.total_days,
        lines=lines,
    )


def trek_budget(db: Session, trek: Trek, profile: TravellerProfile | None, lang: Lang) -> BudgetOut:
    level, nationality = profile_choice(profile)
    rate, region = get_rate(db, level, trek.region)
    lines = _daily(trek.total_days, rate)
    for permit in sorted(trek.permits, key=lambda p: p.code):
        fee = permit_fee(permit, nationality)
        if fee:
            lines.append(_line("PERMIT", 1, fee, pick_one(permit.translations, lang)))
    if rate.trailhead_transport_npr:
        lines.append(_line("TRAILHEAD_TRANSPORT", 1, rate.trailhead_transport_npr))
    return BudgetOut(
        total_npr=sum(line.amount for line in lines),
        budget_level=level,
        nationality=nationality,
        region=region,
        days=trek.total_days,
        lines=lines,
    )


def load_trek_with_permits(db: Session, trek_id) -> Trek:
    trek = db.scalar(
        select(Trek)
        .where(Trek.id == trek_id, published_treks())
        .options(selectinload(Trek.permits))
    )
    if trek is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trek not found")
    return trek
