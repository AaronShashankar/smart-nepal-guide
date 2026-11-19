"""Packing checklist for a trek and month (V2 Phase 1). The rules live in packing_item; the
inference is the pure function app.algorithms.packing.packing_list."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.algorithms.packing import Facts, Rule, packing_list
from app.core.i18n import pick
from app.models import PackingItem, Trek, TrekStage
from app.models.enums import Lang, PackingGroup
from app.schemas.smart import PackingGroupOut, PackingItemOut, PackingListOut
from app.services.content import published_treks
from app.services.itinerary import stage_facts, trek_facts


def as_rule(item: PackingItem) -> Rule:
    return Rule(
        code=item.code,
        group=item.group.value,
        sort_order=item.sort_order,
        always=item.always,
        min_altitude_m=item.min_altitude_m,
        months=tuple(item.months),
        min_days=item.min_days,
    )


def trek_packing(db: Session, trek_id: uuid.UUID, month: int, lang: Lang) -> PackingListOut:
    trek = db.scalar(
        select(Trek)
        .where(Trek.id == trek_id, published_treks())
        .options(
            selectinload(Trek.permits),
            selectinload(Trek.stages).selectinload(TrekStage.from_place),
            selectinload(Trek.stages).selectinload(TrekStage.to_place),
        )
    )
    if trek is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trek not found")

    # Facts come from the stages (like the risk check); a trek without stages yet uses its summary.
    if trek.stages:
        tf = trek_facts(stage_facts(trek, lang))
        facts = Facts(tf.max_altitude_m, tf.total_days, month)
    else:
        facts = Facts(trek.max_altitude_m or 0, trek.total_days, month)

    items = {i.code: i for i in db.scalars(select(PackingItem))}
    permits = {p.code: p for p in trek.permits}
    picks = packing_list([as_rule(i) for i in items.values()], facts, list(permits))

    groups: dict[PackingGroup, list[PackingItemOut]] = {g: [] for g in PackingGroup}
    for p in picks:
        if p.code.startswith("permit:"):
            permit = permits[p.code.removeprefix("permit:")]
            name = f"{pick(permit.translations, lang, 'name')['name']} ({permit.code})"
            note = None
        else:
            t = pick(items[p.code].translations, lang, "name", "note")
            name, note = t["name"], t["note"]
        groups[PackingGroup(p.group)].append(
            PackingItemOut(code=p.code, name=name, note=note, reason=p.reason, value=p.value)
        )
    return PackingListOut(
        trek_id=trek.id,
        month=month,
        max_altitude_m=facts.max_altitude_m,
        total_days=facts.total_days,
        total_items=len(picks),
        groups=[PackingGroupOut(group=g, items=v) for g, v in groups.items() if v],
    )
