"""Build data/training_samples.csv (the risk model's training data).

    uv run python -m app.ml.dataset                       # agency + rule rows
    uv run python -m app.ml.dataset --survey answers.csv  # + Google Form answers

Three sources, recorded in the `source` column (write these rules in the report):

1. agency  - each trek's published difficulty (treks.json `base_difficulty`) for a typical
             trekker: age 30, medium fitness, some experience (beginner), no health issue,
             in the main seasons (Mar, Apr, Oct, Nov).
2. survey  - answers to docs/trekker-survey.md. Label = "How hard was it?", raised to `risky` for
             severe altitude sickness or turning back, and easy -> moderate for strong symptoms.
3. rule    - generated people/months on our 8 treks, labelled with the scoring rule below, then
             balanced so every class is ~25% of these rows (140 each). 8% of rule labels are
             moved one level up or down on purpose ("label noise"), because real people differ.

Scoring rule (risk points; label: <=2 easy, 3-5 moderate, 6-8 hard, >=9 risky):
  trek    highest point  <3,500 m 0 | <5,000 m 1 | <5,500 m 2 | higher 3
          sleeps above 5,000 m +1
          biggest one-day sleeping gain above 3,000 m  <=500 m 0 | <=900 m 1 | more 2
          10 days or more +1;  more than 12 km a day +1
  person  experience none +2, beginner +1;  fitness low +2, medium +1
          heart/lung condition +2;  age under 14 or over 60 +2, 50-60 +1
  month   winter (Dec-Feb) +2 if the trek goes above 4,000 m, else +1;  monsoon (Jun-Aug) +1
It reproduces every agency label for the typical trekker (checked by tests).
"""

import argparse
import csv
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from app.ml.features import LABELS, Sample
from app.services.itinerary import StageFacts, TrekFacts, trek_facts

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
OUT_FILE = DATA_DIR / "training_samples.csv"
COLUMNS = (*Sample.__dataclass_fields__, "label", "source")
SEED = 42
RULE_ROWS_PER_CLASS = 140
NOISE = 0.08
AGENCY_MONTHS = (3, 4, 10, 11)


@dataclass
class TrekInfo:
    code: str
    name: str
    base_difficulty: str
    facts: TrekFacts
    max_sleep_altitude_m: int


def load_treks(data: Path = DATA_DIR) -> list[TrekInfo]:
    with (data / "places.csv").open(encoding="utf-8") as f:
        alt = {r["slug"]: int(r["altitude_m"] or 0) for r in csv.DictReader(f)}
    treks = []
    for t in json.loads((data / "treks.json").read_text(encoding="utf-8")):
        stages = [
            StageFacts(
                s["day"],
                s["from"],
                s["to"],
                s["from"],
                s["to"],
                alt[s["from"]],
                alt[s["to"]],
                s["distance_km"],
                s["walk_hours"],
                s.get("highest_point_m"),
            )
            for s in t["stages"]
        ]
        facts = trek_facts(stages)
        treks.append(
            TrekInfo(
                t["code"], t["name"]["en"], t["base_difficulty"], facts, facts.max_sleep_altitude_m
            )
        )
    return treks


def sample_for(
    trek: TrekInfo,
    month: int,
    age: int,
    fitness: str,
    experience: str,
    health: bool,
    total_days: int | None = None,
) -> Sample:
    days = total_days or trek.facts.total_days
    return Sample(
        max_altitude_m=trek.facts.max_altitude_m,
        max_daily_gain_m=trek.facts.max_daily_gain_m,
        total_days=days,
        distance_per_day_km=round(trek.facts.total_distance_km / days, 2),
        month=month,
        age=age,
        fitness_level=fitness,
        trek_experience=experience,
        has_health_issue=health,
    )


def risk_points(s: Sample, sleeps_above_5000: bool) -> int:
    alt = s.max_altitude_m
    pts = 0 if alt < 3500 else 1 if alt < 5000 else 2 if alt < 5500 else 3
    pts += int(sleeps_above_5000)
    gain = s.max_daily_gain_m
    pts += 0 if gain <= 500 else 1 if gain <= 900 else 2
    pts += int(s.total_days >= 10) + int(s.distance_per_day_km > 12)
    pts += {"none": 2, "beginner": 1, "experienced": 0}[s.trek_experience]
    pts += {"low": 2, "medium": 1, "high": 0}[s.fitness_level]
    pts += 2 if s.has_health_issue else 0
    pts += 2 if s.age < 14 or s.age > 60 else 1 if s.age >= 50 else 0
    if s.month in (12, 1, 2):
        pts += 2 if alt >= 4000 else 1
    elif s.month in (6, 7, 8):
        pts += 1
    return pts


def rule_label(s: Sample, sleeps_above_5000: bool) -> str:
    p = risk_points(s, sleeps_above_5000)
    return LABELS[0 if p <= 2 else 1 if p <= 5 else 2 if p <= 8 else 3]


