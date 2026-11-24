"""Search quality test set (V2-SR-10): does the right place or trek come up, and how high?

    uv run python -m app.search_benchmark  # writes backend/docs/benchmarks/search_quality.md

Each case is a query someone could really type, and the place or trek that should come back.
For each case we look up the expected item's position (rank) in the results of its type:

- hit@1: share of cases where it is first;  hit@3: share where it is in the top 3;
- MRR (mean reciprocal rank): the average of 1/rank (1 = always first; 0 if not found).

"No result" cases are words that are not in the data: they pass only when nothing comes back,
which checks that fuzzy matching does not find something for every word.
The same cases run in pytest (tests/test_search_quality.py), so a change that makes search
worse fails the build.
"""

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.enums import Lang
from app.services.search import search_places, search_treks

OUT = Path(__file__).resolve().parents[1] / "docs" / "benchmarks" / "search_quality.md"
LIMIT = 10
# The same cases run once against the search code before V2 (plain Levenshtein on names only,
# MIN_SCORE 0.6, no transliteration / district / category / village / initials), 2026-11-23.
BEFORE_V2 = {"hit@1": 0.604, "hit@3": 0.604, "mrr": 0.604, "no_result_ok": 0.667}  # all 51 cases


@dataclass(frozen=True)
class Case:
    group: str
    query: str
    kind: str  # "place" | "trek" | "none"
    expected: str = ""  # English name of the item that should be found


CASES = [
    # Spelling mistakes in English names
    Case("Typo", "punhill", "place", "Poon Hill"),
    Case("Typo", "anapurna base camp", "place", "Annapurna Base Camp"),
    Case("Typo", "swayambu", "place", "Swayambhunath Stupa"),
    Case("Typo", "pashupatinat", "place", "Pashupatinath Temple"),
    Case("Typo", "chitwan natinal park", "place", "Chitwan National Park"),
    Case("Typo", "lumbni", "place", "Lumbini (Maya Devi Temple)"),
    Case("Typo", "gosainkund", "place", "Gosaikunda Lake"),
    Case("Typo", "nagarkott", "place", "Nagarkot"),
    Case("Typo", "sarangot", "place", "Sarangkot"),
    Case("Typo", "kala pathar", "place", "Kala Patthar"),
    Case("Typo", "namche bazar", "place", "Namche Bazaar"),
    Case("Typo", "muktinat", "place", "Muktinath Temple"),
    # Nepali words typed in English letters (transliteration)
    Case("Romanised Nepali", "pashupati mandir", "place", "Pashupatinath Temple"),
    Case("Romanised Nepali", "bhaktapur darbar", "place", "Bhaktapur Durbar Square"),
    Case("Romanised Nepali", "phewa tal", "place", "Phewa Lake"),
    Case("Romanised Nepali", "rara tal", "place", "Rara Lake"),
    Case("Romanised Nepali", "sagarmatha", "place", "Everest Base Camp"),
    Case("Romanised Nepali", "chitwan nikunja", "place", "Chitwan National Park"),
    Case("Romanised Nepali", "shanti stupa", "place", "World Peace Pagoda"),
    Case("Romanised Nepali", "sagarmatha padayatra", "trek", "Everest Base Camp Trek"),
    # Devanagari
    Case("Devanagari", "अन्नपूर्ण", "place", "Annapurna Base Camp"),
    Case("Devanagari", "पुन हिल", "place", "Poon Hill"),
    Case("Devanagari", "नामचे", "place", "Namche Bazaar"),
    Case("Devanagari", "लुम्बिनी", "place", "Lumbini (Maya Devi Temple)"),
    Case("Devanagari", "स्वयम्भू", "place", "Swayambhunath Stupa"),
    Case("Devanagari", "लाङटाङ", "trek", "Langtang Valley Trek"),
    # Treks by name, by initials and by a village on the way
    Case("Trek", "ebc", "trek", "Everest Base Camp Trek"),
    Case("Trek", "abc", "trek", "Annapurna Base Camp Trek"),
    Case("Trek", "poon hill trek", "trek", "Ghorepani Poon Hill Trek"),
    Case("Trek", "langtang", "trek", "Langtang Valley Trek"),
    Case("Trek", "mardi", "trek", "Mardi Himal Trek"),
    Case("Trek", "manaslu", "trek", "Manaslu Circuit Trek"),
    Case("Trek via village", "namche", "trek", "Everest Base Camp Trek"),
    Case("Trek via village", "thorong la", "trek", "Annapurna Circuit Trek"),
    Case("Trek via village", "kyanjin", "trek", "Langtang Valley Trek"),
    Case("Trek via village", "samagaun", "trek", "Manaslu Circuit Trek"),
    # District and category
    Case("District", "bhaktapur", "place", "Changu Narayan Temple"),
    Case("District", "kaski", "place", "Phewa Lake"),
    Case("Category", "heritage", "place", "Patan Durbar Square"),
    Case("Category", "viewpoint", "place", "Annapurna Base Camp"),  # ties: by name for now
    # Words that are not in the data: nothing should come back
    Case("No result", "zzqxw", "none"),
    # Cities and trek regions (areas, V2-SR-14): a place in the city, a trek in the region
    Case("City / area", "pokhara", "place", "Sarangkot"),
    Case("City / area", "pokhara", "place", "World Peace Pagoda"),
    Case("City / area", "पोखरा", "place", "Sarangkot"),
    Case("City / area", "kathmandu valley", "place", "Changu Narayan Temple"),
    Case("City / area", "khumbu", "trek", "Everest Base Camp Trek"),
    Case("City / area", "everest region", "trek", "Everest Base Camp Trek"),
    Case("City / area", "langtang region", "trek", "Langtang Valley Trek"),
    Case("City / area", "manaslu region", "trek", "Manaslu Circuit Trek"),
    Case("No result", "thamel", "none"),
    Case("No result", "london", "none"),
]


