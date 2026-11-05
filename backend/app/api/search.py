from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.i18n import get_lang
from app.models.enums import Lang
from app.schemas.content import SearchOut
from app.services.search import search_places, search_treks

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchOut)
def search(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> SearchOut:
    q = q.strip()
    return SearchOut(
        query=q,
        places=search_places(db, q, lang, limit),
        treks=search_treks(db, q, lang, limit),
    )
