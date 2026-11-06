"""Admin content editing: ORM rows <-> the {en, ne} shapes the admin panel uses."""

import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import delete, func, inspect, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Category,
    CategoryTranslation,
    Permit,
    PermitTranslation,
    Place,
    PlaceAlias,
    PlaceClimate,
    PlaceTranslation,
    StageTranslation,
    Trek,
    TrekPermit,
    TrekStage,
    TrekTranslation,
    User,
)
from app.models.enums import Lang
from app.schemas.admin import (
    CategoryAdminIn,
    CategoryAdminOut,
    ClimateRow,
    PermitAdminIn,
    PermitAdminOut,
    PhotoAdminOut,
    PlaceAdminIn,
    PlaceAdminOut,
    PlaceText,
    StageAdmin,
    TrekAdminIn,
    TrekAdminOut,
    TrekText,
)
from app.services.itinerary import StageFacts, trek_facts


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _by_lang(rows) -> dict[Lang, object]:
    return {r.lang: r for r in rows}


def not_found(what: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


# ---------------------------------------------------------------- categories
def category_out(db: Session, c: Category) -> CategoryAdminOut:
    t = _by_lang(c.translations)
    count = db.scalar(
        select(func.count()).where(Place.category_id == c.id, Place.deleted_at.is_(None))
    )
    return CategoryAdminOut(
        id=c.id,
        code=c.code,
        icon=c.icon,
        name_en=t[Lang.en].name if Lang.en in t else c.code,
        name_ne=t[Lang.ne].name if Lang.ne in t else None,
        place_count=count or 0,
    )


def save_category(db: Session, c: Category, body: CategoryAdminIn) -> None:
    clash = db.scalar(select(Category).where(Category.code == body.code, Category.id != c.id))
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Category code '{body.code}' exists")
    c.code, c.icon = body.code, _clean(body.icon)
    c.translations = [CategoryTranslation(lang=Lang.en, name=body.name_en.strip())]
    if _clean(body.name_ne):
        c.translations.append(CategoryTranslation(lang=Lang.ne, name=body.name_ne.strip()))


# -------------------------------------------------------------------- places
def load_place(db: Session, place_id: uuid.UUID) -> Place:
    place = db.scalar(
        select(Place)
        .where(Place.id == place_id, Place.deleted_at.is_(None))
        .options(selectinload(Place.aliases), selectinload(Place.photos),
                 selectinload(Place.climate))
    )  # fmt: skip
    if place is None:
        raise not_found("Place")
    return place


def place_out(p: Place) -> PlaceAdminOut:
    t = _by_lang(p.translations)

    def text(lang: Lang) -> PlaceText:
        row = t.get(lang)
        if row is None:
            return PlaceText()
        return PlaceText(name=row.name, description=row.description, how_to_reach=row.how_to_reach)

    return PlaceAdminOut(
        id=p.id,
        category_code=p.category.code,
        latitude=float(p.latitude),
        longitude=float(p.longitude),
        altitude_m=p.altitude_m,
        district=p.district,
        province=p.province,
        entry_fee_npr=p.entry_fee_npr,
        is_published=p.is_published,
        en=text(Lang.en),
        ne=text(Lang.ne),
        aliases=sorted(a.alias for a in p.aliases),
        climate=[
            ClimateRow(
                month=c.month,
                avg_temp_c=float(c.avg_temp_c) if c.avg_temp_c is not None else None,
                rainfall_mm=c.rainfall_mm,
                visibility_score=c.visibility_score,
            )
            for c in p.climate
        ],
        photos=[PhotoAdminOut(id=ph.id, url=ph.url, sort_order=ph.sort_order) for ph in p.photos],
        updated_at=p.updated_at,
    )


def save_place(db: Session, p: Place, body: PlaceAdminIn, admin: User) -> None:
    category = db.scalar(select(Category).where(Category.code == body.category_code))
    if category is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category")
    months = sorted(c.month for c in body.climate)
    if body.climate and months != list(range(1, 13)):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Climate needs exactly one row per month"
        )
    p.category_id = category.id
    p.category = category
    p.latitude, p.longitude = Decimal(str(body.latitude)), Decimal(str(body.longitude))
    p.altitude_m, p.entry_fee_npr = body.altitude_m, body.entry_fee_npr
    p.district, p.province = _clean(body.district), _clean(body.province)
    p.is_published = body.is_published

    rows = [
        PlaceTranslation(
            lang=Lang.en,
            name=body.en.name.strip(),
            description=_clean(body.en.description),
            how_to_reach=_clean(body.en.how_to_reach),
            is_reviewed=True,
        )
    ]
    if _clean(body.ne.name) or _clean(body.ne.description) or _clean(body.ne.how_to_reach):
        # Saved by an admin, so the Nepali text counts as reviewed.
        rows.append(
            PlaceTranslation(
                lang=Lang.ne,
                name=_clean(body.ne.name) or body.en.name.strip(),
                description=_clean(body.ne.description),
                how_to_reach=_clean(body.ne.how_to_reach),
                is_machine_translated=False,
                is_reviewed=True,
                reviewed_by=admin.id,
            )
        )
    p.translations = rows
    aliases = dict.fromkeys(a.strip() for a in body.aliases if a.strip())
    p.aliases = [PlaceAlias(alias=a) for a in aliases]
    p.climate = [
        PlaceClimate(
            month=c.month,
            avg_temp_c=Decimal(str(c.avg_temp_c)) if c.avg_temp_c is not None else None,
            rainfall_mm=c.rainfall_mm,
            visibility_score=c.visibility_score,
        )
        for c in sorted(body.climate, key=lambda c: c.month)
    ]


