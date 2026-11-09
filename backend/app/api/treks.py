import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_optional_user
from app.core.db import get_db
from app.core.i18n import get_lang, pick
from app.models import Review, Teahouse, Trek, TrekStage, TrekTranslation, User
from app.models.enums import Lang, RiskLevel
from app.schemas.community import BudgetOut
from app.schemas.content import Page, PermitOut, TrekDetail, TrekSummary
from app.schemas.risk import AcclimatisationOut, ItineraryOut
from app.services.budget import load_trek_with_permits, trek_budget
from app.services.content import localised_name_order, place_ref, published_treks, trek_summary
from app.services.itinerary import (
    acclimatisation,
    acclimatisation_out,
    itinerary_out,
    load_trek,
    stage_facts,
)
from app.services.rating import rating_order, ratings

router = APIRouter(prefix="/treks", tags=["treks"])


@router.get("", response_model=Page[TrekSummary])
def list_treks(
    region: str | None = Query(None, description="e.g. Annapurna, Khumbu, Langtang"),
    min_days: int | None = Query(None, ge=1),
    max_days: int | None = Query(None, ge=1),
    difficulty: RiskLevel | None = None,
    sort: Literal["name", "rating"] = Query("name", description="rating = Bayesian average"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> Page[TrekSummary]:
    stmt, order_by = localised_name_order(Trek, TrekTranslation, "trek_id", lang)
    stmt = stmt.where(published_treks())
    if region:
        stmt = stmt.where(func.lower(Trek.region) == region.lower())
    if min_days is not None:
        stmt = stmt.where(Trek.total_days >= min_days)
    if max_days is not None:
        stmt = stmt.where(Trek.total_days <= max_days)
    if difficulty is not None:
        stmt = stmt.where(Trek.base_difficulty == difficulty)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = [order_by, Trek.id]
    if sort == "rating":
        agg, score = rating_order(db, Review.trek_id)
        stmt = stmt.outerjoin(agg, agg.c.item_id == Trek.id)
        order = [score.desc(), *order]
    rows = db.scalars(stmt.order_by(*order).offset((page - 1) * page_size).limit(page_size)).all()
    rated = ratings(db, Review.trek_id, [t.id for t in rows])
    return Page[TrekSummary](
        items=[trek_summary(t, lang, rated[t.id]) for t in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/regions", response_model=list[str])
def list_regions(db: Session = Depends(get_db)) -> list[str]:
    return list(
        db.scalars(select(Trek.region).where(published_treks()).distinct().order_by(Trek.region))
    )


@router.get("/{trek_id}", response_model=TrekDetail)
def get_trek(
    trek_id: uuid.UUID, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> TrekDetail:
    trek = db.scalar(
        select(Trek)
        .where(Trek.id == trek_id, published_treks())
        .options(
            selectinload(Trek.permits),
            selectinload(Trek.stages).selectinload(TrekStage.from_place),
            selectinload(Trek.stages).selectinload(TrekStage.to_place),
        )
    )
    if trek is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trek not found")

    # Start/end are not stored: they come from the first and last stage.
    first = trek.stages[0] if trek.stages else None
    last = trek.stages[-1] if trek.stages else None
    permits = []
    for p in sorted(trek.permits, key=lambda p: p.code):
        t = pick(p.translations, lang, "name", "description")
        permits.append(
            PermitOut(
                code=p.code,
                name=t["name"],
                description=t["description"],
                fee_nepali_npr=p.fee_nepali_npr,
                fee_saarc_npr=p.fee_saarc_npr,
                fee_foreign_npr=p.fee_foreign_npr,
            )
        )
    rating = ratings(db, Review.trek_id, [trek.id])[trek.id]
    return TrekDetail(
        **trek_summary(trek, lang, rating).model_dump(),
        overview=pick(trek.translations, lang, "overview")["overview"],
        permits=permits,
        start_place=place_ref(first.from_place, lang) if first else None,
        end_place=place_ref(last.to_place, lang) if last else None,
        stage_count=len(trek.stages),
    )


@router.get("/{trek_id}/stages", response_model=ItineraryOut)
def get_stages(
    trek_id: uuid.UUID, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> ItineraryOut:
    """Day-by-day itinerary (sleeping altitude, gain, distance, hours) and the trek summary
    computed from it (start, end, days, max altitude, max daily gain)."""
    trek = load_trek(db, trek_id)
    sleep_places = {s.to_place_id for s in trek.stages}
    counts = dict(
        db.execute(
            select(Teahouse.place_id, func.count())
            .where(Teahouse.place_id.in_(sleep_places), Teahouse.deleted_at.is_(None))
            .group_by(Teahouse.place_id)
        ).all()
    )
    return itinerary_out(trek, lang, counts)


@router.get("/{trek_id}/acclimatisation", response_model=AcclimatisationOut)
def get_acclimatisation(
    trek_id: uuid.UUID, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> AcclimatisationOut:
    """Rule-based acclimatisation check: per-day ok / caution / danger and suggested rest days."""
    return acclimatisation_out(acclimatisation(stage_facts(load_trek(db, trek_id), lang)))


@router.get("/{trek_id}/budget", response_model=BudgetOut)
def get_trek_budget(
    trek_id: uuid.UUID,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> BudgetOut:
    """Estimated cost per person: teahouse food + stay per day, permits at your nationality's
    rate, and transport to the trailhead. Uses your profile's budget level and nationality."""
    trek = load_trek_with_permits(db, trek_id)
    return trek_budget(db, trek, user.profile if user else None, lang)
