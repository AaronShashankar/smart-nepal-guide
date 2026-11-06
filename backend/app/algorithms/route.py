"""Trip planner: visiting order + day split (algorithm.md, core algorithm 3).

1. Distance matrix with the Haversine formula (straight-line km between places).
2. Nearest neighbour: start at the user's location (or the first place) and always go to the
   closest place not yet visited.
3. 2-opt: reverse a part of the route whenever that makes the total shorter; repeat until no
   reversal helps. The route is an open path (we do not return to the start).
4. Greedy day split: walk along the route adding travel time + visit time; start a new day when
   the day would pass `max_hours`.
   travel time (h) = distance (km) x ROAD_FACTOR / AVERAGE_SPEED_KMH
For up to 8 places, `brute_force` tries every order and gives the exact shortest route, so the
report can show how far the heuristic is from the best answer.
"""

from dataclasses import dataclass, field
from itertools import permutations

from app.algorithms.haversine import haversine_km

ROAD_FACTOR = 1.4  # roads are ~40% longer than the straight line
AVERAGE_SPEED_KMH = 25.0  # Kathmandu valley / hill roads
MAX_HOURS_PER_DAY = 8.0
BRUTE_FORCE_LIMIT = 8

Point = tuple[float, float]  # (latitude, longitude)
Matrix = list[list[float]]


def distance_matrix(points: list[Point]) -> Matrix:
    n = len(points)
    m = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            m[i][j] = m[j][i] = haversine_km(*points[i], *points[j])
    return m


def route_length(route: list[int], matrix: Matrix) -> float:
    return sum(matrix[a][b] for a, b in zip(route, route[1:], strict=False))


def nearest_neighbour(matrix: Matrix, start: int = 0) -> list[int]:
    n = len(matrix)
    if n == 0:
        return []
    route, left = [start], set(range(n)) - {start}
    while left:
        here = route[-1]
        nxt = min(left, key=lambda j: (matrix[here][j], j))
        route.append(nxt)
        left.remove(nxt)
    return route


def two_opt(route: list[int], matrix: Matrix, fixed_start: bool = True) -> list[int]:
    """Improve an open path by reversing segments route[i..j] while it gets shorter.

    With `fixed_start` the first node (e.g. the user's location) never moves.
    Reversing route[i..j] only changes the edge into i and the edge out of j, because the
    distances are symmetric, so each try costs O(1).
    """
    route = list(route)
    n = len(route)
    first = 1 if fixed_start else 0
    improved = True
    while improved:
        improved = False
        for i in range(first, n - 1):
            for j in range(i + 1, n):
                before = after = 0.0
                if i > 0:
                    before += matrix[route[i - 1]][route[i]]
                    after += matrix[route[i - 1]][route[j]]
                if j < n - 1:
                    before += matrix[route[j]][route[j + 1]]
                    after += matrix[route[i]][route[j + 1]]
                if after < before - 1e-9:
                    route[i : j + 1] = reversed(route[i : j + 1])
                    improved = True
    return route


def brute_force(matrix: Matrix, start: int | None = 0) -> list[int]:
    """Exact shortest open path by trying every order (only for small n)."""
    n = len(matrix)
    if n > BRUTE_FORCE_LIMIT + 1:
        raise ValueError(f"brute force is limited to {BRUTE_FORCE_LIMIT} places")
    if n == 0:
        return []
    if start is None:
        candidates = (list(p) for p in permutations(range(n)))
    else:
        rest = [i for i in range(n) if i != start]
        candidates = ([start, *p] for p in permutations(rest))
    return min(candidates, key=lambda r: route_length(r, matrix))


def travel_hours(km: float) -> float:
    return km * ROAD_FACTOR / AVERAGE_SPEED_KMH


@dataclass
class Day:
    day_no: int
    stops: list[int] = field(default_factory=list)  # indices into the stop list
    km: float = 0.0  # straight-line km travelled this day
    travel_hours: float = 0.0
    visit_hours: float = 0.0

    @property
    def hours(self) -> float:
        return self.travel_hours + self.visit_hours


def split_days(
    order: list[int],
    leg_km: list[float],
    visit_hours: list[float],
    max_hours: float = MAX_HOURS_PER_DAY,
) -> list[Day]:
    """Greedy day split.

    order[k] is the k-th stop to visit, leg_km[k] the straight-line km to reach it (from the
    previous stop, or from the start for k = 0) and visit_hours[order[k]] its visit time.
    A stop always goes on the current day if the day is still empty, even if it is long.
    """
    days: list[Day] = []
    day = Day(1)
    for k, stop in enumerate(order):
        travel = travel_hours(leg_km[k])
        visit = visit_hours[stop]
        if day.stops and day.hours + travel + visit > max_hours:
            days.append(day)
            day = Day(day.day_no + 1)
        day.stops.append(stop)
        day.km += leg_km[k]
        day.travel_hours += travel
        day.visit_hours += visit
    if day.stops:
        days.append(day)
    return days


@dataclass
class Plan:
    order: list[int]  # stop indices in visiting order
    days: list[Day]
    total_km: float  # straight-line km along the route (from the start location if given)
    nearest_neighbour_km: float  # before 2-opt, to show the improvement


def plan_trip(
    stops: list[Point],
    visit_hours: list[float],
    start: Point | None = None,
    max_hours: float = MAX_HOURS_PER_DAY,
) -> Plan:
    """Order the stops (nearest neighbour + 2-opt) and split them into days."""
    if not stops:
        return Plan([], [], 0.0, 0.0)
    # With a start location it becomes node 0 of the matrix and stays first. Without one,
    # nearest neighbour starts at the first place added, and 2-opt may move the start too.
    points = [start, *stops] if start else list(stops)
    matrix = distance_matrix(points)
    nn = nearest_neighbour(matrix, 0)
    best = two_opt(nn, matrix, fixed_start=start is not None)
    offset = 1 if start else 0
    order = [i - offset for i in best if i >= offset]
    legs = [matrix[a][b] for a, b in zip(best, best[1:], strict=False)]
    if not start:
        legs = [0.0, *legs]  # nothing to travel to the first stop
    return Plan(
        order=order,
        days=split_days(order, legs, visit_hours, max_hours),
        total_km=route_length(best, matrix),
        nearest_neighbour_km=route_length(nn, matrix),
    )