def place_in_use(db: Session, place_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(
            select(func.count()).where(
                (TrekStage.from_place_id == place_id) | (TrekStage.to_place_id == place_id)
            )
        )
    )


# ------------------------------------------------------------------- permits
def permit_out(db: Session, p: Permit) -> PermitAdminOut:
    t = _by_lang(p.translations)
    en, ne = t.get(Lang.en), t.get(Lang.ne)
    count = db.scalar(select(func.count()).where(TrekPermit.permit_id == p.id)) or 0
    return PermitAdminOut(
        id=p.id,
        code=p.code,
        fee_nepali_npr=p.fee_nepali_npr,
        fee_saarc_npr=p.fee_saarc_npr,
        fee_foreign_npr=p.fee_foreign_npr,
        name_en=en.name if en else p.code,
        description_en=en.description if en else None,
        name_ne=ne.name if ne else None,
        description_ne=ne.description if ne else None,
        trek_count=count,
    )


def save_permit(db: Session, p: Permit, body: PermitAdminIn) -> None:
    clash = db.scalar(select(Permit).where(Permit.code == body.code, Permit.id != p.id))
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Permit code '{body.code}' exists")
    p.code = body.code
    p.fee_nepali_npr, p.fee_saarc_npr = body.fee_nepali_npr, body.fee_saarc_npr
    p.fee_foreign_npr = body.fee_foreign_npr
    p.translations = [
        PermitTranslation(
            lang=Lang.en, name=body.name_en.strip(), description=_clean(body.description_en)
        )
    ]
    if _clean(body.name_ne):
        p.translations.append(
            PermitTranslation(
                lang=Lang.ne, name=body.name_ne.strip(), description=_clean(body.description_ne)
            )
        )


# --------------------------------------------------------------------- treks
def load_trek(db: Session, trek_id: uuid.UUID) -> Trek:
    trek = db.scalar(
        select(Trek)
        .where(Trek.id == trek_id, Trek.deleted_at.is_(None))
        .options(selectinload(Trek.stages), selectinload(Trek.permits))
    )
    if trek is None:
        raise not_found("Trek")
    return trek


