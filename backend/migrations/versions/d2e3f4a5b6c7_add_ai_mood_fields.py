"""add_ai_mood_fields

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-02-28 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd2e3f4a5b6c7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user_profiles',
        sa.Column('ai_mood_default', sa.String(20), server_default='empathy', nullable=False))
    op.add_column('user_profiles',
        sa.Column('ai_response_length_default', sa.String(10), server_default='normal', nullable=False))
    op.add_column('journal_entries',
        sa.Column('ai_mood_override', sa.String(20), nullable=True))
    op.add_column('journal_entries',
        sa.Column('ai_response_length_override', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('journal_entries', 'ai_response_length_override')
    op.drop_column('journal_entries', 'ai_mood_override')
    op.drop_column('user_profiles', 'ai_response_length_default')
    op.drop_column('user_profiles', 'ai_mood_default')
