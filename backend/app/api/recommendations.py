from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.i18n import get_lang
from app.models import User
from app.models.enums import Lang
from app.schemas.community import RecommendationsOut
from app.services.recommend import recommend

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=RecommendationsOut)
def get_recommendations(
    limit: int = Query(10, ge=1, le=30),
    month: int | None = Query(None, ge=1, le=12, description="default: this month in Nepal"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> RecommendationsOut:
    """Places and treks for you: cosine similarity between your interests and each item
    (mode "personal"), or "Popular now" when you have not chosen any interests yet."""
    return recommend(db, user, lang, limit, month)
