"""Emergency contacts, SOS events and symptom checks (V2-P3-01 … 03)."""

import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.algorithms.lake_louise import Answers, RedFlag, score, severity_of
from app.core.i18n import pick_one
from app.models import EmergencyContact, SosEvent, SymptomCheck, Trek, User
from app.models.enums import Lang
from app.models.safety import MAX_EMERGENCY_CONTACTS
from app.schemas.safety import (
    EmergencyContactIn,
    EmergencyContactPatch,
    SosEventIn,
    SymptomCheckIn,
    SymptomCheckOut,
)

BAD_PHONE = "Invalid phone number"
TOO_MANY = f"You can save at most {MAX_EMERGENCY_CONTACTS} emergency contacts"
CONTACT_NOT_FOUND = "Contact not found"
ID_TAKEN = "This id is already used"

NEPAL = "+977"
_SEPARATORS = re.compile(r"[\s\-().]")
_E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_NEPAL_MOBILE = re.compile(r"^9[78]\d{8}$")  # NTC / Ncell / Smart: 97x and 98x, 10 digits
_NEPAL_LANDLINE = re.compile(r"^0[1-9]\d{6,8}$")  # 01-4440292: area code with a leading 0


def normalise_phone(raw: str) -> str:
    """Return the number in E.164 (+9779812345678), or raise ValueError.

    Accepts what Nepali travellers type: a 10-digit mobile number (98…, 97…), a landline with its
    area code (01-…), 00977… or +977…, and any foreign number written with + or 00.
    """
    phone = _SEPARATORS.sub("", raw.strip())
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    elif _NEPAL_MOBILE.match(phone):
        phone = NEPAL + phone
    elif _NEPAL_LANDLINE.match(phone):
        phone = NEPAL + phone[1:]
    if not _E164.match(phone):
        raise ValueError(BAD_PHONE)
    return phone


def _phone_or_422(raw: str) -> str:
    try:
        return normalise_phone(raw)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, BAD_PHONE) from None


def _now() -> datetime:
    return datetime.now(UTC)


# --------------------------------------------------------- emergency contacts
def active_contacts(db: Session, user: User) -> list[EmergencyContact]:
    return list(
        db.scalars(
            select(EmergencyContact)
            .where(EmergencyContact.user_id == user.id, EmergencyContact.deleted_at.is_(None))
            .order_by(EmergencyContact.sort_order, EmergencyContact.name)
        )
    )


def create_contact(db: Session, user: User, body: EmergencyContactIn) -> EmergencyContact:
    contacts = active_contacts(db, user)
    if len(contacts) >= MAX_EMERGENCY_CONTACTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, TOO_MANY)
    contact = EmergencyContact(
        user_id=user.id,
        name=body.name.strip(),
        phone=_phone_or_422(body.phone),
        email=body.email,
        relation=(body.relation or "").strip() or None,
        sort_order=max((c.sort_order for c in contacts), default=-1) + 1,
    )
    db.add(contact)
    db.commit()
    return contact


def own_contact(db: Session, user: User, contact_id: uuid.UUID) -> EmergencyContact:
    contact = db.get(EmergencyContact, contact_id)
    if contact is None or contact.user_id != user.id or contact.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, CONTACT_NOT_FOUND)
    return contact


def update_contact(
    db: Session, user: User, contact_id: uuid.UUID, body: EmergencyContactPatch
) -> EmergencyContact:
    contact = own_contact(db, user, contact_id)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("name") is not None:
        contact.name = changes["name"].strip()
    if changes.get("phone") is not None:
        contact.phone = _phone_or_422(changes["phone"])
    if "email" in changes:
        contact.email = changes["email"]
    if "relation" in changes:
        contact.relation = (changes["relation"] or "").strip() or None
    if changes.get("sort_order") is not None:
        contact.sort_order = changes["sort_order"]
    db.commit()
    return contact


def delete_contact(db: Session, user: User, contact_id: uuid.UUID) -> None:
    contact = own_contact(db, user, contact_id)
    contact.deleted_at = _now()  # soft delete, like the other syncable tables
    db.commit()


# ------------------------------------------------------------------------ SOS
def save_sos(db: Session, user: User, body: SosEventIn) -> SosEvent:
    """Insert once: the phone's queue may send the same event again after a lost response."""
    db.execute(
        insert(SosEvent)
        .values(
            id=body.id,
            user_id=user.id,
            latitude=body.latitude,
            longitude=body.longitude,
            accuracy_m=body.accuracy_m,
            message=body.message,
            sent_at=body.sent_at,
        )
        .on_conflict_do_nothing(index_elements=[SosEvent.id])
    )
    db.commit()
    event = db.get(SosEvent, body.id)
    if event is None or event.user_id != user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, ID_TAKEN)
    return event


def sos_count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(SosEvent)) or 0


# ------------------------------------------------------------- symptom checks
def save_symptom_check(db: Session, user: User, body: SymptomCheckIn) -> SymptomCheck:
    if body.trek_id is not None and db.get(Trek, body.trek_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trek not found")
    # The server scores the answers itself; the phone's result is only for showing offline.
    result = score(
        Answers(body.headache, body.gi, body.fatigue, body.dizziness, list(body.red_flags))
    )
    db.execute(
        insert(SymptomCheck)
        .values(
            id=body.id,
            user_id=user.id,
            trek_id=body.trek_id,
            altitude_m=body.altitude_m,
            headache=body.headache,
            gi_symptoms=body.gi,
            fatigue=body.fatigue,
            dizziness=body.dizziness,
            red_flags=sorted({f.value for f in body.red_flags}),
            total_score=result.total,
            result=result.result,
            checked_at=body.checked_at,
        )
        .on_conflict_do_nothing(index_elements=[SymptomCheck.id])
    )
    db.commit()
    check = db.get(SymptomCheck, body.id)
    if check is None or check.user_id != user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, ID_TAKEN)
    return check


def symptom_check_out(check: SymptomCheck, lang: Lang) -> SymptomCheckOut:
    flags = [RedFlag(f) for f in check.red_flags]
    scored = score(
        Answers(check.headache, check.gi_symptoms, check.fatigue, check.dizziness, flags)
    )
    return SymptomCheckOut(
        id=check.id,
        trek_id=check.trek_id,
        trek_name=pick_one(check.trek.translations, lang) if check.trek else None,
        altitude_m=check.altitude_m,
        headache=check.headache,
        gi=check.gi_symptoms,
        fatigue=check.fatigue,
        dizziness=check.dizziness,
        red_flags=flags,
        total=check.total_score,
        severity=severity_of(check.headache, check.total_score),
        result=check.result,
        reasons=scored.reasons,
        checked_at=check.checked_at,
    )
