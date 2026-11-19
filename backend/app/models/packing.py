"""Version 2 Phase 1: packing checklist rules (database.md section 3.I).

Each row is one rule of a small expert system: the item goes on the list when *all* of its set
conditions are true for the trek and month (see app/algorithms/packing.py).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, pg_enum, updated_at_col, uuid_pk
from app.models.enums import PackingGroup
from app.models.user import LANG, Lang


class PackingItem(Base):
    __tablename__ = "packing_item"
    __table_args__ = (
        # An item that is not `always` needs at least one condition, or it would never show.
        CheckConstraint(
            "always OR min_altitude_m IS NOT NULL OR cardinality(months) > 0"
            " OR min_days IS NOT NULL",
            name="has_rule",
        ),
        CheckConstraint("months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]", name="months"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    group: Mapped[PackingGroup] = mapped_column(
        pg_enum(PackingGroup, "packing_group"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Rule columns. NULL / empty = that condition is not used.
    always: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    min_altitude_m: Mapped[int | None] = mapped_column(Integer)  # trek's highest point >= this
    months: Mapped[list[int]] = mapped_column(
        ARRAY(SmallInteger), nullable=False, default=list, server_default="{}"
    )  # the chosen month is one of these
    min_days: Mapped[int | None] = mapped_column(Integer)  # trek takes at least this many days
    updated_at: Mapped[datetime] = updated_at_col()

    translations: Mapped[list["PackingItemTranslation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class PackingItemTranslation(Base):
    __tablename__ = "packing_item_translation"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("packing_item.id", ondelete="CASCADE"), primary_key=True
    )
    lang: Mapped[Lang] = mapped_column(LANG, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)  # short tip, e.g. "ask a doctor first"
