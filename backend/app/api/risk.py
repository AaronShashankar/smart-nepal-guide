from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.i18n import get_lang
from app.models import RiskPrediction, User
from app.models.enums import Lang
from app.schemas.risk import PredictionOut, PredictRiskIn, RiskOut
from app.services.itinerary import load_trek
from app.services.risk import predict, prediction_out

router = APIRouter(tags=["risk"])


@router.post(
    "/predict-risk",
    response_model=RiskOut,
    responses={
        409: {"description": "Traveller profile incomplete"},
        503: {"description": "No model"},
    },
)
def predict_risk(
    body: PredictRiskIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> RiskOut:
    """Personal difficulty & risk for a trek in a month, with the reasons and the
    itinerary's acclimatisation warnings. Saved to the user's history."""
    return predict(db, user, load_trek(db, body.trek_id), body.month, lang)


@router.get("/me/predictions", response_model=list[PredictionOut])
def my_predictions(
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
) -> list[PredictionOut]:
    rows = db.scalars(
        select(RiskPrediction)
        .where(RiskPrediction.user_id == user.id)
        .options(selectinload(RiskPrediction.trek))
        .order_by(RiskPrediction.created_at.desc())
        .limit(limit)
    ).all()
    return [prediction_out(p, lang) for p in rows]
