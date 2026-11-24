"""Version 2 Phase 3 Core: emergency contacts, SOS events and symptom checks.

Bato is not a rescue service and not medical advice: the SMS itself goes through the phone's own
SMS app, and the symptom checker only applies the published Lake Louise score.
"""

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.i18n import get_lang
from app.models import SymptomCheck, User
from app.models.enums import Lang
from app.schemas.safety import (
    EmergencyContactIn,
    EmergencyContactOut,
    EmergencyContactPatch,
    SosEventIn,
    SosEventOut,
    SymptomCheckIn,
    SymptomCheckOut,
)
from app.services import safety as svc

router = APIRouter(tags=["safety"])


# --------------------------------------------------------- emergency contacts
@router.get("/me/emergency-contacts", response_model=list[EmergencyContactOut])
def list_contacts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.active_contacts(db, user)


@router.post(
    "/me/emergency-contacts",
    response_model=EmergencyContactOut,
    status_code=status.HTTP_201_CREATED,
    responses={422: {"description": "Invalid phone number, or already 5 contacts"}},
)
def create_contact(
    body: EmergencyContactIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Phone numbers are stored as E.164: `9812345678` and `01-4440292` become `+977…`."""
    return svc.create_contact(db, user, body)


@router.patch("/me/emergency-contacts/{contact_id}", response_model=EmergencyContactOut)
def update_contact(
    contact_id: uuid.UUID,
    body: EmergencyContactPatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.update_contact(db, user, contact_id, body)


@router.delete("/me/emergency-contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    svc.delete_contact(db, user, contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------------ SOS
@router.post("/sos-events", response_model=SosEventOut, status_code=status.HTTP_201_CREATED)
def create_sos_event(
    body: SosEventIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Records an SOS the phone already sent by SMS. Sent twice by the queue → saved once."""
    event = svc.save_sos(db, user, body)
    return SosEventOut(id=event.id, sent_at=event.sent_at)


# ------------------------------------------------------------- symptom checks
@router.post("/symptom-checks", response_model=SymptomCheckOut, status_code=status.HTTP_201_CREATED)
def create_symptom_check(
    body: SymptomCheckIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
):
    """Scores the answers with the Lake Louise AMS score (2018) and saves the check."""
    check = svc.save_symptom_check(db, user, body)
    return svc.symptom_check_out(check, lang)


@router.get("/me/symptom-checks", response_model=list[SymptomCheckOut])
def my_symptom_checks(
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lang: Lang = Depends(get_lang),
):
    rows = db.scalars(
        select(SymptomCheck)
        .where(SymptomCheck.user_id == user.id)
        .options(selectinload(SymptomCheck.trek))
        .order_by(SymptomCheck.checked_at.desc())
        .limit(limit)
    ).all()
    return [svc.symptom_check_out(c, lang) for c in rows]
