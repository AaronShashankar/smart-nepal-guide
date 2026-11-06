"""Acclimatisation checker: a rule-based system (algorithm.md, core algorithm 4).

Standard high-altitude guidance (Wilderness Medical Society / CDC Yellow Book), applied to
*sleeping* altitude, i.e. the altitude of the place where each day ends:

1. Above 3,000 m, a day that raises the sleeping altitude by more than 500 m gets a
   `caution` (code GAIN_OVER_500). Real itineraries do this often (Phakding → Namche is +830 m),
   so on its own it is not a failure.
2. Above 3,000 m, take a rest day for every ~1,000 m gained. We add up the sleeping-altitude
   gain above 3,000 m since the last rest day. A day that pushes this total past 1,000 m is
   `danger` (code NEEDS_REST) and we suggest a rest day the night before it. After the
   suggestion we assume the rest day was taken and start counting again.
3. A rest day (from == to) resets the total (code REST_DAY).

An itinerary "passes" when no day is `danger`.
"""

from dataclasses import dataclass, field
from enum import StrEnum

ACCLIMATISATION_START_M = 3000
MAX_DAILY_GAIN_M = 500
REST_EVERY_M = 1000


class Status(StrEnum):
    ok = "ok"
    caution = "caution"
    danger = "danger"


_RANK = {Status.ok: 0, Status.caution: 1, Status.danger: 2}


class Code(StrEnum):
    GAIN_OVER_500 = "GAIN_OVER_500"
    NEEDS_REST = "NEEDS_REST"
    REST_DAY = "REST_DAY"


@dataclass
class StageAltitude:
    day: int
    from_altitude_m: int  # where the previous night was spent
    to_altitude_m: int  # where this night is spent
    is_rest_day: bool = False
    from_name: str = ""  # used for the rest-day suggestion text


@dataclass
class DayCheck:
    day: int
    status: Status
    gain_m: int
    codes: list[Code] = field(default_factory=list)


@dataclass
class RestSuggestion:
    before_day: int  # add a rest day before this day ...
    place: str  # ... at this place (where the previous night was spent)
    altitude_m: int


@dataclass
class AcclimatisationReport:
    status: Status
    days: list[DayCheck]
    suggested_rest_days: list[RestSuggestion]

    @property
    def passes(self) -> bool:
        return self.status != Status.danger


def gain_above(start_m: int, from_m: int, to_m: int) -> int:
    """The part of a climb from `from_m` to `to_m` that is above `start_m` (0 if descending)."""
    return max(0, to_m - max(from_m, start_m))


def check_acclimatisation(stages: list[StageAltitude]) -> AcclimatisationReport:
    days: list[DayCheck] = []
    suggestions: list[RestSuggestion] = []
    since_rest = 0  # sleeping-altitude gain above 3,000 m since the last rest day

    for s in stages:
        gain = s.to_altitude_m - s.from_altitude_m
        check = DayCheck(day=s.day, status=Status.ok, gain_m=gain)
        if s.is_rest_day:
            check.codes.append(Code.REST_DAY)
            since_rest = 0
            days.append(check)
            continue

        if s.to_altitude_m > ACCLIMATISATION_START_M and gain > MAX_DAILY_GAIN_M:
            check.status = Status.caution
            check.codes.append(Code.GAIN_OVER_500)

        climb = gain_above(ACCLIMATISATION_START_M, s.from_altitude_m, s.to_altitude_m)
        if since_rest + climb > REST_EVERY_M:
            check.status = Status.danger
            check.codes.append(Code.NEEDS_REST)
            suggestions.append(RestSuggestion(s.day, s.from_name, s.from_altitude_m))
            since_rest = climb  # assume the suggested rest day is taken
        else:
            since_rest += climb
        days.append(check)

    worst = max((d.status for d in days), key=_RANK.__getitem__, default=Status.ok)
    return AcclimatisationReport(status=worst, days=days, suggested_rest_days=suggestions)
