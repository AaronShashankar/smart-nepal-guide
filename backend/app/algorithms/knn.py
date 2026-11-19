"""K-nearest neighbours over trek feature vectors (written by hand; NumPy is not needed here).

1. Min-max normalisation scales every feature to 0-1 over all vectors, so that metres
   (thousands) don't swamp days (tens):  x' = (x - min) / (max - min).
   A feature with the same value everywhere becomes 0 for every vector.
2. Euclidean distance:  d(a, b) = sqrt(sum((a_i - b_i)^2)).
3. The K nearest: sort the others by their distance to the target and keep the first K.
"""

from math import sqrt

Vector = list[float]


def normalise(vectors: list[Vector]) -> list[Vector]:
    """Min-max scale each column of `vectors` to 0-1."""
    if not vectors:
        return []
    columns = list(zip(*vectors, strict=True))
    lows = [min(c) for c in columns]
    spans = [max(c) - lo for c, lo in zip(columns, lows, strict=True)]
    return [
        [(x - lo) / span if span else 0.0 for x, lo, span in zip(v, lows, spans, strict=True)]
        for v in vectors
    ]


def euclidean(a: Vector, b: Vector) -> float:
    if len(a) != len(b):
        raise ValueError("vectors must have the same length")
    return sqrt(sum((x - y) ** 2 for x, y in zip(a, b, strict=True)))


def k_nearest(target: Vector, others: list[Vector], k: int) -> list[tuple[int, float]]:
    """(index in `others`, distance) of the k vectors nearest to `target`, nearest first.

    Ties keep the order of `others`, so the result is the same on every run.
    """
    distances = [(i, euclidean(target, v)) for i, v in enumerate(others)]
    distances.sort(key=lambda pair: pair[1])
    return distances[: max(k, 0)]
