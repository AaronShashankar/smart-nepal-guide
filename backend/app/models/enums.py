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


class Nationality(enum.StrEnum):
    """Which fee applies: permits and entry fees have Nepali / SAARC / foreign rates."""

    nepali = "nepali"
    saarc = "saarc"
    foreign = "foreign"


class PackingGroup(enum.StrEnum):
    """Sections of the packing checklist (V2 Phase 1), in the order the app shows them."""

    clothing = "clothing"
    gear = "gear"
    health = "health"
    documents = "documents"


# What a place offers beyond its category (place.tags). Labels are in the app (tags.<code>).
PLACE_TAGS = (
    "sunrise",  # sunrise or sunset views
    "mountain_views",
    "hiking",
    "boating",
    "wildlife",
    "pilgrimage",
    "unesco",  # UNESCO World Heritage Site
    "architecture",  # old temples, palaces, carvings
    "local_culture",  # village life, festivals, food
    "family",  # easy to reach, fine for children and older people
    "high_altitude",  # above 4,000 m
    "few_crowds",  # remote, quiet
)
