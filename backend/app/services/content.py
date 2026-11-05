"""Turn ORM rows into localised API objects (one place for the fallback rule)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.core.i18n import pick, pick_one
from app.models import Category, Place, PlaceTranslation, Trek, TrekTranslation
from app.models.enums import Lang
from app.schemas.content import CategoryOut, PlaceRef, PlaceSummary, TrekSummary

NAME_COLLATION = "und-x-icu"


def category_out(category: Category, lang: Lang) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        code=category.code,
        icon=category.icon,
        name=pick_one(category.translations, lang),
    )


def place_summary(place: Place, lang: Lang, thumbnail_url: str | None = None) -> PlaceSummary:
    return PlaceSummary(
        id=place.id,
        name=pick_one(place.translations, lang),
        category=category_out(place.category, lang),
        latitude=float(place.latitude),
        longitude=float(place.longitude),
        altitude_m=place.altitude_m,
        district=place.district,
        province=place.province,
        entry_fee_npr=place.entry_fee_npr,
        thumbnail_url=thumbnail_url,
    )


def place_ref(place: Place, lang: Lang) -> PlaceRef:
    return PlaceRef(
        id=place.id,
        name=pick_one(place.translations, lang),
        altitude_m=place.altitude_m,
        latitude=float(place.latitude),
        longitude=float(place.longitude),
    )


def trek_summary(trek: Trek, lang: Lang) -> TrekSummary:
    t = pick(trek.translations, lang, "name")
    return TrekSummary(
        id=trek.id,
        name=t["name"],
        region=trek.region,
        total_days=trek.total_days,
        total_distance_km=float(trek.total_distance_km) if trek.total_distance_km else None,
        max_altitude_m=trek.max_altitude_m,
        base_difficulty=trek.base_difficulty,
    )


def localised_name_order(model, translation_model, fk_column: str, lang: Lang):
    """(outer-joined select, ORDER BY expression) sorting rows by their localised name."""
    wanted = aliased(translation_model)
    english = aliased(translation_model)
    stmt = (
        select(model)
        .outerjoin(
            wanted,
            (getattr(wanted, fk_column) == model.id) & (wanted.lang == lang),
        )
        .outerjoin(
            english,
            (getattr(english, fk_column) == model.id) & (english.lang == Lang.en),
        )
    )
    # ICU root collation sorts both Latin and Devanagari correctly on every OS.
    return stmt, func.coalesce(wanted.name, english.name).collate(NAME_COLLATION)


def published_places():
    return Place.is_published.is_(True) & Place.deleted_at.is_(None)


def published_treks():
    return Trek.is_published.is_(True) & Trek.deleted_at.is_(None)


def thumbnails(db: Session, place_ids: list) -> dict:
    """First photo URL per place, in one query."""
    from sqlalchemy.dialects.postgresql import distinct_on

    from app.models import PlacePhoto

    if not place_ids:
        return {}
    rows = db.execute(
        select(PlacePhoto.place_id, PlacePhoto.url)
        .where(PlacePhoto.place_id.in_(place_ids))
        .order_by(PlacePhoto.place_id, PlacePhoto.sort_order)
        .ext(distinct_on(PlacePhoto.place_id))
    ).all()
    return {pid: url for pid, url in rows}


__all__ = [
    "PlaceTranslation",
    "TrekTranslation",
    "category_out",
    "localised_name_order",
    "place_ref",
    "place_summary",
    "published_places",
    "published_treks",
    "thumbnails",
    "trek_summary",
]
