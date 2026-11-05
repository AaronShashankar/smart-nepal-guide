"""Best time to visit: weighted scoring of each month (algorithm.md, Smart features).

score = 0.5 · rain_score + 0.3 · temperature_score + 0.2 · visibility_score, each in 0..1
"""

from dataclasses import dataclass

W_RAIN, W_TEMPERATURE, W_VISIBILITY = 0.5, 0.3, 0.2
COMFORT_FALLOFF_C = 25.0  # this many °C outside the comfort band scores 0
MAX_RAIN_MM = 400.0  # wettest monsoon month in our data
COMFORT_LOW_C, COMFORT_HIGH_C = 10.0, 22.0


@dataclass
class MonthClimate:
    month: int
    avg_temp_c: float | None
    rainfall_mm: float | None
    visibility_score: float | None  # 1..10


def month_score(c: MonthClimate) -> float:
    rain = 1 - min(c.rainfall_mm or 0.0, MAX_RAIN_MM) / MAX_RAIN_MM
    visibility = (c.visibility_score or 5) / 10
    temp = c.avg_temp_c
    if temp is None:
        comfort = 0.5
    elif COMFORT_LOW_C <= temp <= COMFORT_HIGH_C:
        comfort = 1.0
    else:
        gap = COMFORT_LOW_C - temp if temp < COMFORT_LOW_C else temp - COMFORT_HIGH_C
        comfort = max(0.0, 1 - gap / COMFORT_FALLOFF_C)
    return W_RAIN * rain + W_VISIBILITY * visibility + W_TEMPERATURE * comfort


def best_months(climate: list[MonthClimate], top: int = 3) -> list[int]:
    """The `top` best months (1..12), in calendar order."""
    if not climate:
        return []
    ranked = sorted(climate, key=lambda c: (-month_score(c), c.month))
    return sorted(c.month for c in ranked[:top])
