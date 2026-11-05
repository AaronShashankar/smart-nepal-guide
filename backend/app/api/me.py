from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.i18n import get_lang, pick_one
from app.models import Interest, TravellerProfile, User
from app.models.enums import Lang
from app.schemas.user import InterestOut, MeOut, MeUpdate, ProfileIn, ProfileOut

router = APIRouter(prefix="/me", tags=["me"])

PROFILE_FIELDS = (
    "date_of_birth",
    "fitness_level",
    "trek_experience",
    "has_heart_condition",
    "has_asthma",
    "budget_level",
    "travel_style",
)


def _me_out(user: User) -> MeOut:
    out = MeOut.model_validate(user)
    out.has_profile = user.profile is not None
    return out


@router.get("", response_model=MeOut)
def get_me(user: User = Depends(get_current_user)) -> MeOut:
    return _me_out(user)


@router.patch("", response_model=MeOut)
def update_me(
    body: MeUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MeOut:
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "preferred_lang" and value is None:
            continue
        setattr(user, field, value)
    db.commit()
    return _me_out(user)


def _profile_out(user: User, lang: Lang) -> ProfileOut:
    data = {f: getattr(user.profile, f) for f in PROFILE_FIELDS} if user.profile else {}
    interests = sorted(user.interests, key=lambda i: i.code)
    data["interests"] = [
        InterestOut(code=i.code, name=pick_one(i.translations, lang)) for i in interests
    ]
    return ProfileOut(**data)


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user), lang: Lang = Depends(get_lang)):
    return _profile_out(user, lang)


@router.put("/profile", response_model=ProfileOut)
def put_profile(
    body: ProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> ProfileOut:
    codes = set(body.interests)
    interests = list(db.scalars(select(Interest).where(Interest.code.in_(codes)))) if codes else []
    unknown = codes - {i.code for i in interests}
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown interests: {sorted(unknown)}"
        )
    if user.profile is None:
        user.profile = TravellerProfile()
    for field in PROFILE_FIELDS:  # PUT replaces the whole profile
        setattr(user.profile, field, getattr(body, field))
    user.interests = interests
    db.commit()
    db.refresh(user)
    return _profile_out(user, lang)
