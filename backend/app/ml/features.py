"""Feature encoding shared by dataset generation, training and serving.

The 9 inputs from phase2.md become 10 model features: `month` is turned into two flags
(winter = Dec-Feb, monsoon = Jun-Aug), because the risk of a month is not ordered
(December and January are risky but far apart as numbers). Categories become ordered numbers.
"""

from dataclasses import asdict, dataclass

import numpy as np

LABELS = ("easy", "moderate", "hard", "risky")
FITNESS = {"low": 0, "medium": 1, "high": 2}
EXPERIENCE = {"none": 0, "beginner": 1, "experienced": 2}
WINTER_MONTHS = (12, 1, 2)
MONSOON_MONTHS = (6, 7, 8)

FEATURES = (
    "max_altitude_m",
    "max_daily_gain_m",
    "total_days",
    "distance_per_day_km",
    "winter",
    "monsoon",
    "age",
    "fitness_level",
    "trek_experience",
    "has_health_issue",
)


@dataclass
class Sample:
    """One row of training_sample / one prediction input (raw, human-readable values)."""

    max_altitude_m: int
    max_daily_gain_m: int
    total_days: int
    distance_per_day_km: float
    month: int
    age: int
    fitness_level: str  # low / medium / high
    trek_experience: str  # none / beginner / experienced
    has_health_issue: bool

    def as_dict(self) -> dict:
        return asdict(self)


def encode(s: Sample) -> list[float]:
    return [
        float(s.max_altitude_m),
        float(s.max_daily_gain_m),
        float(s.total_days),
        float(s.distance_per_day_km),
        float(s.month in WINTER_MONTHS),
        float(s.month in MONSOON_MONTHS),
        float(s.age),
        float(FITNESS[s.fitness_level]),
        float(EXPERIENCE[s.trek_experience]),
        float(bool(s.has_health_issue)),
    ]


def encode_many(samples: list[Sample]) -> np.ndarray:
    return np.array([encode(s) for s in samples], dtype=float)


def label_index(label: str) -> int:
    return LABELS.index(label)