def trek_out(t: Trek) -> TrekAdminOut:
    tr = _by_lang(t.translations)

    def text(lang: Lang) -> TrekText:
        row = tr.get(lang)
        return TrekText(name=row.name, overview=row.overview) if row else TrekText()

    stages = []
    for s in t.stages:
        notes = _by_lang(s.translations)
        stages.append(
            StageAdmin(
                from_place_id=s.from_place_id,
                to_place_id=s.to_place_id,
                distance_km=float(s.distance_km or 0),
                walk_hours=float(s.walk_hours or 0),
                highest_point_m=s.highest_point_m,
                notes_en=notes[Lang.en].notes if Lang.en in notes else None,
                notes_ne=notes[Lang.ne].notes if Lang.ne in notes else None,
            )
        )
    return TrekAdminOut(
        id=t.id,
        region=t.region,
        base_difficulty=t.base_difficulty,
        is_published=t.is_published,
        en=text(Lang.en),
        ne=text(Lang.ne),
        permit_codes=sorted(p.code for p in t.permits),
        stages=stages,
        total_days=t.total_days,
        total_distance_km=float(t.total_distance_km) if t.total_distance_km else None,
        max_altitude_m=t.max_altitude_m,
        updated_at=t.updated_at,
    )


def save_trek(db: Session, t: Trek, body: TrekAdminIn) -> None:
    place_ids = {s.from_place_id for s in body.stages} | {s.to_place_id for s in body.stages}
    places = {
        p.id: p
        for p in db.scalars(
            select(Place).where(Place.id.in_(place_ids), Place.deleted_at.is_(None))
        )
    }
    if missing := place_ids - places.keys():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown places: {sorted(map(str, missing))}"
        )
    codes = set(body.permit_codes)
    permits = list(db.scalars(select(Permit).where(Permit.code.in_(codes)))) if codes else []
    if unknown := codes - {p.code for p in permits}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown permits: {unknown}")

    t.region, t.base_difficulty = body.region.strip(), body.base_difficulty
    t.is_published = body.is_published
    rows = [TrekTranslation(lang=Lang.en, name=body.en.name.strip(),
                            overview=_clean(body.en.overview), is_reviewed=True)]  # fmt: skip
    if _clean(body.ne.name) or _clean(body.ne.overview):
        rows.append(
            TrekTranslation(
                lang=Lang.ne,
                name=_clean(body.ne.name) or body.en.name.strip(),
                overview=_clean(body.ne.overview),
                is_machine_translated=False,
                is_reviewed=True,
            )
        )
    t.translations = rows
    t.permits = permits

    # Replace all stages (day numbers = list order) and recompute the stored totals,
    # the same way the seed loader does.
    if inspect(t).persistent:  # editing an existing trek: drop its old stages first
        db.execute(delete(TrekStage).where(TrekStage.trek_id == t.id))
        db.flush()
        db.expire(t, ["stages"])
    stages = []
    for day, s in enumerate(body.stages, start=1):
        stage = TrekStage(
            day_no=day,
            from_place_id=s.from_place_id,
            to_place_id=s.to_place_id,
            distance_km=Decimal(str(s.distance_km)),
            walk_hours=Decimal(str(s.walk_hours)),
            highest_point_m=s.highest_point_m,
        )
        if _clean(s.notes_en):
            stage.translations.append(StageTranslation(lang=Lang.en, notes=_clean(s.notes_en)))
        if _clean(s.notes_ne):
            stage.translations.append(StageTranslation(lang=Lang.ne, notes=_clean(s.notes_ne)))
        stages.append(stage)
    t.stages = stages

    facts = trek_facts(
        [
            StageFacts(
                day=day,
                from_key=str(s.from_place_id),
                to_key=str(s.to_place_id),
                from_name="",
                to_name="",
                from_altitude_m=places[s.from_place_id].altitude_m or 0,
                to_altitude_m=places[s.to_place_id].altitude_m or 0,
                distance_km=s.distance_km,
                walk_hours=s.walk_hours,
                highest_point_m=s.highest_point_m,
            )
            for day, s in enumerate(body.stages, start=1)
        ]
    )
    t.total_days = facts.total_days
    t.total_distance_km = Decimal(f"{facts.total_distance_km:.1f}")
    t.max_altitude_m = facts.max_altitude_m
