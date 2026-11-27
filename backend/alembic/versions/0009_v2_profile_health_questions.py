"""v2 profile health questions

V2-PROF-01: three more optional health questions on traveller_profile
(high blood pressure, significant anemia, recent injury).

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0009'
down_revision: Union[str, Sequence[str], None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('traveller_profile', sa.Column('has_high_blood_pressure', sa.Boolean(), nullable=True))
    op.add_column('traveller_profile', sa.Column('has_anemia', sa.Boolean(), nullable=True))
    op.add_column('traveller_profile', sa.Column('has_recent_injury', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('traveller_profile', 'has_recent_injury')
    op.drop_column('traveller_profile', 'has_anemia')
    op.drop_column('traveller_profile', 'has_high_blood_pressure')