def agency_rows(treks: list[TrekInfo]) -> list[dict]:
    return [
        {
            **sample_for(t, m, 30, "medium", "beginner", False).as_dict(),
            "label": t.base_difficulty,
            "source": "agency",
        }
        for t in treks
        for m in AGENCY_MONTHS
    ]


def rule_rows(
    treks: list[TrekInfo], rng: np.random.Generator, per_class: int = RULE_ROWS_PER_CLASS
) -> list[dict]:
    rows: dict[str, list[dict]] = {label: [] for label in LABELS}
    for _ in range(200_000):
        if all(len(r) >= per_class for r in rows.values()):
            break
        t = treks[rng.integers(len(treks))]
        extra_days = int(rng.choice([0, 0, 0, 1, 2]))  # some people add rest days
        s = sample_for(
            t,
            month=int(rng.integers(1, 13)),
            age=int(np.clip(rng.normal(34, 13), 10, 75)),
            fitness=str(rng.choice(["low", "medium", "high"], p=[0.25, 0.45, 0.30])),
            experience=str(rng.choice(["none", "beginner", "experienced"], p=[0.35, 0.4, 0.25])),
            health=bool(rng.random() < 0.12),
            total_days=t.facts.total_days + extra_days,
        )
        label = rule_label(s, t.max_sleep_altitude_m > 5000)
        if len(rows[label]) < per_class:
            rows[label].append({**s.as_dict(), "label": label, "source": "rule"})
    out = [r for label in LABELS for r in rows[label]]
    for r in out:  # label noise: move to a neighbouring level
        if rng.random() < NOISE:
            i = LABELS.index(r["label"]) + int(rng.choice([-1, 1]))
            r["label"] = LABELS[min(max(i, 0), len(LABELS) - 1)]
    return out


# ------------------------------------------------------------ survey answers
SURVEY_TREKS = {
    "poon hill": "poon-hill",
    "abc": "annapurna-base-camp",
    "ebc": "everest-base-camp",
    "langtang": "langtang-valley",
    "mardi himal": "mardi-himal",
    "annapurna circuit": "annapurna-circuit",
    "gosaikunda": "gosaikunda",
    "manaslu": "manaslu-circuit",
}
MONTHS = {
    m: i
    for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1
    )
}


def survey_label(hard: str, symptoms: str, finished: str) -> str:
    """The labelling rule from docs/trekker-survey.md."""
    label = hard.strip().lower().split()[0]  # "Risky (unsafe for me)" -> "risky"
    symptoms, finished = symptoms.lower(), finished.lower()
    if symptoms.startswith("severe") or finished.startswith("turned back"):
        return "risky"
    if symptoms.startswith("strong") and label == "easy":
        return "moderate"
    return label


def survey_rows(path: Path, treks: list[TrekInfo]) -> list[dict]:
    """Google Form CSV export, columns in the order of docs/trekker-survey.md (after Timestamp).

    Rows for an "Other" trek are skipped: we have no stage data for them.
    """
    by_code = {t.code: t for t in treks}
    out = []
    with path.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # header
        for row in reader:
            (
                _ts,
                trek,
                days,
                month,
                age,
                fitness,
                experience,
                health,
                _rest,
                symptoms,
                hard,
                finished,
            ) = (c.strip() for c in row[:12])
            code = next((c for k, c in SURVEY_TREKS.items() if k in trek.lower()), None)
            if code is None:
                continue
            exp = experience.lower()
            s = sample_for(
                by_code[code],
                month=MONTHS[month[:3].lower()],
                age=int(age),
                fitness=fitness.lower(),
                experience="none"
                if exp.startswith("none")
                else "beginner"
                if exp.startswith("1")
                else "experienced",
                health=health.lower() == "yes",
                total_days=int(days) if days else None,
            )
            out.append(
                {**s.as_dict(), "label": survey_label(hard, symptoms, finished), "source": "survey"}
            )
    return out


def build(survey: Path | None = None, seed: int = SEED) -> list[dict]:
    treks = load_treks()
    rng = np.random.default_rng(seed)
    rows = agency_rows(treks)
    if survey:
        rows += survey_rows(survey, treks)
    return rows + rule_rows(treks, rng)


def write(rows: list[dict], path: Path = OUT_FILE) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({**r, "has_health_issue": str(r["has_health_issue"]).lower()})


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--survey", type=Path, help="Google Form CSV export")
    parser.add_argument("--out", type=Path, default=OUT_FILE)
    args = parser.parse_args()
    rows = build(args.survey)
    write(rows, args.out)
    counts = {label: sum(r["label"] == label for r in rows) for label in LABELS}
    sources = {s: sum(r["source"] == s for r in rows) for s in ("agency", "survey", "rule")}
    print(f"Wrote {len(rows)} rows to {args.out}")
    print("  labels :", ", ".join(f"{k}={v} ({v / len(rows):.0%})" for k, v in counts.items()))
    print("  sources:", ", ".join(f"{k}={v}" for k, v in sources.items()))


if __name__ == "__main__":
    main()
