"""Reviews & ratings (V2 Phase 2). One review per user and item: a second post updates it."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, literal_column, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import InstrumentedAttribute, Session, selectinload

from app.api.deps import get_current_user, get_optional_user
from app.core.db import get_db
from app.core.i18n import get_lang
from app.models import Place, Review, Trek, User
from app.models.enums import Lang
from app.schemas.community import ReviewIn, ReviewOut, ReviewPage
from app.services.content import published_places, published_treks
from app.services.rating import VISIBLE, ratings

router = APIRouter(tags=["reviews"])

PAGE_SIZE = 20


def review_out(r: Review, user: User | None) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        rating=r.rating,
        comment=r.comment,
        lang=r.lang,
        author_name=r.user.full_name,
        status=r.status,
        is_mine=user is not None and r.user_id == user.id,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def _check_target(db: Session, kind: str, item_id: uuid.UUID) -> None:
    model, published = (Place, published_places) if kind == "place" else (Trek, published_treks)
    if db.scalar(select(model.id).where(model.id == item_id, published())) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{kind.capitalize()} not found")


def _upsert(
    db: Session, kind: str, item_id: uuid.UUID, body: ReviewIn, user: User, lang: Lang
) -> tuple[ReviewOut, bool]:
    """INSERT … ON CONFLICT DO UPDATE on the partial unique index: atomic, no duplicate."""
    _check_target(db, kind, item_id)
    fk = f"{kind}_id"
    stmt = (
        insert(Review)
        .values(user_id=user.id, rating=body.rating, comment=body.comment, lang=lang,
                **{fk: item_id})
        .on_conflict_do_update(
            index_elements=["user_id", fk],
            index_where=text(f"{fk} IS NOT NULL"),
            # An admin's "hidden" stays hidden: editing does not undo moderation.
            set_={"rating": body.rating, "comment": body.comment, "lang": lang,
                  "updated_at": func.now()},
        )
        .returning(Review.id, literal_column("xmax = 0").label("inserted"))
    )  # fmt: skip
    review_id, inserted = db.execute(stmt).one()
    db.commit()
    review = db.scalar(
        select(Review).where(Review.id == review_id).options(selectinload(Review.user))
    )
    return review_out(review, user), bool(inserted)


def _page(
    db: Session,
    column: InstrumentedAttribute,
    item_id: uuid.UUID,
    page: int,
    user: User | None,
) -> ReviewPage:
    where = (column == item_id, VISIBLE)
    total = db.scalar(select(func.count()).select_from(Review).where(*where)) or 0
    rows = db.scalars(
        select(Review)
        .where(*where)
        .options(selectinload(Review.user))
        .order_by(Review.updated_at.desc(), Review.id)
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
    ).all()
    mine = None
    if user is not None:
        own = db.scalar(
            select(Review)
            .where(column == item_id, Review.user_id == user.id)
            .options(selectinload(Review.user))
        )
        mine = review_out(own, user) if own else None
    return ReviewPage(
        items=[review_out(r, user) for r in rows],
        total=total,
        page=page,
        page_size=PAGE_SIZE,
        rating=ratings(db, column, [item_id])[item_id],
        mine=mine,
    )


@router.post("/places/{place_id}/reviews", response_model=ReviewOut)
def review_place(
    place_id: uuid.UUID,
    body: ReviewIn,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> ReviewOut:
    """Write or update your review (201 when new, 200 when it replaced your earlier one)."""
    out, inserted = _upsert(db, "place", place_id, body, user, lang)
    response.status_code = status.HTTP_201_CREATED if inserted else status.HTTP_200_OK
    return out


@router.post("/treks/{trek_id}/reviews", response_model=ReviewOut)
def review_trek(
    trek_id: uuid.UUID,
    body: ReviewIn,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> ReviewOut:
    out, inserted = _upsert(db, "trek", trek_id, body, user, lang)
    response.status_code = status.HTTP_201_CREATED if inserted else status.HTTP_200_OK
    return out


@router.get("/places/{place_id}/reviews", response_model=ReviewPage)
def place_reviews(
    place_id: uuid.UUID,
    page: int = Query(1, ge=1),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> ReviewPage:
    _check_target(db, "place", place_id)
    return _page(db, Review.place_id, place_id, page, user)


@router.get("/treks/{trek_id}/reviews", response_model=ReviewPage)
def trek_reviews(
    trek_id: uuid.UUID,
    page: int = Query(1, ge=1),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> ReviewPage:
    _check_target(db, "trek", trek_id)
    return _page(db, Review.trek_id, trek_id, page, user)


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    """Delete your own review. Someone else's review gives 404 (we don't say it exists)."""
    review = db.scalar(select(Review).where(Review.id == review_id, Review.user_id == user.id))
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    db.delete(review)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
