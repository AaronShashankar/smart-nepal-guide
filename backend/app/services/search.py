"""Fuzzy search over places and treks.

Step 1 (database): find candidates with PostgreSQL pg_trgm — trigram `similarity()` and
`word_similarity()` — plus a plain substring match (ILIKE), which also covers Devanagari text.
Candidates come from:
  - every translated name, its Latin spelling (`name_latin`, see algorithms/transliterate.py)
    and every alias;
  - a place's district ("bhaktapur" lists the places in Bhaktapur district);
  - a place's category ("temple" lists temples);
  - an area, i.e. a city or trek region ("pokhara" lists Phewa Lake, Sarangkot and the World
    Peace Pagoda, which are in Kaski district; "khumbu" lists the Everest region and its treks);
  - for treks, the villages they pass through ("namche" finds the Everest Base Camp Trek).
A query typed in Devanagari is also searched in Latin letters (to_latin), so "पोखरा" can match
a name we only have in English.

Step 2 (Python): rank the candidates with our own Levenshtein similarity. Matches on a district,
an area, a category or a village count a little less than a match on the item's own name, so
"Bhaktapur Durbar Square" comes before the other places in Bhaktapur district.
"""

import uuid
from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy import func, or_, select, union_all
from sqlalchemy.orm import Session, selectinload

from app.algorithms.levenshtein import normalise, similarity
from app.algorithms.transliterate import is_devanagari, to_latin
from app.core.i18n import pick_one
from app.models import (
    Area,
    Category,
    CategoryTranslation,
    Place,
    PlaceAlias,
    PlaceTranslation,
    Trek,
    TrekStage,
    TrekTranslation,
)
from app.models.enums import Lang
from app.schemas.content import SearchHit
from app.services.content import category_out, published_places, published_treks

TRIGRAM_THRESHOLD = 0.25
# Levenshtein similarity below this is dropped. Chosen with the search test set
# (app/search_benchmark.py): 0.6 let "thamel" find "Chame"; 0.75 lost "thorong la" -> the trek.
MIN_SCORE = 0.7
# Short words are too easy to match by accident ("lake" is one letter from "larke"), so a query
# shorter than this must match almost exactly, as in common search engines' typo rules.
SHORT_QUERY_LEN = 5
SHORT_QUERY_MIN = 0.85
# How much a match counts when it is not on the item's own name
DISTRICT_WEIGHT = 0.9
# Just under DISTRICT_WEIGHT, so "kathmandu" lists Kathmandu district first, then Patan
AREA_WEIGHT = 0.88
CATEGORY_WEIGHT = 0.85
VIA_WEIGHT = 0.95
MAX_INITIALS = 6  # a query this short may be a trek's initials


@dataclass
class Match:
    score: float
    shown: str  # the text that matched, as the user should see it


def query_forms(q: str) -> list[str]:
    """The query as typed, plus its Latin spelling when it is in Devanagari."""
    forms = [q]
    if is_devanagari(q):
        latin = to_latin(q)
        if latin and latin != q:
            forms.append(latin)
    return forms


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _text_match(column, forms: list[str]):
    return or_(
        *(
            cond
            for q in forms
            for cond in (
                func.similarity(column, q) >= TRIGRAM_THRESHOLD,
                func.word_similarity(q, column) >= TRIGRAM_THRESHOLD,
                column.ilike(f"%{_escape_like(q)}%"),
            )
        )
    )


def min_similarity(q: str) -> float:
    return SHORT_QUERY_MIN if len(normalise(q)) < SHORT_QUERY_LEN else MIN_SCORE


def best_match(forms: list[str], texts: Iterable[tuple[str, str]]) -> Match | None:
    """Best Levenshtein similarity between any query form and any (text, shown) pair.
    Pairs below the query's minimum (min_similarity) do not count."""
    best: Match | None = None
    for text, shown in texts:
        for q in forms:
            score = similarity(q, text)
            if score < min_similarity(q):
                continue
            if best is None or score > best.score:
                best = Match(score, shown)
    return best


def _name_texts(translations, aliases: list[str]) -> list[tuple[str, str]]:
    """(text to compare, text to show): names, their Latin spelling (shown as the real name)
    and aliases."""
    texts = [(t.name, t.name) for t in translations]
    texts += [(t.name_latin, t.name) for t in translations if t.name_latin]
    texts += [(a, a) for a in aliases]
    return texts


