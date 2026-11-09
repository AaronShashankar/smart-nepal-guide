"""Bayesian average rating (algorithm.md, Version 2 Phase 2).

score = (C · m + Σ ratings) / (C + n)

- n: number of visible reviews of this item
- m: mean rating over all visible reviews in the app
- C: how many "average" reviews every item starts with (5)

With few reviews the score stays near m; with many it moves to the item's own average, so one
5★ review (4.17 when m = 4.0) does not beat twenty reviews averaging 4.6★ (4.48).
"""

PRIOR_WEIGHT = 5  # C
DEFAULT_GLOBAL_MEAN = 3.0  # m before the app has any review: the middle of 1..5


def bayesian_average(
    rating_sum: float, n: int, global_mean: float, c: float = PRIOR_WEIGHT
) -> float:
    if n < 0 or c < 0 or c + n == 0:
        raise ValueError("need n >= 0, c >= 0 and c + n > 0")
    return (c * global_mean + rating_sum) / (c + n)
