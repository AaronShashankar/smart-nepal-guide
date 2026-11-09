import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.algorithms.best_time import MonthClimate, best_months
from app.algorithms.geo_box import bounding_box
from app.algorithms.haversine import haversine_km, nearest
from app.core.db import get_db
from app.core.i18n import get_lang, pick, pick_one
from app.models import Category, Place, PlaceAlias, PlaceTranslation, Review, Teahouse
from app.models.enums import Lang
from app.schemas.community import NearPlaceOut, TeahouseOut
from app.schemas.content import NearbyPlace, Page, PhotoOut, PlaceDetail, PlaceSummary
from app.services.content import (
    category_out,
    localised_name_order,
    place_summary,
    published_places,
    thumbnails,
)
from app.services.rating import rating_order, ratings

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
    sort: Literal["name", "rating"] = Query("name", description="rating = Bayesian average"),
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
    order = [order_by, Place.id]
    if sort == "rating":
        agg, score = rating_order(db, Review.place_id)
        stmt = stmt.outerjoin(agg, agg.c.item_id == Place.id)
        order = [score.desc(), *order]
    rows = db.scalars(stmt.order_by(*order).offset((page - 1) * page_size).limit(page_size)).all()
    ids = [p.id for p in rows]
    thumbs = thumbnails(db, ids)
    rated = ratings(db, Review.place_id, ids)
    return Page[PlaceSummary](
        items=[place_summary(p, lang, thumbs.get(p.id), rated[p.id]) for p in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


MAX_NEAR_RADIUS_KM = 200


@router.get("/near", response_model=list[NearPlaceOut])
def near_me(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: float = Query(20, gt=0, le=MAX_NEAR_RADIUS_KM),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> list[NearPlaceOut]:
    """Places closest to the phone: bounding box in SQL (indexed), then exact Haversine, then
    sort. The box is a square around the circle, so the Haversine step drops its corners."""
    min_lat, min_lng, max_lat, max_lng = bounding_box(lat, lng, radius_km)
    candidates = db.scalars(
        select(Place).where(
            published_places(),
            Place.latitude.between(min_lat, max_lat),
            Place.longitude.between(min_lng, max_lng),
        )
    ).all()
    within = [
        (p, d)
        for p in candidates
        if (d := haversine_km(lat, lng, float(p.latitude), float(p.longitude))) <= radius_km
    ]
    within.sort(key=lambda pair: (pair[1], str(pair[0].id)))
    within = within[:limit]
    ids = [p.id for p, _ in within]
    thumbs, rated = thumbnails(db, ids), ratings(db, Review.place_id, ids)
    return [
        NearPlaceOut(
            **place_summary(p, lang, thumbs.get(p.id), rated[p.id]).model_dump(),
            distance_km=round(d, 1),
        )
        for p, d in within
    ]


@router.get("/{place_id}/teahouses", response_model=list[TeahouseOut])
def place_teahouses(
    place_id: uuid.UUID, db: Session = Depends(get_db), lang: Lang = Depends(get_lang)
) -> list[TeahouseOut]:
    """Lodges in this village (V2 Phase 2). Real entries only, see data/teahouses.csv."""
    if db.scalar(select(Place.id).where(Place.id == place_id, published_places())) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    rows = db.scalars(
        select(Teahouse).where(Teahouse.place_id == place_id, Teahouse.deleted_at.is_(None))
    ).all()
    out = [
        TeahouseOut(
            id=t.id,
            phone=t.phone,
            has_wifi=t.has_wifi,
            has_hot_shower=t.has_hot_shower,
            updated_at=t.updated_at,
            **pick(t.translations, lang, "name", "price_note"),
        )
        for t in rows
    ]
    return sorted(out, key=lambda t: t.name.casefold())


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

    rating = ratings(db, Review.place_id, [place.id])[place.id]
    summary = place_summary(place, lang, place.photos[0].url if place.photos else None, rating)
    return PlaceDetail(
        **summary.model_dump(),
        entry_fee_saarc_npr=place.entry_fee_saarc_npr,
        entry_fee_nepali_npr=place.entry_fee_nepali_npr,
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
