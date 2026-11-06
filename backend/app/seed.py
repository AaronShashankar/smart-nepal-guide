"""Load the seed files in ../data into the database.

    uv run python -m app.seed                # migrate to the latest schema, then load
    uv run python -m app.seed --data-dir X   # use another data folder

Safe to run again: IDs are derived from the slugs/codes (UUIDv5), so rows are
updated in place, and places/treks that disappeared from the files are soft-deleted.
"""

import argparse
import csv
import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from alembic.config import Config
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from alembic import command
from app.core.db import SessionLocal, engine
from app.models import (
    Category,
    CategoryTranslation,
    Interest,
    InterestTranslation,
    Permit,
    PermitTranslation,
    Place,
    PlaceAlias,
    PlaceClimate,
    PlacePhoto,
    PlaceTranslation,
    StageTranslation,
    TrainingSample,
    Trek,
    TrekPermit,
    TrekStage,
    TrekTranslation,
)
from app.models.enums import Lang, RiskLevel

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = BACKEND_DIR.parent / "data"
NAMESPACE = uuid.UUID("6f1c2b8e-4a1d-4c55-9b0e-5d3b8f1a7c42")
LAPSE_RATE_C_PER_M = 0.0065  # temperature drop per metre of altitude
BASELINE_ALTITUDE_M = 1400  # Kathmandu, where the baseline climate comes from


def sid(kind: str, key: str) -> uuid.UUID:
    """Stable id for a seeded row, e.g. sid('place', 'poon_hill')."""
    return uuid.uuid5(NAMESPACE, f"{kind}:{key}")


def _soft_delete_missing(db: Session, model, seeded: set[uuid.UUID]) -> None:
    """Soft-delete seeded rows that disappeared from the files.

    Only rows the seed created are touched (their ids are UUIDv5); places and treks added in
    the admin panel have random UUIDv4 ids and are left alone.
    """
    live = db.scalars(select(model.id).where(model.deleted_at.is_(None))).all()
    gone = [i for i in live if i.version == 5 and i not in seeded]
    if gone:
        db.execute(update(model).where(model.id.in_(gone)).values(deleted_at=datetime.now(UTC)))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return [{k: (v or "").strip() for k, v in row.items()} for row in csv.DictReader(f)]


def opt_int(value: str) -> int | None:
    return int(value) if value else None


def translations(model, fk: str, key, en: dict, ne: dict | None):
    """English row (developer-written) + optional Nepali row (AI draft, needs review)."""
    rows = [model(**{fk: key, "lang": Lang.en, **en})]
    if ne and any(ne.values()):
        rows.append(model(**{fk: key, "lang": Lang.ne, **ne}))
    return rows


def seed_categories(db: Session, data: Path) -> dict[str, uuid.UUID]:
    ids = {}
    for row in read_csv(data / "categories.csv"):
        cid = sid("category", row["code"])
        db.merge(Category(id=cid, code=row["code"], icon=row["icon"] or None))
        db.execute(delete(CategoryTranslation).where(CategoryTranslation.category_id == cid))
        db.add_all(
            translations(
                CategoryTranslation,
                "category_id",
                cid,
                {"name": row["name_en"]},
                {"name": row["name_ne"]},
            )
        )
        ids[row["code"]] = cid
    return ids


def seed_interests(db: Session, data: Path) -> int:
    rows = read_csv(data / "interests.csv")
    for row in rows:
        iid = sid("interest", row["code"])
        db.merge(Interest(id=iid, code=row["code"]))
        db.execute(delete(InterestTranslation).where(InterestTranslation.interest_id == iid))
        db.add_all(
            translations(
                InterestTranslation,
                "interest_id",
                iid,
                {"name": row["name_en"]},
                {"name": row["name_ne"]},
            )
        )
    return len(rows)