@dataclass
class Result:
    case: Case
    rank: int | None  # 1-based position of the expected item; None = not found
    top: str  # what came first (or "—")

    @property
    def passed(self) -> bool:
        if self.case.kind == "none":
            return self.top == "—"
        return self.rank is not None and self.rank <= 3


def run_case(db: Session, case: Case) -> Result:
    places = search_places(db, case.query, Lang.en, LIMIT)
    treks = search_treks(db, case.query, Lang.en, LIMIT)
    if case.kind == "none":
        first = (places or treks or [None])[0]
        return Result(case, None, first.name if first else "—")
    hits = places if case.kind == "place" else treks
    names = [h.name for h in hits]
    rank = names.index(case.expected) + 1 if case.expected in names else None
    return Result(case, rank, names[0] if names else "—")


def run(db: Session) -> list[Result]:
    return [run_case(db, c) for c in CASES]


def metrics(results: list[Result]) -> dict[str, float]:
    found = [r for r in results if r.case.kind != "none"]
    none = [r for r in results if r.case.kind == "none"]
    n = len(found) or 1
    return {
        "cases": len(results),
        "hit@1": sum(r.rank == 1 for r in found) / n,
        "hit@3": sum(r.rank is not None and r.rank <= 3 for r in found) / n,
        "mrr": sum(1 / r.rank for r in found if r.rank) / n,
        "no_result_ok": sum(r.passed for r in none) / (len(none) or 1),
    }


def report(results: list[Result]) -> str:
    m = metrics(results)
    b = BEFORE_V2
    lines = [
        "# Search quality",
        "",
        "*Generated by `cd backend && uv run python -m app.search_benchmark` (do not edit by "
        "hand). The cases are in `backend/app/search_benchmark.py`; pytest runs the same cases.*",
        "",
        f"{m['cases']} queries. For the {m['cases'] - 3} queries with an expected result, rank "
        "= where that item comes in the results of its type (places or treks).",
        "",
        "| Measure | Before V2 | Now |",
        "|---|---|---|",
        f"| hit@1 (expected item first) | {b['hit@1']:.0%} | {m['hit@1']:.0%} |",
        f"| hit@3 (expected item in the top 3) | {b['hit@3']:.0%} | {m['hit@3']:.0%} |",
        f"| MRR (mean of 1 / rank) | {b['mrr']:.3f} | {m['mrr']:.3f} |",
        f'| "No result" queries that really return nothing | {b["no_result_ok"]:.0%} '
        f"| {m['no_result_ok']:.0%} |",
        "",
        "| Group | Query | Expected | Rank | First result | Pass |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        expected = r.case.expected or "nothing"
        rank = str(r.rank) if r.rank else "—"
        mark = "✓" if r.passed else "✗"
        lines.append(
            f"| {r.case.group} | `{r.case.query}` | {expected} | {rank} | {r.top} | {mark} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    from app.core.db import SessionLocal

    with SessionLocal() as db:
        results = run(db)
    OUT.write_text(report(results), encoding="utf-8")
    m = metrics(results)
    print(f"hit@1 {m['hit@1']:.0%}, hit@3 {m['hit@3']:.0%}, MRR {m['mrr']:.3f} -> {OUT}")
    for r in results:
        if not r.passed:
            print(f"  FAIL {r.case.query!r}: expected {r.case.expected or 'nothing'}, "
                  f"rank {r.rank}, first {r.top}")  # fmt: skip


if __name__ == "__main__":
    main()
