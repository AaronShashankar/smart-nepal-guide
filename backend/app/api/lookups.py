from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.i18n import get_lang, pick_one
from app.models import Category, Interest
from app.models.enums import Lang
from app.schemas.content import CategoryOut
from app.schemas.user import InterestOut
from app.services.content import category_out

router = APIRouter(tags=["lookups"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), lang: Lang = Depends(get_lang)):
    categories = db.scalars(select(Category).order_by(Category.code)).all()
    return [category_out(c, lang) for c in categories]


@router.get("/interests", response_model=list[InterestOut])
def list_interests(db: Session = Depends(get_db), lang: Lang = Depends(get_lang)):
    interests = db.scalars(select(Interest).order_by(Interest.code)).all()
    return [InterestOut(code=i.code, name=pick_one(i.translations, lang)) for i in interests]
