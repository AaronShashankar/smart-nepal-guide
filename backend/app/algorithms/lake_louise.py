"""Altitude sickness symptom checker: the Lake Louise AMS score, 2018 version (V2-P3-03).

Roach RC et al., "The 2018 Lake Louise Acute Mountain Sickness Score", High Altitude Medicine &
Biology 19(1), 2018. Four symptoms, each scored 0-3:

    headache, gastrointestinal (nausea / vomiting), fatigue / weakness, dizziness / light-headedness

Total = sum (0-12). Acute mountain sickness (AMS) is likely after a recent gain in altitude when
there is a headache (>= 1) and the total is >= 3. Severity: 3-5 mild, 6-9 moderate, 10-12 severe.

What Bato advises (version2/phase3.md):

    ok       total < 3                        no sign of AMS
    rest     mild AMS (3-5),                  rest here, don't go higher today
             or total >= 3 without a headache
    descend  moderate or severe AMS (>= 6),   descend now and get help
             or ANY red flag

A total of 3 or more without a headache is not AMS by the definition, but it is not "fine" either
(vomiting and dizziness at 4,400 m are a reason to stop climbing), so Bato says "rest" with the
reason NO_HEADACHE instead of "ok". The plan said "ok" here; it was changed so the app never
tells someone with clear symptoms that they can go higher.

Red flags are signs of HACE / HAPE, the dangerous forms, so they always mean "descend", whatever
the total: confusion or unsteady walking, breathless at rest or a wet cough, and symptoms that got
worse after a rest day.

The app has the same function in mobile/src/lib/lakeLouise.ts, so the check works offline. Both
are tested against one shared table, backend/tests/data/lake_louise_cases.json.
"""

from dataclasses import dataclass, field
from enum import StrEnum

from app.models.enums import SymptomResult

MAX_ITEM = 3
AMS_MIN_TOTAL = 3
MODERATE_MIN_TOTAL = 6
SEVERE_MIN_TOTAL = 10


class Severity(StrEnum):
    none = "none"
    mild = "mild"
    moderate = "moderate"
    severe = "severe"


class RedFlag(StrEnum):
    confusion = "confusion"  # confusion or unsteady walking (HACE)
    breathless = "breathless"  # breathless at rest or a wet cough (HAPE)
    worse_after_rest = "worse_after_rest"  # symptoms got worse after a rest day


@dataclass
class Answers:
    headache: int
    gi: int  # gastrointestinal: nausea / vomiting / poor appetite
    fatigue: int
    dizziness: int
    red_flags: list[RedFlag] = field(default_factory=list)


@dataclass
class Score:
    total: int
    severity: Severity
    result: SymptomResult
    reasons: list[str]  # codes the app turns into text


def _check(name: str, value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= MAX_ITEM:
        raise ValueError(f"{name} must be a whole number from 0 to {MAX_ITEM}")


def severity_of(headache: int, total: int) -> Severity:
    if headache < 1 or total < AMS_MIN_TOTAL:
        return Severity.none
    if total >= SEVERE_MIN_TOTAL:
        return Severity.severe
    if total >= MODERATE_MIN_TOTAL:
        return Severity.moderate
    return Severity.mild


def score(answers: Answers) -> Score:
    for name in ("headache", "gi", "fatigue", "dizziness"):
        _check(name, getattr(answers, name))
    flags = [RedFlag(f) for f in answers.red_flags]  # unknown codes raise ValueError

    total = answers.headache + answers.gi + answers.fatigue + answers.dizziness
    severity = severity_of(answers.headache, total)

    reasons = [f"RED_FLAG_{f.value.upper()}" for f in sorted(set(flags))]
    if severity is not Severity.none:
        reasons.append(f"AMS_{severity.value.upper()}")
    elif total >= AMS_MIN_TOTAL:
        reasons.append("NO_HEADACHE")  # other symptoms, but no headache: not AMS by definition
    else:
        reasons.append("LOW_SCORE")

    if flags or severity in (Severity.moderate, Severity.severe):
        result = SymptomResult.descend
    elif total >= AMS_MIN_TOTAL:  # mild AMS, or clear symptoms without a headache
        result = SymptomResult.rest
    else:
        result = SymptomResult.ok
    return Score(total=total, severity=severity, result=result, reasons=reasons)
