"""Packing checklist: a small rule-based expert system (V2 Phase 1, algorithm.md section 13).

Knowledge base: one rule per item (the packing_item table). A rule has up to three conditions:

    min_altitude_m  the trek's highest point is at least this high
    months          the chosen month is one of these
    min_days        the trek takes at least this many days

Inference (forward chaining over a flat rule table): an item is on the list when it is marked
`always`, or when *all* of its set conditions are true for the facts (trek + month). Every item
also gets the reason that fired, so the app can explain it ("because you go above 4,000 m").

Required permits are added as document items from the trek's own permits, so the checklist and the
permit section of the trek page always match.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from enum import StrEnum

WINTER_MONTHS = frozenset({12, 1, 2})
MONSOON_MONTHS = frozenset({6, 7, 8, 9})
PERMIT_GROUP = "documents"


class Reason(StrEnum):
    ALWAYS = "ALWAYS"  # every trek
    ALTITUDE = "ALTITUDE"  # value = the altitude threshold in metres
    WINTER = "WINTER"  # a winter month; value = altitude threshold if the rule also has one
    MONSOON = "MONSOON"  # a monsoon month
    LONG_TREK = "LONG_TREK"  # value = the minimum number of days
    PERMIT = "PERMIT"  # a permit this trek requires


@dataclass(frozen=True)
class Rule:
    code: str
    group: str
    sort_order: int = 0
    always: bool = False
    min_altitude_m: int | None = None
    months: tuple[int, ...] = ()
    min_days: int | None = None


@dataclass(frozen=True)
class Facts:
    """What we know about the trip: the trek's highest point and length, and the month."""

    max_altitude_m: int
    total_days: int
    month: int


@dataclass(frozen=True)
class Pick:
    code: str  # the rule's code, or "permit:<CODE>" for a permit
    group: str
    sort_order: int
    reason: Reason
    value: int | None = None


def fires(rule: Rule, facts: Facts) -> bool:
    """True when the item belongs on the list: `always`, or every set condition holds."""
    if rule.always:
        return True
    conditions = []
    if rule.min_altitude_m is not None:
        conditions.append(facts.max_altitude_m >= rule.min_altitude_m)
    if rule.months:
        conditions.append(facts.month in rule.months)
    if rule.min_days is not None:
        conditions.append(facts.total_days >= rule.min_days)
    return bool(conditions) and all(conditions)  # a rule with no condition never fires


def reason(rule: Rule) -> tuple[Reason, int | None]:
    """The explanation shown next to the item. The month condition is the most specific one,
    then altitude, then days."""
    if rule.always:
        return Reason.ALWAYS, None
    if rule.months:
        if set(rule.months) <= MONSOON_MONTHS:
            return Reason.MONSOON, None
        return Reason.WINTER, rule.min_altitude_m
    if rule.min_altitude_m is not None:
        return Reason.ALTITUDE, rule.min_altitude_m
    return Reason.LONG_TREK, rule.min_days


def packing_list(rules: Iterable[Rule], facts: Facts, permit_codes: Sequence[str]) -> list[Pick]:
    """Every item whose rule fires, plus one document item per required permit.

    Sorted by the rule's sort_order inside each group (the group order is up to the caller).
    """
    if not 1 <= facts.month <= 12:
        raise ValueError(f"month must be 1..12, got {facts.month}")
    picks = []
    for rule in rules:
        if fires(rule, facts):
            why, value = reason(rule)
            picks.append(Pick(rule.code, rule.group, rule.sort_order, why, value))
    # Permits go after the fixed document items, in alphabetical order of their code.
    last = max((p.sort_order for p in picks if p.group == PERMIT_GROUP), default=0)
    for i, code in enumerate(sorted(permit_codes), start=1):
        picks.append(Pick(f"permit:{code}", PERMIT_GROUP, last + i, Reason.PERMIT))
    return sorted(picks, key=lambda p: (p.group, p.sort_order, p.code))