def seed_permits(db: Session, data: Path) -> dict[str, uuid.UUID]:
    ids = {}
    for row in read_csv(data / "permits.csv"):
        pid = sid("permit", row["code"])
        db.merge(
            Permit(
                id=pid,
                code=row["code"],
                fee_nepali_npr=opt_int(row["fee_nepali_npr"]),
                fee_saarc_npr=opt_int(row["fee_saarc_npr"]),
                fee_foreign_npr=opt_int(row["fee_foreign_npr"]),
            )
        )
        db.execute(delete(PermitTranslation).where(PermitTranslation.permit_id == pid))
        db.add_all(
            translations(
                PermitTranslation,
                "permit_id",
                pid,
                {"name": row["name_en"], "description": row["description_en"] or None},
                {"name": row["name_ne"], "description": row["description_ne"] or None},
            )
        )
        ids[row["code"]] = pid
    return ids


def climate_rows(data: Path, places: list[dict[str, str]]) -> dict[str, list[PlaceClimate]]:
    """Approximate monthly climate per place (see data/README.md, "Climate model")."""
    baseline = read_csv(data / "climate_baseline.csv")
    factors = {
        r["district"]: float(r["rain_factor"]) for r in read_csv(data / "climate_regions.csv")
    }
    out = {}
    for p in places:
        altitude = int(p["altitude_m"] or BASELINE_ALTITUDE_M)
        shift = (altitude - BASELINE_ALTITUDE_M) * LAPSE_RATE_C_PER_M
        factor = factors.get(p["district"], 1.0)
        out[p["slug"]] = [
            PlaceClimate(
                place_id=sid("place", p["slug"]),
                month=int(b["month"]),
                avg_temp_c=Decimal(str(round(float(b["avg_temp_c"]) - shift, 1))),
                rainfall_mm=round(float(b["rainfall_mm"]) * factor),
                visibility_score=int(b["visibility_score"]),
            )
            for b in baseline
        ]
    return out


def seed_places(db: Session, data: Path, categories: dict[str, uuid.UUID]) -> dict[str, dict]:
    places = read_csv(data / "places.csv")
    aliases = read_csv(data / "aliases.csv")
    photos = read_csv(data / "photos.csv") if (data / "photos.csv").exists() else []
    climate = climate_rows(data, places)
    by_slug = {}
    for row in places:
        pid = sid("place", row["slug"])
        db.merge(
            Place(
                id=pid,
                category_id=categories[row["category"]],
                latitude=Decimal(row["latitude"]),
                longitude=Decimal(row["longitude"]),
                altitude_m=opt_int(row["altitude_m"]),
                district=row["district"] or None,
                province=row["province"] or None,
                entry_fee_npr=opt_int(row["entry_fee_npr"]),
                is_published=True,
                deleted_at=None,
            )
        )
        for model in (PlaceTranslation, PlaceAlias, PlacePhoto, PlaceClimate):
            db.execute(delete(model).where(model.place_id == pid))
        en = {
            "name": row["name_en"],
            "description": row["description_en"] or None,
            "how_to_reach": row["how_to_reach_en"] or None,
            "is_machine_translated": False,
            "is_reviewed": True,
        }
        ne = {
            "name": row["name_ne"],
            "description": row["description_ne"] or None,
            "how_to_reach": row["how_to_reach_ne"] or None,
        }
        ne_rows = translations(
            PlaceTranslation, "place_id", pid, en, ne if row["name_ne"] else None
        )
        for t in ne_rows[1:]:
            t.is_machine_translated, t.is_reviewed = True, False  # AI draft until reviewed
        db.add_all(ne_rows)
        db.add_all(climate[row["slug"]])
        by_slug[row["slug"]] = {"id": pid, "altitude_m": opt_int(row["altitude_m"])}

    db.flush()
    for a in aliases:
        db.add(PlaceAlias(place_id=by_slug[a["place_slug"]]["id"], alias=a["alias"]))
    for p in photos:
        db.add(
            PlacePhoto(
                place_id=by_slug[p["place_slug"]]["id"],
                url=p["url"],
                sort_order=int(p["sort_order"] or 0),
            )
        )
    # Places removed from the CSV are soft-deleted (so offline clients learn about it).
    _soft_delete_missing(db, Place, {p["id"] for p in by_slug.values()})
    return by_slug


