"""Itinerary maths shared by the API, the acclimatisation checker and the ML features.

Sleeping altitude = the altitude of the stage's `to` place. Night 0 is spent at the first
stage's `from` place. A rest day is a stage whose `from` and `to` are the same place.
"""

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.algorithms.acclimatisation import (
    ACCLIMATISATION_START_M,
    AcclimatisationReport,
    StageAltitude,
    check_acclimatisation,
)
from app.core.i18n import pick, pick_one
from app.models import Trek, TrekStage
from app.models.enums import Lang
from app.schemas.risk import (
    AcclimatisationOut,
    DayCheckOut,
    ItineraryOut,
    ItinerarySummary,
    RestSuggestionOut,
    StageOut,
)
from app.services.content import place_ref, published_treks


@dataclass
class StageFacts:
    """Plain numbers for one stage; built from ORM rows or from treks.json."""

    day: int
    from_key: str
    to_key: str
    from_name: str
    to_name: str
    from_altitude_m: int
    to_altitude_m: int
    distance_km: float
    walk_hours: float
    highest_point_m: int | None = None

    @property
    def is_rest_day(self) -> bool:
        return self.from_key == self.to_key

    @property
    def gain_m(self) -> int:
        return self.to_altitude_m - self.from_altitude_m


@dataclass
class TrekFacts:
    """Trek summary computed from the stages (also the trek half of the ML feature vector)."""

    total_days: int
    total_distance_km: float
    max_altitude_m: int  # highest point reached, including day-trip viewpoints
    max_sleep_altitude_m: int  # highest place slept at (ML feature `max_altitude_m`)
    max_daily_gain_m: int  # biggest one-day sleeping gain ending above 3,000 m (0 if none)
    max_daily_gain_day: int | None
    distance_per_day_km: float
    rest_days: int


def trek_facts(stages: list[StageFacts]) -> TrekFacts:
    if not stages:
        return TrekFacts(0, 0.0, 0, 0, 0, None, 0.0, 0)
    sleeps = [stages[0].from_altitude_m] + [s.to_altitude_m for s in stages]
    highest = [s.highest_point_m or 0 for s in stages]
    gains = [
        (s.gain_m, s.day)
        for s in stages
        if not s.is_rest_day and s.to_altitude_m > ACCLIMATISATION_START_M
    ]
    max_gain, max_gain_day = max(gains, default=(0, None))
    total_km = sum(s.distance_km for s in stages)
    return TrekFacts(
        total_days=len(stages),
        total_distance_km=round(total_km, 1),
        max_altitude_m=max(sleeps + highest),
        max_sleep_altitude_m=max(sleeps),
        max_daily_gain_m=max(max_gain, 0),
        max_daily_gain_day=max_gain_day if max_gain > 0 else None,
        distance_per_day_km=round(total_km / len(stages), 2),
        rest_days=sum(s.is_rest_day for s in stages),
    )


def acclimatisation(stages: list[StageFacts]) -> AcclimatisationReport:
    return check_acclimatisation(
        [
            StageAltitude(
                day=s.day,
                from_altitude_m=s.from_altitude_m,
                to_altitude_m=s.to_altitude_m,
                is_rest_day=s.is_rest_day,
                from_name=s.from_name,
            )
            for s in stages
        ]
    )


# ------------------------------------------------------------ database / API
def load_trek(db: Session, trek_id: uuid.UUID) -> Trek:
    """A published trek with its stages and their places, or 404."""
    trek = db.scalar(
        select(Trek)
        .where(Trek.id == trek_id, published_treks())
        .options(
            selectinload(Trek.stages).selectinload(TrekStage.from_place),
            selectinload(Trek.stages).selectinload(TrekStage.to_place),
        )
    )
    if trek is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trek not found")
    return trek


def stage_facts(trek: Trek, lang: Lang) -> list[StageFacts]:
    return [
        StageFacts(
            day=s.day_no,
            from_key=str(s.from_place_id),
            to_key=str(s.to_place_id),
            from_name=pick_one(s.from_place.translations, lang),
            to_name=pick_one(s.to_place.translations, lang),
            from_altitude_m=s.from_place.altitude_m or 0,
            to_altitude_m=s.to_place.altitude_m or 0,
            distance_km=float(s.distance_km or 0),
            walk_hours=float(s.walk_hours or 0),
            highest_point_m=s.highest_point_m,
        )
        for s in trek.stages
    ]


def itinerary_out(trek: Trek, lang: Lang) -> ItineraryOut:
    facts = stage_facts(trek, lang)
    summary = trek_facts(facts)
    stages = [
        StageOut(
            day=s.day_no,
            from_place=place_ref(s.from_place, lang),
            to_place=place_ref(s.to_place, lang),
            sleep_altitude_m=f.to_altitude_m,
            gain_m=f.gain_m,
            distance_km=f.distance_km,
            walk_hours=f.walk_hours,
            highest_point_m=s.highest_point_m,
            is_rest_day=f.is_rest_day,
            notes=pick(s.translations, lang, "notes")["notes"],
        )
        for s, f in zip(trek.stages, facts, strict=True)
    ]
    return ItineraryOut(
        summary=ItinerarySummary(
            start_place=stages[0].from_place if stages else None,
            end_place=stages[-1].to_place if stages else None,
            total_days=summary.total_days,
            total_distance_km=summary.total_distance_km,
            max_altitude_m=summary.max_altitude_m,
            max_sleep_altitude_m=summary.max_sleep_altitude_m,
            max_daily_gain_m=summary.max_daily_gain_m,
            max_daily_gain_day=summary.max_daily_gain_day,
            rest_days=summary.rest_days,
        ),
        stages=stages,
    )


def acclimatisation_out(report: AcclimatisationReport) -> AcclimatisationOut:
    return AcclimatisationOut(
        status=report.status,
        passes=report.passes,
        days=[
            DayCheckOut(day=d.day, status=d.status, gain_m=d.gain_m, codes=d.codes)
            for d in report.days
        ],
        suggested_rest_days=[
            RestSuggestionOut(before_day=r.before_day, place=r.place, altitude_m=r.altitude_m)
            for r in report.suggested_rest_days
        ],
    )