def initials(name: str) -> str | None:
    """'Everest Base Camp Trek' -> 'EBC': how trekkers write trek names (the word Trek is left
    out). None for a one-word name."""
    words = [w for w in name.replace("-", " ").split() if w[:1].isalpha()]
    if words and words[-1].casefold() == "trek":
        words = words[:-1]
    return "".join(w[0] for w in words).upper() if len(words) > 1 else None


def _aliases(db: Session, place_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
    out: dict[uuid.UUID, list[str]] = {}
    ids = list(place_ids)
    if ids:
        rows = db.execute(
            select(PlaceAlias.place_id, PlaceAlias.alias).where(PlaceAlias.place_id.in_(ids))
        )
        for pid, alias in rows:
            out.setdefault(pid, []).append(alias)
    return out


def place_name_matches(db: Session, forms: list[str]) -> dict[uuid.UUID, Match]:
    """Places (trek villages too) whose name, Latin name or alias matches the query."""
    by_name = select(PlaceTranslation.place_id.label("pid")).where(
        or_(
            _text_match(PlaceTranslation.name, forms),
            _text_match(PlaceTranslation.name_latin, forms),
        )
    )
    by_alias = select(PlaceAlias.place_id.label("pid")).where(_text_match(PlaceAlias.alias, forms))
    matches = union_all(by_name, by_alias).subquery()
    ids = set(db.scalars(select(matches.c.pid).distinct()))
    if not ids:
        return {}
    places = db.scalars(select(Place).where(Place.id.in_(ids), published_places())).all()
    aliases = _aliases(db, ids)
    out = {}
    for place in places:
        m = best_match(forms, _name_texts(place.translations, aliases.get(place.id, [])))
        if m and m.score >= MIN_SCORE:
            out[place.id] = m
    return out


def area_matches(db: Session, forms: list[str]) -> dict[uuid.UUID, tuple[Area, Match]]:
    """Areas (cities, trek regions) whose English or Nepali name or another name matches.
    There are only a few areas, so they are compared in Python without a database step."""
    out = {}
    for area in db.scalars(select(Area)):
        texts = [(area.name_en, area.name_en), (area.name_ne, area.name_en)]
        texts += [(n, area.name_en) for n in area.other_names]
        m = best_match(forms, texts)
        if m:
            out[area.id] = (area, Match(m.score * AREA_WEIGHT, m.shown))
    return out


def _category_match(forms: list[str], category: Category) -> Match | None:
    texts = [(t.name, t.name) for t in category.translations]
    texts.append((category.code.replace("_", " "), category.code))
    m = best_match(forms, texts)
    return Match(m.score * CATEGORY_WEIGHT, m.shown) if m else None


def search_places(db: Session, q: str, lang: Lang, limit: int) -> list[SearchHit]:
    forms = query_forms(q)
    by_name = place_name_matches(db, forms)

    # Places in a matching district or category
    district_ids = set(
        db.scalars(select(Place.id).where(published_places(), _text_match(Place.district, forms)))
    )
    category_ids = set(
        db.scalars(
            select(Place.id)
            .join(Category, Place.category_id == Category.id)
            .join(CategoryTranslation, CategoryTranslation.category_id == Category.id)
            .where(
                published_places(),
                or_(
                    _text_match(CategoryTranslation.name, forms),
                    _text_match(func.replace(Category.code, "_", " "), forms),
                ),
            )
        )
    )
    areas = area_matches(db, forms)
    area_ids = (
        set(db.scalars(select(Place.id).where(published_places(), Place.area_id.in_(areas))))
        if areas
        else set()
    )
    ids = set(by_name) | district_ids | category_ids | area_ids
    if not ids:
        return []
    places = db.scalars(select(Place).where(Place.id.in_(ids), published_places())).all()

    hits = []
    for place in places:
        options: list[tuple[Match, str]] = []
        if place.id in by_name:
            options.append((by_name[place.id], "name"))
        if place.id in district_ids and place.district:
            m = best_match(forms, [(place.district, place.district)])
            if m:
                options.append((Match(m.score * DISTRICT_WEIGHT, m.shown), "district"))
        if place.area_id in areas:
            options.append((areas[place.area_id][1], "area"))
        if place.id in category_ids:
            m = _category_match(forms, place.category)
            if m:
                options.append((m, "category"))
        if not options:
            continue
        match, kind = max(options, key=lambda o: o[0].score)
        if match.score < MIN_SCORE:
            continue
        hits.append(
            SearchHit(
                type="place",
                id=place.id,
                name=pick_one(place.translations, lang),
                subtitle=pick_one(place.category.translations, lang),
                score=round(match.score, 3),
                matched=match.shown,
                match=kind,
                category=category_out(place.category, lang),
                district=place.district,
                area=place.area.name(lang) if place.area else None,
            )
        )
    # Same score (e.g. every place in a district): main sights before trek villages
    hits.sort(key=lambda h: (-h.score, h.category.code == "village", h.name))
    return hits[:limit]


def search_treks(db: Session, q: str, lang: Lang, limit: int) -> list[SearchHit]:
    forms = query_forms(q)
    by_name = set(
        db.scalars(
            select(TrekTranslation.trek_id)
            .where(
                or_(
                    _text_match(TrekTranslation.name, forms),
                    _text_match(TrekTranslation.name_latin, forms),
                )
            )
            .distinct()
        )
    )
    # Treks whose initials match ("ebc"): only short queries can be initials
    if any(len(normalise(q)) <= MAX_INITIALS for q in forms):
        names = db.execute(
            select(TrekTranslation.trek_id, TrekTranslation.name).where(
                TrekTranslation.lang == Lang.en
            )
        )
        by_name |= {
            tid
            for tid, name in names
            if (short := initials(name)) and best_match(forms, [(short, short)])
        }
    # Treks that pass through a matching village
    villages = place_name_matches(db, forms)
    by_village = set()
    if villages:
        by_village = set(
            db.scalars(
                select(TrekStage.trek_id)
                .where(
                    or_(
                        TrekStage.from_place_id.in_(villages),
                        TrekStage.to_place_id.in_(villages),
                    )
                )
                .distinct()
            )
        )
    # Treks in a matching trek region ("khumbu", "annapurna region"): area code = trek region
    areas = {a.code: m for a, m in area_matches(db, forms).values()}
    region_areas = {a.code: a for a in db.scalars(select(Area))} if areas else {}
    by_region = (
        set(
            db.scalars(select(Trek.id).where(published_treks(), func.lower(Trek.region).in_(areas)))
        )
        if areas
        else set()
    )
    ids = by_name | by_village | by_region
    if not ids:
        return []
    treks = db.scalars(
        select(Trek)
        .where(Trek.id.in_(ids), published_treks())
        .options(
            selectinload(Trek.stages).selectinload(TrekStage.from_place),
            selectinload(Trek.stages).selectinload(TrekStage.to_place),
        )
    ).all()

    hits = []
    for trek in treks:
        options: list[tuple[Match, str, Place | None]] = []
        short = [i for t in trek.translations if t.lang == Lang.en and (i := initials(t.name))]
        name = best_match(forms, _name_texts(trek.translations, short))
        if name:
            options.append((name, "name", None))
        region = trek.region.casefold()
        if region in areas:
            options.append((areas[region], "area", None))
        stops = {s.from_place_id: s.from_place for s in trek.stages}
        stops |= {s.to_place_id: s.to_place for s in trek.stages}
        for pid, village in stops.items():
            if pid in villages:
                m = villages[pid]
                options.append((Match(m.score * VIA_WEIGHT, m.shown), "via", village))
        if not options:
            continue
        match, kind, village = max(options, key=lambda o: o[0].score)
        if match.score < MIN_SCORE:
            continue
        hits.append(
            SearchHit(
                type="trek",
                id=trek.id,
                name=pick_one(trek.translations, lang),
                subtitle=f"{trek.region} · {trek.total_days}d",
                score=round(match.score, 3),
                matched=match.shown,
                match=kind,
                region=trek.region,
                total_days=trek.total_days,
                via=pick_one(village.translations, lang) if village else None,
                area=(region_areas[trek.region.casefold()].name(lang) if kind == "area" else None),
            )
        )
    hits.sort(key=lambda h: (-h.score, h.name))
    return hits[:limit]
