"""Admin panel API. Every route needs a logged-in user with role = admin."""

import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.api.deps import require_admin
from app.core.config import get_settings
from app.core.db import get_db
from app.models import (
    Category,
    Permit,
    Place,
    PlacePhoto,
    PlaceTranslation,
    Review,
    RiskPrediction,
    Trek,
    TrekPermit,
    TrekTranslation,
    Trip,
    User,
)
from app.models.enums import Lang, RiskLevel
from app.schemas.admin import (
    BlockIn,
    CategoryAdminIn,
    CategoryAdminOut,
    Page,
    PermitAdminIn,
    PermitAdminOut,
    PhotoAdminOut,
    PlaceAdminIn,
    PlaceAdminOut,
    PlaceAdminRow,
    ReviewAdminRow,
    ReviewStatusIn,
    StatsOut,
    TrekAdminIn,
    TrekAdminOut,
    TrekAdminRow,
    UserAdminRow,
)
from app.services import admin as svc

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024


def _now() -> datetime:
    return datetime.now(UTC)


# --------------------------------------------------------------------- stats
@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)) -> StatsOut:
    def count(model, *where) -> int:
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    by_level = dict(
        db.execute(
            select(RiskPrediction.predicted_level, func.count()).group_by(
                RiskPrediction.predicted_level
            )
        ).all()
    )
    return StatsOut(
        users=count(User),
        blocked_users=count(User, User.is_blocked),
        places=count(Place, Place.deleted_at.is_(None)),
        treks=count(Trek, Trek.deleted_at.is_(None)),
        trips=count(Trip, Trip.deleted_at.is_(None)),
        reviews=count(Review),
        risk_predictions=count(RiskPrediction),
        predictions_by_level={level: by_level.get(level, 0) for level in RiskLevel},
    )


# ---------------------------------------------------------------- categories
@router.get("/categories", response_model=list[CategoryAdminOut])
def list_categories(db: Session = Depends(get_db)):
    return [svc.category_out(db, c) for c in db.scalars(select(Category).order_by(Category.code))]


@router.post("/categories", response_model=CategoryAdminOut, status_code=201)
def create_category(body: CategoryAdminIn, db: Session = Depends(get_db)):
    c = Category()
    svc.save_category(db, c, body)
    db.add(c)
    db.commit()
    return svc.category_out(db, c)


