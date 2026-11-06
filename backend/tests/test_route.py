import random

import pytest

from app.algorithms.route import (
    brute_force,
    distance_matrix,
    nearest_neighbour,
    plan_trip,
    route_length,
    split_days,
    travel_hours,
    two_opt,
)

# Kathmandu valley demo trip (lat, lng), from data/places.csv
VALLEY = {
    "pashupatinath": (27.7104, 85.3488),
    "boudhanath": (27.7215, 85.3620),
    "swayambhunath": (27.7149, 85.2904),
    "patan_durbar": (27.6727, 85.3253),
    "bhaktapur_durbar": (27.6722, 85.4280),
    "nagarkot": (27.7172, 85.5200),
}


def random_points(n: int, seed: int) -> list[tuple[float, float]]:
    rng = random.Random(seed)
    return [(27.5 + rng.random() * 0.5, 85.1 + rng.random() * 0.6) for _ in range(n)]


def test_distance_matrix_symmetric_zero_diagonal():
    m = distance_matrix(list(VALLEY.values()))
    assert all(m[i][i] == 0 for i in range(len(m)))
    assert all(m[i][j] == m[j][i] for i in range(len(m)) for j in range(len(m)))


def test_nearest_neighbour_visits_every_place_once():
    m = distance_matrix(random_points(7, 1))
    route = nearest_neighbour(m, start=3)
    assert route[0] == 3 and sorted(route) == list(range(7))


def test_two_opt_untangles_a_crossing():
    # Square corners visited 0 -> 2 -> 1 -> 3 crosses itself; 2-opt fixes it.
    pts = [(0.0, 0.0), (0.0, 0.1), (0.1, 0.1), (0.1, 0.0)]
    m = distance_matrix(pts)
    crossed = [0, 2, 1, 3]
    fixed = two_opt(crossed, m)
    assert route_length(fixed, m) < route_length(crossed, m)
    assert fixed[0] == 0


@pytest.mark.parametrize("seed", range(20))
def test_two_opt_never_worse_than_nearest_neighbour(seed):
    m = distance_matrix(random_points(7, seed))
    nn = nearest_neighbour(m, 0)
    improved = two_opt(nn, m)
    exact = brute_force(m, start=0)
    assert route_length(improved, m) <= route_length(nn, m) + 1e-9
    assert route_length(exact, m) <= route_length(improved, m) + 1e-9


def test_two_opt_gap_to_brute_force_is_small_on_average():
    gaps = []
    for seed in range(50):
        m = distance_matrix(random_points(7, seed))
        heuristic = route_length(two_opt(nearest_neighbour(m, 0), m), m)
        gaps.append(heuristic / route_length(brute_force(m, start=0), m) - 1)
    assert sum(gaps) / len(gaps) < 0.03  # measured: ~1.3% (see app.algorithms.route_benchmark)


def test_brute_force_limit():
    with pytest.raises(ValueError):
        brute_force(distance_matrix(random_points(12, 0)))


def test_split_days_greedy():
    # 3 stops of 3 h each, 10 km apart: day 1 fits two (3 + 0.56 + 3 h), the third starts day 2
    days = split_days([0, 1, 2], [0.0, 10.0, 10.0], [3.0, 3.0, 3.0], max_hours=8)
    assert [d.stops for d in days] == [[0, 1], [2]]
    assert days[0].hours == pytest.approx(6 + travel_hours(10))
    # A stop longer than a day still gets a day of its own.
    assert [d.stops for d in split_days([0], [0.0], [10.0], max_hours=8)] == [[0]]


def test_demo_trip_two_days():
    names = list(VALLEY)
    plan = plan_trip(list(VALLEY.values()), [1.5] * len(names))
    assert sorted(plan.order) == list(range(len(names)))
    assert len(plan.days) == 2
    assert plan.total_km <= plan.nearest_neighbour_km
    # Nagarkot (far east) is at an end of the route, not in the middle.
    assert names[plan.order[0]] == "nagarkot" or names[plan.order[-1]] == "nagarkot"


def test_start_location_stays_first():
    thamel = (27.7154, 85.3123)
    plan = plan_trip(list(VALLEY.values()), [1.5] * 6, start=thamel)
    # Swayambhunath is the closest stop to Thamel, so it comes first.
    assert list(VALLEY)[plan.order[0]] == "swayambhunath"


def test_empty_trip():
    plan = plan_trip([], [])
    assert plan.order == [] and plan.days == [] and plan.total_km == 0
