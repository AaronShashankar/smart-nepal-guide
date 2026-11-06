"""Loads the active model (ml_model.is_active) and keeps it in memory.

The API calls `active_model()` on every prediction; the file is only read again when a
different model becomes active (e.g. after `python -m app.ml.train`), so no restart is needed.
"""

import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import joblib
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.forest import RandomForest
from app.ml.tree import DecisionTree
from app.models import MlModel

log = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parents[2]


@dataclass
class LoadedModel:
    row: MlModel
    model: DecisionTree | RandomForest


_lock = threading.Lock()
_cache: dict[str, LoadedModel] = {}


def model_path(file_path: str) -> Path:
    path = Path(file_path)
    return path if path.is_absolute() else BACKEND_DIR / path


def active_model(db: Session) -> LoadedModel | None:
    row = db.scalar(select(MlModel).where(MlModel.is_active))
    if row is None:
        return None
    key = str(row.id)
    with _lock:
        if key not in _cache:
            path = model_path(row.file_path)
            if not path.exists():
                log.error("Active model file is missing: %s (run app.ml.train)", path)
                return None
            _cache.clear()
            _cache[key] = LoadedModel(row, joblib.load(path))
            log.info("Loaded %s model %s", row.algorithm.value, row.version)
        model = _cache[key].model
    return LoadedModel(row, model)  # the row from this request's session