def seed_treks(
    db: Session, data: Path, places: dict[str, dict], permits: dict[str, uuid.UUID]
) -> int:
    treks = json.loads((data / "treks.json").read_text(encoding="utf-8"))
    seeded = []
    for t in treks:
        tid = sid("trek", t["code"])
        stages = t["stages"]
        altitudes = [places[s["to"]]["altitude_m"] or 0 for s in stages]
        altitudes += [places[stages[0]["from"]]["altitude_m"] or 0]
        altitudes += [s.get("highest_point_m") or 0 for s in stages]
        db.merge(
            Trek(
                id=tid,
                region=t["region"],
                total_days=len(stages),
                total_distance_km=Decimal(str(sum(s["distance_km"] for s in stages))),
                max_altitude_m=max(altitudes),
                base_difficulty=RiskLevel(t["base_difficulty"]),
                is_published=True,
                deleted_at=None,
            )
        )
        for model, col in (
            (TrekTranslation, "trek_id"),
            (TrekStage, "trek_id"),
            (TrekPermit, "trek_id"),
        ):
            db.execute(delete(model).where(getattr(model, col) == tid))
        ne_rows = translations(
            TrekTranslation,
            "trek_id",
            tid,
            {"name": t["name"]["en"], "overview": t["overview"]["en"], "is_reviewed": True},
            {"name": t["name"].get("ne"), "overview": t["overview"].get("ne")},
        )
        for row in ne_rows[1:]:
            row.is_machine_translated, row.is_reviewed = True, False
        db.add_all(ne_rows)
        db.flush()
        for s in stages:
            stage = TrekStage(
                id=sid("stage", f"{t['code']}:{s['day']}"),
                trek_id=tid,
                day_no=s["day"],
                from_place_id=places[s["from"]]["id"],
                to_place_id=places[s["to"]]["id"],
                distance_km=Decimal(str(s["distance_km"])),
                walk_hours=Decimal(str(s["walk_hours"])),
                highest_point_m=s.get("highest_point_m"),
            )
            if s.get("notes"):
                stage.translations.append(StageTranslation(lang=Lang.en, notes=s["notes"]))
            db.add(stage)
        db.add_all(TrekPermit(trek_id=tid, permit_id=permits[code]) for code in t["permits"])
        seeded.append(tid)
    _soft_delete_missing(db, Trek, set(seeded))
    return len(seeded)


def seed_training_samples(db: Session, data: Path) -> int:
    """Replace all rows from training_samples.csv (made by `python -m app.ml.dataset`)."""
    path = data / "training_samples.csv"
    if not path.exists():
        return 0
    db.execute(delete(TrainingSample))
    rows = read_csv(path)
    db.add_all(
        TrainingSample(
            id=sid("sample", str(i)),  # stable ids keep the train/test split reproducible
            max_altitude_m=int(r["max_altitude_m"]),
            max_daily_gain_m=int(r["max_daily_gain_m"]),
            total_days=int(r["total_days"]),
            distance_per_day_km=Decimal(r["distance_per_day_km"]),
            month=int(r["month"]),
            age=int(r["age"]),
            fitness_level=r["fitness_level"],
            trek_experience=r["trek_experience"],
            has_health_issue=r["has_health_issue"] == "true",
            label=r["label"],
            source=r["source"],
        )
        for i, r in enumerate(rows)
    )
    return len(rows)


def run(data: Path, migrate: bool = True) -> dict[str, int]:
    if migrate:
        cfg = Config(str(BACKEND_DIR / "alembic.ini"))
        cfg.set_main_option("sqlalchemy.url", engine.url.render_as_string(hide_password=False))
        command.upgrade(cfg, "head")
    with SessionLocal() as db, db.begin():
        categories = seed_categories(db, data)
        interests = seed_interests(db, data)
        permits = seed_permits(db, data)
        places = seed_places(db, data, categories)
        treks = seed_treks(db, data, places, permits)
        samples = seed_training_samples(db, data)
        photos = db.scalar(select(PlacePhoto.id).limit(1)) is not None
    return {
        "categories": len(categories),
        "interests": interests,
        "permits": len(permits),
        "places": len(places),
        "treks": treks,
        "training_samples": samples,
        "has_photos": int(photos),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--no-migrate", action="store_true", help="skip 'alembic upgrade head'")
    args = parser.parse_args()
    counts = run(args.data_dir.resolve(), migrate=not args.no_migrate)
    print("Seeded:", ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
