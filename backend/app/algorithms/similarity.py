"""Cosine similarity, written by hand (algorithm.md, Version 2 Phase 2).

cos θ = (A · B) / (‖A‖ ‖B‖)

1 means the vectors point the same way, 0 means they share nothing. Our vectors have no negative
values, so the result is always between 0 and 1. A zero vector has no direction: we return 0.
"""

import math
from collections.abc import Sequence


def dot(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) != len(b):
        raise ValueError("vectors must have the same length")
    return sum(x * y for x, y in zip(a, b, strict=True))


def norm(a: Sequence[float]) -> float:
    return math.sqrt(sum(x * x for x in a))


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    na, nb = norm(a), norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return dot(a, b) / (na * nb)
