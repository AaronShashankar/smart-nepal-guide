"""Localisation rule, written once and used everywhere.

1. Read the `Accept-Language` header (`en` or `ne`, e.g. "ne-NP,ne;q=0.9,en;q=0.8").
2. Pick the matching *_translation row.
3. Fall back to English if the Nepali row (or a single field in it) is missing.
"""

from collections.abc import Iterable
from typing import Any

from fastapi import Header

from app.models.enums import Lang

DEFAULT_LANG = Lang.en


def parse_accept_language(header: str | None) -> Lang:
    if not header:
        return DEFAULT_LANG
    # Respect the order/q-values roughly: first supported language wins.
    ranked: list[tuple[float, str]] = []
    for i, part in enumerate(header.split(",")):
        piece = part.strip()
        if not piece:
            continue
        code, _, params = piece.partition(";")
        q = 1.0
        if params.strip().startswith("q="):
            try:
                q = float(params.strip()[2:])
            except ValueError:
                q = 0.0
        ranked.append((-q + i * 1e-6, code.strip().lower().split("-")[0]))
    for _, code in sorted(ranked):
        if code in Lang.__members__:
            return Lang(code)
    return DEFAULT_LANG


def get_lang(accept_language: str | None = Header(default=None)) -> Lang:
    """FastAPI dependency: the language requested by the client."""
    return parse_accept_language(accept_language)


def pick(translations: Iterable[Any], lang: Lang, *fields: str) -> dict[str, Any]:
    """Return the requested fields from the best translation row.

    Uses the row for `lang`; any field that is missing (no row, or NULL/empty)
    falls back to the English row.
    """
    by_lang = {t.lang: t for t in translations}
    wanted = by_lang.get(lang)
    english = by_lang.get(DEFAULT_LANG)
    out: dict[str, Any] = {}
    for field in fields:
        value = getattr(wanted, field, None) if wanted is not None else None
        if value in (None, "") and english is not None:
            value = getattr(english, field, None)
        out[field] = value
    return out


def pick_one(translations: Iterable[Any], lang: Lang, field: str = "name") -> Any:
    return pick(translations, lang, field)[field]
