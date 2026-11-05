"""PostgreSQL enums (database.md section 2)."""

import enum


class Lang(enum.StrEnum):
    en = "en"
    ne = "ne"


class UserRole(enum.StrEnum):
    traveller = "traveller"
    admin = "admin"


class AuthProvider(enum.StrEnum):
    email = "email"
    google = "google"


class FitnessLevel(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class TrekExperience(enum.StrEnum):
    none = "none"
    beginner = "beginner"
    experienced = "experienced"


class TravelStyle(enum.StrEnum):
    solo = "solo"
    family = "family"
    group = "group"


class BudgetLevel(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class RiskLevel(enum.StrEnum):
    easy = "easy"
    moderate = "moderate"
    hard = "hard"
    risky = "risky"


class MlAlgorithm(enum.StrEnum):
    decision_tree = "decision_tree"
    random_forest = "random_forest"


class CheckInStatus(enum.StrEnum):
    pending = "pending"
    done = "done"
    missed = "missed"


class SymptomResult(enum.StrEnum):
    ok = "ok"
    rest = "rest"
    descend = "descend"


class ReviewStatus(enum.StrEnum):
    visible = "visible"
    hidden = "hidden"


class Season(enum.StrEnum):
    spring = "spring"
    summer = "summer"
    autumn = "autumn"
    winter = "winter"
    any = "any"
