"""add week_start_day to user_profiles

Revision ID: g6h7i8j9k0l1
Revises: f5g6h7i8j9k0
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa

revision = 'g6h7i8j9k0l1'
down_revision = 'f5g6h7i8j9k0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'user_profiles',
        sa.Column('week_start_day', sa.SmallInteger(), nullable=False, server_default='0'),
    )


def downgrade():
    op.drop_column('user_profiles', 'week_start_day')
