"""Fuzzy search over places and treks.

Step 1 (database): find candidates with PostgreSQL pg_trgm — trigram `similarity()` and
`word_similarity()` on every translated name and every alias — plus a plain substring
match (ILIKE), which also covers Devanagari text.
Step 2 (Python): rank the candidates with our own Levenshtein similarity.
"""

import uuid

from sqlalchemy import func, or_, select, union_all
from sqlalchemy.orm import Session

from app.algorithms.levenshtein import similarity
from app.core.i18n import pick_one
from app.models import Place, PlaceAlias, PlaceTranslation, Trek, TrekTranslation
from app.models.enums import Lang
from app.schemas.content import SearchHit
from app.services.content import published_places, published_treks

TRIGRAM_THRESHOLD = 0.25
MIN_SCORE = 0.6  # Levenshtein similarity below this is dropped


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _text_match(column, q: str):
    return or_(
        func.similarity(column, q) >= TRIGRAM_THRESHOLD,
        func.word_similarity(q, column) >= TRIGRAM_THRESHOLD,
        column.ilike(f"%{_escape_like(q)}%"),
    )


def _rank(q: str, texts: list[str]) -> tuple[float, str]:
    best = max(texts, key=lambda t: similarity(q, t))
    return similarity(q, best), best


def search_places(db: Session, q: str, lang: Lang, limit: int) -> list[SearchHit]:
    by_name = select(PlaceTranslation.place_id.label("pid"), PlaceTranslation.name.label("text"))
    by_name = by_name.where(_text_match(PlaceTranslation.name, q))
    by_alias = select(PlaceAlias.place_id.label("pid"), PlaceAlias.alias.label("text"))
    by_alias = by_alias.where(_text_match(PlaceAlias.alias, q))
    matches = union_all(by_name, by_alias).subquery()

    ids = {row.pid for row in db.execute(select(matches.c.pid).distinct())}
    if not ids:
        return []
    places = db.scalars(select(Place).where(Place.id.in_(ids), published_places())).all()
    aliases: dict[uuid.UUID, list[str]] = {}
    for pid, alias in db.execute(
        select(PlaceAlias.place_id, PlaceAlias.alias).where(PlaceAlias.place_id.in_(ids))
    ):
        aliases.setdefault(pid, []).append(alias)

    hits = []
    for place in places:
        texts = [t.name for t in place.translations] + aliases.get(place.id, [])
        score, matched = _rank(q, texts)
        if score < MIN_SCORE:
            continue
        hits.append(
            SearchHit(
                type="place",
                id=place.id,
                name=pick_one(place.translations, lang),
                subtitle=pick_one(place.category.translations, lang),
                score=round(score, 3),
                matched=matched,
            )
        )
    hits.sort(key=lambda h: (-h.score, h.name))
    return hits[:limit]


def search_treks(db: Session, q: str, lang: Lang, limit: int) -> list[SearchHit]:
    stmt = select(TrekTranslation.trek_id).where(_text_match(TrekTranslation.name, q)).distinct()
    ids = set(db.scalars(stmt))
    if not ids:
        return []
    treks = db.scalars(select(Trek).where(Trek.id.in_(ids), published_treks())).all()
    hits = []
    for trek in treks:
        score, matched = _rank(q, [t.name for t in trek.translations])
        if score < MIN_SCORE:
            continue
        hits.append(
            SearchHit(
                type="trek",
                id=trek.id,
                name=pick_one(trek.translations, lang),
                subtitle=f"{trek.region} · {trek.total_days}d",
                score=round(score, 3),
                matched=matched,
            )
        )
    hits.sort(key=lambda h: (-h.score, h.name))
    return hits[:limit]
