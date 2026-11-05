import pytest

from app.algorithms.best_time import MonthClimate, best_months, month_score
from app.algorithms.haversine import haversine_km, nearest
from app.algorithms.levenshtein import levenshtein, similarity
from app.core.i18n import parse_accept_language
from app.models.enums import Lang

KATHMANDU = (27.7172, 85.3240)
POKHARA = (28.2096, 83.9856)


def test_haversine_kathmandu_pokhara():
    # Straight-line distance is about 143-145 km (the road is ~200 km).
    assert haversine_km(*KATHMANDU, *POKHARA) == pytest.approx(145, abs=3)


def test_haversine_zero_and_symmetric():
    assert haversine_km(*KATHMANDU, *KATHMANDU) == 0
    assert haversine_km(*KATHMANDU, *POKHARA) == pytest.approx(haversine_km(*POKHARA, *KATHMANDU))


def test_nearest_orders_by_distance():
    items = [("pokhara", *POKHARA), ("bhaktapur", 27.6710, 85.4298), ("lumbini", 27.4697, 83.2757)]
    result = nearest(KATHMANDU, items, k=2)
    assert [name for name, _ in result] == ["bhaktapur", "pokhara"]


@pytest.mark.parametrize(
    ("a", "b", "d"),
    [
        ("", "", 0),
        ("abc", "", 3),
        ("kitten", "sitting", 3),
        ("anapurna", "annapurna", 1),
        ("punhill", "poonhill", 2),
        ("नेपाल", "नेपाल", 0),
    ],
)
def test_levenshtein(a, b, d):
    assert levenshtein(a, b) == d
    assert levenshtein(b, a) == d


def test_similarity_matches_word_runs():
    assert similarity("anapurna", "Annapurna Base Camp") > 0.85
    assert similarity("poon hill", "Poon Hill") == 1.0
    assert similarity("xyz", "Poon Hill") < 0.3


def test_best_months_prefers_dry_clear_months():
    climate = [
        MonthClimate(m, 18, 300 if m in (6, 7, 8) else 10, 9 if m in (10, 11) else 5)
        for m in range(1, 13)
    ]
    top = best_months(climate)
    assert 10 in top and 11 in top
    assert not {6, 7, 8} & set(top)
    assert best_months([]) == []
    assert month_score(MonthClimate(7, 18, 400, 2)) < month_score(MonthClimate(11, 18, 0, 10))


@pytest.mark.parametrize(
    ("header", "lang"),
    [
        (None, Lang.en),
        ("ne", Lang.ne),
        ("ne-NP,ne;q=0.9,en;q=0.8", Lang.ne),
        ("fr-FR,ne;q=0.5", Lang.ne),
        ("en;q=0.4,ne;q=0.9", Lang.ne),
        ("de", Lang.en),
    ],
)
def test_parse_accept_language(header, lang):
    assert parse_accept_language(header) == lang
