"""'Why this rating?': decision-path tracing (algorithm.md, core algorithm 2).

1. Take the decision path(s) the user's input followed: one path for a single tree, or the paths
   of every tree that voted for the winning class in the forest.
2. Keep only conditions that point *towards more risk* (e.g. `max_daily_gain_m > 545`,
   `fitness_level <= 0.5`), and only when the user's own value also passes the reason's rule
   in the table below, so every sentence shown is true for this user.
3. Count how many winning paths use each reason, and show the top 3.
An `easy` result has no risk reasons.

The codes are translated on the phone (`reasons.<CODE>` in en.json / ne.json).
"""

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field

from app.ml.features import FEATURES, Sample
from app.ml.tree import Condition

MAX_REASONS = 3


@dataclass
class Reason:
    code: str
    params: dict = field(default_factory=dict)


@dataclass
class Rule:
    feature: str
    risk_op: str | None  # ">" = higher is riskier, "<=" = lower is riskier, None = either way
    applies: Callable[[Sample], bool]
    params: Callable[[Sample, dict], dict] = lambda s, ctx: {}


# Order = priority when two reasons are used by the same number of trees.
RULES: dict[str, Rule] = {
    "HIGH_ALTITUDE": Rule(
        "max_altitude_m",
        ">",
        lambda s: s.max_altitude_m > 5000,
        lambda s, ctx: {"altitude": s.max_altitude_m},
    ),
    "HIGH_DAILY_GAIN": Rule(
        "max_daily_gain_m",
        ">",
        lambda s: s.max_daily_gain_m > 500,
        lambda s, ctx: {"gain": s.max_daily_gain_m, "day": ctx.get("gain_day")},
    ),
    "HEALTH_ISSUE": Rule("has_health_issue", ">", lambda s: bool(s.has_health_issue)),
    "NO_EXPERIENCE": Rule("trek_experience", "<=", lambda s: s.trek_experience == "none"),
    "BEGINNER": Rule("trek_experience", "<=", lambda s: s.trek_experience == "beginner"),
    "LOW_FITNESS": Rule("fitness_level", "<=", lambda s: s.fitness_level == "low"),
    "WINTER_MONTH": Rule("winter", ">", lambda s: s.month in (12, 1, 2)),
    "MONSOON_MONTH": Rule("monsoon", ">", lambda s: s.month in (6, 7, 8)),
    "AGE_RISK": Rule(
        "age", None, lambda s: s.age > 60 or s.age < 14, lambda s, ctx: {"age": s.age}
    ),
    "LONG_DAYS": Rule(
        "distance_per_day_km",
        ">",
        lambda s: s.distance_per_day_km > 12,
        lambda s, ctx: {"km": round(s.distance_per_day_km, 1)},
    ),
}
_PRIORITY = {code: i for i, code in enumerate(RULES)}


def _matches(rule: Rule, cond: Condition) -> bool:
    return FEATURES[cond.feature] == rule.feature and rule.risk_op in (None, cond.op)


def explain(
    paths: list[list[Condition]], sample: Sample, level: str, context: dict | None = None
) -> list[Reason]:
    """Top reasons for `level`, from the decision paths that produced it."""
    if level == "easy":
        return []
    context = context or {}
    applicable = {code: r for code, r in RULES.items() if r.applies(sample)}
    used: Counter[str] = Counter()
    for path in paths:
        for code, rule in applicable.items():
            if any(_matches(rule, c) for c in path):
                used[code] += 1
    ranked = sorted(used, key=lambda code: (-used[code], _PRIORITY[code]))
    return [Reason(code, RULES[code].params(sample, context)) for code in ranked[:MAX_REASONS]]
