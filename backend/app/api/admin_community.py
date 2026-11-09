"""Admin API for Version 2 Phase 2 data: budget rates and teahouses (admins only)."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_admin
from app.core.db import get_db
from app.models import BudgetRate, Place, Teahouse, TeahouseTranslation
from app.models.enums import BudgetLevel, Lang
from app.schemas.admin import BudgetRateAdmin, TeahouseAdminIn, TeahouseAdminOut
from app.services.admin import _by_lang, _clean, not_found

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

LEVEL_ORDER = {BudgetLevel.low: 0, BudgetLevel.medium: 1, BudgetLevel.high: 2}


# -------------------------------------------------------------- budget rates
def rate_out(r: BudgetRate) -> BudgetRateAdmin:
    return BudgetRateAdmin(
        budget_level=r.budget_level,
        region=r.region,
        food_per_day_npr=r.food_per_day_npr,
        stay_per_day_npr=r.stay_per_day_npr,
        transport_per_km_npr=(
            float(r.transport_per_km_npr) if r.transport_per_km_npr is not None else None
        ),
        trailhead_transport_npr=r.trailhead_transport_npr,
    )


@router.get("/budget-rates", response_model=list[BudgetRateAdmin])
def list_budget_rates(db: Session = Depends(get_db)) -> list[BudgetRateAdmin]:
    rows = db.scalars(select(BudgetRate)).all()
    rows = sorted(rows, key=lambda r: (r.region != "city", r.region, LEVEL_ORDER[r.budget_level]))
    return [rate_out(r) for r in rows]


@router.put("/budget-rates", response_model=BudgetRateAdmin)
def save_budget_rate(body: BudgetRateAdmin, db: Session = Depends(get_db)) -> BudgetRateAdmin:
    """Create or update the row for (budget_level, region)."""
    region = body.region.strip()
    rate = db.get(BudgetRate, (body.budget_level, region))
    if rate is None:
        rate = BudgetRate(budget_level=body.budget_level, region=region)
        db.add(rate)
    rate.food_per_day_npr = body.food_per_day_npr
    rate.stay_per_day_npr = body.stay_per_day_npr
    rate.transport_per_km_npr = (
        Decimal(str(body.transport_per_km_npr)) if body.transport_per_km_npr is not None else None
    )
    rate.trailhead_transport_npr = body.trailhead_transport_npr
    db.commit()
    return rate_out(rate)


# ----------------------------------------------------------------- teahouses
def teahouse_out(t: Teahouse) -> TeahouseAdminOut:
    tr = _by_lang(t.translations)
    en, ne = tr.get(Lang.en), tr.get(Lang.ne)
    place_en = next((x.name for x in t.place.translations if x.lang == Lang.en), "?")
    return TeahouseAdminOut(
        id=t.id,
        place_id=t.place_id,
        place_name=place_en,
        name_en=en.name if en else "?",
        name_ne=ne.name if ne else None,
        phone=t.phone,
        price_note_en=en.price_note if en else None,
        price_note_ne=ne.price_note if ne else None,
        has_wifi=t.has_wifi,
        has_hot_shower=t.has_hot_shower,
        source=t.source or "",
        updated_at=t.updated_at,
    )


def _save_teahouse(db: Session, t: Teahouse, body: TeahouseAdminIn) -> None:
    place = db.get(Place, body.place_id)
    if place is None or place.deleted_at is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown place")
    t.place_id, t.place = place.id, place
    t.phone = _clean(body.phone)
    t.has_wifi, t.has_hot_shower = body.has_wifi, body.has_hot_shower
    t.source = body.source.strip()
    t.updated_at = datetime.now(UTC)
    t.translations = [
        TeahouseTranslation(
            lang=Lang.en, name=body.name_en.strip(), price_note=_clean(body.price_note_en)
        )
    ]
    if _clean(body.name_ne) or _clean(body.price_note_ne):
        t.translations.append(
            TeahouseTranslation(
                lang=Lang.ne,
                name=_clean(body.name_ne) or body.name_en.strip(),
                price_note=_clean(body.price_note_ne),
            )
        )


def _live(db: Session, teahouse_id: uuid.UUID) -> Teahouse:
    t = db.get(Teahouse, teahouse_id)
    if t is None or t.deleted_at is not None:
        raise not_found("Teahouse")
    return t


@router.get("/teahouses", response_model=list[TeahouseAdminOut])
def list_teahouses(
    place_id: uuid.UUID | None = Query(None), db: Session = Depends(get_db)
) -> list[TeahouseAdminOut]:
    stmt = (
        select(Teahouse)
        .where(Teahouse.deleted_at.is_(None))
        .options(selectinload(Teahouse.place).selectinload(Place.translations))
    )
    if place_id:
        stmt = stmt.where(Teahouse.place_id == place_id)
    out = [teahouse_out(t) for t in db.scalars(stmt)]
    return sorted(out, key=lambda t: (t.place_name, t.name_en))


@router.post("/teahouses", response_model=TeahouseAdminOut, status_code=201)
def create_teahouse(body: TeahouseAdminIn, db: Session = Depends(get_db)) -> TeahouseAdminOut:
    t = Teahouse()
    _save_teahouse(db, t, body)
    db.add(t)
    db.commit()
    return teahouse_out(t)


@router.put("/teahouses/{teahouse_id}", response_model=TeahouseAdminOut)
def update_teahouse(
    teahouse_id: uuid.UUID, body: TeahouseAdminIn, db: Session = Depends(get_db)
) -> TeahouseAdminOut:
    t = _live(db, teahouse_id)
    _save_teahouse(db, t, body)
    db.commit()
    return teahouse_out(t)


@router.delete("/teahouses/{teahouse_id}", status_code=204)
def delete_teahouse(teahouse_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    """Soft delete, so offline copies (V2 Phase 3) learn that it is gone."""
    t = _live(db, teahouse_id)
    t.deleted_at = t.updated_at = datetime.now(UTC)
    db.commit()
    return Response(status_code=204)
