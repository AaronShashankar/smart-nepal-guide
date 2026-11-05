import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.algorithms.best_time import MonthClimate, best_months
from app.algorithms.haversine import nearest
from app.core.db import get_db
from app.core.i18n import get_lang, pick, pick_one
from app.models import Category, Place, PlaceAlias, PlaceTranslation
from app.models.enums import Lang
from app.schemas.content import NearbyPlace, Page, PhotoOut, PlaceDetail, PlaceSummary
from app.services.content import (
    category_out,
    localised_name_order,
    place_summary,
    published_places,
    thumbnails,
)

router = APIRouter(prefix="/places", tags=["places"])

NEARBY_COUNT = 5


@router.get("", response_model=Page[PlaceSummary])
def list_places(
    category: str | None = Query(None, description="category code, e.g. temple"),
    district: str | None = None,
    province: str | None = None,
    q: str | None = Query(None, min_length=1, max_length=100, description="name contains"),
    min_lat: float | None = Query(None, ge=-90, le=90),
    min_lng: float | None = Query(None, ge=-180, le=180),
    max_lat: float | None = Query(None, ge=-90, le=90),
    max_lng: float | None = Query(None, ge=-180, le=180),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> Page[PlaceSummary]:
    stmt, order_by = localised_name_order(Place, PlaceTranslation, "place_id", lang)
    stmt = stmt.where(published_places())

    if category:
        stmt = stmt.join(Category, Place.category_id == Category.id).where(
            Category.code == category
        )
    if district:
        stmt = stmt.where(func.lower(Place.district) == district.lower())
    if province:
        stmt = stmt.where(func.lower(Place.province) == province.lower())
    if q:
        pattern = f"%{q.replace('%', r'\%').replace('_', r'\_')}%"
        name_hit = select(PlaceTranslation.place_id).where(PlaceTranslation.name.ilike(pattern))
        alias_hit = select(PlaceAlias.place_id).where(PlaceAlias.alias.ilike(pattern))
        stmt = stmt.where(or_(Place.id.in_(name_hit), Place.id.in_(alias_hit)))

    bbox = (min_lat, min_lng, max_lat, max_lng)
    if any(v is not None for v in bbox):
        if any(v is None for v in bbox):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Bounding box needs min_lat, min_lng, max_lat and max_lng",
            )
        stmt = stmt.where(
            Place.latitude.between(min_lat, max_lat), Place.longitude.between(min_lng, max_lng)
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(order_by, Place.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    thumbs = thumbnails(db, [p.id for p in rows])
    return Page[PlaceSummary](
        items=[place_summary(p, lang, thumbs.get(p.id)) for p in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{place_id}", response_model=PlaceDetail)
def get_place(
    place_id: uuid.UUID, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> PlaceDetail:
    place = db.scalar(
        select(Place)
        .where(Place.id == place_id, published_places())
        .options(selectinload(Place.photos), selectinload(Place.climate))
    )
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")

    text = pick(place.translations, lang, "description", "how_to_reach")
    climate = [
        MonthClimate(
            c.month,
            float(c.avg_temp_c) if c.avg_temp_c is not None else None,
            c.rainfall_mm,
            c.visibility_score,
        )
        for c in place.climate
    ]

    # Nearby: Haversine distance to every other published place, closest 5.
    others = db.scalars(select(Place).where(published_places(), Place.id != place.id)).all()
    closest = nearest(
        (float(place.latitude), float(place.longitude)),
        ((p, float(p.latitude), float(p.longitude)) for p in others),
        k=NEARBY_COUNT,
    )

    summary = place_summary(place, lang, place.photos[0].url if place.photos else None)
    return PlaceDetail(
        **summary.model_dump(),
        description=text["description"],
        how_to_reach=text["how_to_reach"],
        photos=[PhotoOut(url=p.url, sort_order=p.sort_order) for p in place.photos],
        best_months=best_months(climate),
        nearby=[
            NearbyPlace(
                id=p.id,
                name=pick_one(p.translations, lang),
                category=category_out(p.category, lang),
                distance_km=round(d, 1),
            )
            for p, d in closest
        ],
    )