@router.put("/categories/{category_id}", response_model=CategoryAdminOut)
def update_category(category_id: uuid.UUID, body: CategoryAdminIn, db: Session = Depends(get_db)):
    c = db.get(Category, category_id)
    if c is None:
        raise svc.not_found("Category")
    svc.save_category(db, c, body)
    db.commit()
    return svc.category_out(db, c)


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    c = db.get(Category, category_id)
    if c is None:
        raise svc.not_found("Category")
    if db.scalar(select(func.count()).where(Place.category_id == c.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Category still has places")
    db.delete(c)
    db.commit()
    return Response(status_code=204)


# -------------------------------------------------------------------- places
@router.get("/places", response_model=Page[PlaceAdminRow])
def list_places(
    q: str | None = None,
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> Page[PlaceAdminRow]:
    en, ne = aliased(PlaceTranslation), aliased(PlaceTranslation)
    stmt = (
        select(Place, en.name, ne.name)
        .join(en, (en.place_id == Place.id) & (en.lang == Lang.en))
        .outerjoin(ne, (ne.place_id == Place.id) & (ne.lang == Lang.ne))
        .join(Category, Category.id == Place.category_id)
        .where(Place.deleted_at.is_(None))
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(en.name.ilike(like), ne.name.ilike(like), Place.district.ilike(like)))
    if category:
        stmt = stmt.where(Category.code == category)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    photo_counts = select(func.count()).where(PlacePhoto.place_id == Place.id).scalar_subquery()
    rows = db.execute(
        stmt.add_columns(photo_counts)
        .order_by(en.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page[PlaceAdminRow](
        items=[
            PlaceAdminRow(
                id=p.id,
                name_en=name_en,
                name_ne=name_ne,
                category_code=p.category.code,
                district=p.district,
                altitude_m=p.altitude_m,
                latitude=float(p.latitude),
                longitude=float(p.longitude),
                is_published=p.is_published,
                photo_count=photos,
                updated_at=p.updated_at,
            )
            for p, name_en, name_ne, photos in rows
        ],
        total=total,
    )


@router.get("/places/{place_id}", response_model=PlaceAdminOut)
def get_place(place_id: uuid.UUID, db: Session = Depends(get_db)):
    return svc.place_out(svc.load_place(db, place_id))


@router.post("/places", response_model=PlaceAdminOut, status_code=201)
def create_place(
    body: PlaceAdminIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    p = Place(id=uuid.uuid4())
    svc.save_place(db, p, body, admin)
    db.add(p)
    db.commit()
    return svc.place_out(svc.load_place(db, p.id))


@router.put("/places/{place_id}", response_model=PlaceAdminOut)
def update_place(
    place_id: uuid.UUID,
    body: PlaceAdminIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    p = svc.load_place(db, place_id)
    svc.save_place(db, p, body, admin)
    p.updated_at = _now()
    db.commit()
    return svc.place_out(svc.load_place(db, place_id))


@router.delete("/places/{place_id}", status_code=204)
def delete_place(place_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    p = svc.load_place(db, place_id)
    if svc.place_in_use(db, place_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This place is used in a trek itinerary: edit the trek first"
        )
    p.deleted_at = p.updated_at = _now()  # soft delete, so phones can sync it away
    db.commit()
    return Response(status_code=204)


@router.post("/places/{place_id}/photos", response_model=PhotoAdminOut, status_code=201)
async def upload_photo(
    place_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db)
) -> PhotoAdminOut:
    p = svc.load_place(db, place_id)
    ext = IMAGE_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a JPEG, PNG or WebP image"
        )
    data = await file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Photos must be 5 MB or smaller")
    folder = get_settings().uploads_path / "places"
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"  # never trust the uploaded file name
    (folder / name).write_bytes(data)
    photo = PlacePhoto(
        place_id=p.id,
        url=f"/uploads/places/{name}",
        sort_order=max((ph.sort_order for ph in p.photos), default=-1) + 1,
    )
    db.add(photo)
    p.updated_at = _now()
    db.commit()
    return PhotoAdminOut(id=photo.id, url=photo.url, sort_order=photo.sort_order)


@router.delete("/places/{place_id}/photos/{photo_id}", status_code=204)
def delete_photo(place_id: uuid.UUID, photo_id: uuid.UUID, db: Session = Depends(get_db)):
    photo = db.get(PlacePhoto, photo_id)
    if photo is None or photo.place_id != place_id:
        raise svc.not_found("Photo")
    if photo.url.startswith("/uploads/"):
        path = get_settings().uploads_path / Path(photo.url).relative_to("/uploads")
        path.unlink(missing_ok=True)
    db.delete(photo)
    db.commit()
    return Response(status_code=204)


# ------------------------------------------------------------------- permits
@router.get("/permits", response_model=list[PermitAdminOut])
def list_permits(db: Session = Depends(get_db)):
    return [svc.permit_out(db, p) for p in db.scalars(select(Permit).order_by(Permit.code))]


@router.post("/permits", response_model=PermitAdminOut, status_code=201)
def create_permit(body: PermitAdminIn, db: Session = Depends(get_db)):
    p = Permit()
    svc.save_permit(db, p, body)
    db.add(p)
    db.commit()
    return svc.permit_out(db, p)


@router.put("/permits/{permit_id}", response_model=PermitAdminOut)
def update_permit(permit_id: uuid.UUID, body: PermitAdminIn, db: Session = Depends(get_db)):
    p = db.get(Permit, permit_id)
    if p is None:
        raise svc.not_found("Permit")
    svc.save_permit(db, p, body)
    db.commit()
    return svc.permit_out(db, p)


@router.delete("/permits/{permit_id}", status_code=204)
def delete_permit(permit_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    p = db.get(Permit, permit_id)
    if p is None:
        raise svc.not_found("Permit")
    if db.scalar(select(func.count()).where(TrekPermit.permit_id == p.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Permit is still used by a trek")
    db.delete(p)
    db.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------- treks
@router.get("/treks", response_model=list[TrekAdminRow])
def list_treks(db: Session = Depends(get_db)) -> list[TrekAdminRow]:
    en, ne = aliased(TrekTranslation), aliased(TrekTranslation)
    rows = db.execute(
        select(Trek, en.name, ne.name)
        .join(en, (en.trek_id == Trek.id) & (en.lang == Lang.en))
        .outerjoin(ne, (ne.trek_id == Trek.id) & (ne.lang == Lang.ne))
        .where(Trek.deleted_at.is_(None))
        .order_by(en.name)
    ).all()
    return [
        TrekAdminRow(
            id=t.id,
            name_en=name_en,
            name_ne=name_ne,
            region=t.region,
            total_days=t.total_days,
            max_altitude_m=t.max_altitude_m,
            base_difficulty=t.base_difficulty,
            is_published=t.is_published,
            updated_at=t.updated_at,
        )
        for t, name_en, name_ne in rows
    ]


@router.get("/treks/{trek_id}", response_model=TrekAdminOut)
def get_trek(trek_id: uuid.UUID, db: Session = Depends(get_db)):
    return svc.trek_out(svc.load_trek(db, trek_id))


@router.post("/treks", response_model=TrekAdminOut, status_code=201)
def create_trek(body: TrekAdminIn, db: Session = Depends(get_db)):
    t = Trek(id=uuid.uuid4())
    with db.no_autoflush:  # don't insert the trek before its totals are computed
        svc.save_trek(db, t, body)
    db.add(t)
    db.commit()
    return svc.trek_out(svc.load_trek(db, t.id))


@router.put("/treks/{trek_id}", response_model=TrekAdminOut)
def update_trek(trek_id: uuid.UUID, body: TrekAdminIn, db: Session = Depends(get_db)):
    """Replaces the trek, including all its stages (the stage editor sends the whole list)."""
    t = svc.load_trek(db, trek_id)
    svc.save_trek(db, t, body)
    t.updated_at = _now()
    db.commit()
    return svc.trek_out(svc.load_trek(db, trek_id))


@router.delete("/treks/{trek_id}", status_code=204)
def delete_trek(trek_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    t = svc.load_trek(db, trek_id)
    t.deleted_at = t.updated_at = _now()
    db.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------- users
@router.get("/users", response_model=Page[UserAdminRow])
def list_users(
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> Page[UserAdminRow]:
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    predictions = select(func.count()).where(RiskPrediction.user_id == User.id).scalar_subquery()
    trips = select(func.count()).where(Trip.user_id == User.id).scalar_subquery()
    rows = db.execute(
        stmt.add_columns(predictions, trips)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page[UserAdminRow](
        items=[
            UserAdminRow(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                auth_provider=u.auth_provider,
                is_blocked=u.is_blocked,
                created_at=u.created_at,
                prediction_count=n_pred,
                trip_count=n_trips,
            )
            for u, n_pred, n_trips in rows
        ],
        total=total,
    )


@router.put("/users/{user_id}/block", response_model=UserAdminRow)
def set_blocked(
    user_id: uuid.UUID,
    body: BlockIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserAdminRow:
    u = db.get(User, user_id)
    if u is None:
        raise svc.not_found("User")
    if u.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot block yourself")
    u.is_blocked = body.is_blocked
    db.commit()
    return UserAdminRow(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        auth_provider=u.auth_provider,
        is_blocked=u.is_blocked,
        created_at=u.created_at,
        prediction_count=db.scalar(
            select(func.count()).where(RiskPrediction.user_id == u.id)
        ) or 0,
        trip_count=db.scalar(select(func.count()).where(Trip.user_id == u.id)) or 0,
    )  # fmt: skip


# ------------------------------------------------------------------- reviews
@router.get("/reviews", response_model=list[ReviewAdminRow])
def list_reviews(
    status_filter: str | None = Query(None, alias="status"), db: Session = Depends(get_db)
) -> list[ReviewAdminRow]:
    stmt = (
        select(Review)
        .options(selectinload(Review.user), selectinload(Review.place),
                 selectinload(Review.trek))
        .order_by(Review.created_at.desc())
        .limit(500)
    )  # fmt: skip
    if status_filter:
        stmt = stmt.where(Review.status == status_filter)
    out = []
    for r in db.scalars(stmt):
        target = r.place or r.trek
        name = next((t.name for t in target.translations if t.lang == Lang.en), "?")
        out.append(
            ReviewAdminRow(
                id=r.id,
                user_email=r.user.email,
                target_type="place" if r.place_id else "trek",
                target_name=name,
                rating=r.rating,
                comment=r.comment,
                status=r.status,
                created_at=r.created_at,
            )
        )
    return out


@router.put("/reviews/{review_id}/status", response_model=ReviewAdminRow)
def set_review_status(
    review_id: uuid.UUID, body: ReviewStatusIn, db: Session = Depends(get_db)
) -> ReviewAdminRow:
    r = db.get(Review, review_id)
    if r is None:
        raise svc.not_found("Review")
    r.status = body.status
    db.commit()
    target = r.place or r.trek
    return ReviewAdminRow(
        id=r.id,
        user_email=r.user.email,
        target_type="place" if r.place_id else "trek",
        target_name=next((t.name for t in target.translations if t.lang == Lang.en), "?"),
        rating=r.rating,
        comment=r.comment,
        status=r.status,
        created_at=r.created_at,
    )
