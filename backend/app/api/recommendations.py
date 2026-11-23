import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.i18n import get_lang
from app.models import User
from app.models.enums import Lang
from app.schemas.community import DismissIn, RecommendationsOut
from app.services.recommend import dismiss, recommend, undo_dismiss

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=RecommendationsOut)
def get_recommendations(
    limit: int = Query(10, ge=1, le=30),
    month: int | None = Query(None, ge=1, le=12, description="default: this month in Nepal"),
    lat: float | None = Query(None, ge=-90, le=90, description="your position, if you allow it"),
    lng: float | None = Query(None, ge=-180, le=180),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> RecommendationsOut:
    """Places and treks for you: cosine similarity between your taste (interests + what you
    reviewed, planned or hid) and each item, marked down for treks that are risky for you and
    up for items near you, then picked for variety (mode "personal"); or "Popular now" when we
    know nothing about you yet."""
    if (lat is None) != (lng is None):
        lat = lng = None  # half a position is no position
    return recommend(db, user, lang, limit, month, lat, lng)


@router.post("/recommendations/dismissed", status_code=status.HTTP_204_NO_CONTENT)
def not_interested(
    body: DismissIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    """'Not interested': stop recommending this item to me."""
    dismiss(db, user, body.type, body.id)


@router.delete(
    "/recommendations/dismissed/{item_type}/{item_id}", status_code=status.HTTP_204_NO_CONTENT
)
def undo_not_interested(
    item_type: Literal["place", "trek"],
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Undo 'Not interested'."""
    undo_dismiss(db, user, item_type, item_id)
