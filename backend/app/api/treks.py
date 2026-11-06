import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.i18n import get_lang, pick
from app.models import Trek, TrekStage, TrekTranslation
from app.models.enums import Lang, RiskLevel
from app.schemas.content import Page, PermitOut, TrekDetail, TrekSummary
from app.schemas.risk import AcclimatisationOut, ItineraryOut
from app.services.content import localised_name_order, place_ref, published_treks, trek_summary
from app.services.itinerary import (
    acclimatisation,
    acclimatisation_out,
    itinerary_out,
    load_trek,
    stage_facts,
)

router = APIRouter(prefix="/treks", tags=["treks"])


@router.get("", response_model=Page[TrekSummary])
def list_treks(
    region: str | None = Query(None, description="e.g. Annapurna, Khumbu, Langtang"),
    min_days: int | None = Query(None, ge=1),
    max_days: int | None = Query(None, ge=1),
    difficulty: RiskLevel | None = None,
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
    rows = db.scalars(
        stmt.order_by(order_by, Trek.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Page[TrekSummary](
        items=[trek_summary(t, lang) for t in rows], total=total, page=page, page_size=page_size
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
    return TrekDetail(
        **trek_summary(trek, lang).model_dump(),
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
    return itinerary_out(load_trek(db, trek_id), lang)


@router.get("/{trek_id}/acclimatisation", response_model=AcclimatisationOut)
def get_acclimatisation(
    trek_id: uuid.UUID, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> AcclimatisationOut:
    """Rule-based acclimatisation check: per-day ok / caution / danger and suggested rest days."""
    return acclimatisation_out(acclimatisation(stage_facts(load_trek(db, trek_id), lang)))
