"""lock security (failed attempts, auto-lock) + diary ux (is_favorite, tags)

Revision ID: c1d2e3f4a5b6
Revises: b7c8d9e0f1a2
Create Date: 2026-02-28
"""
from alembic import op
import sqlalchemy as sa


revision = 'c1d2e3f4a5b6'
down_revision = 'b7c8d9e0f1a2'
branch_labels = None
depends_on = None


def upgrade():
    # user_profiles: 잠금 실패 추적 + 자동 잠금
    op.add_column('user_profiles',
        sa.Column('failed_lock_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('user_profiles',
        sa.Column('failed_lock_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('user_profiles',
        sa.Column('auto_lock_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('user_profiles',
        sa.Column('auto_lock_timeout', sa.Integer(), nullable=False, server_default='30'))

    # journal_entries: 즐겨찾기 + 태그
    op.add_column('journal_entries',
        sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('journal_entries',
        sa.Column('tags', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('journal_entries', 'tags')
    op.drop_column('journal_entries', 'is_favorite')
    op.drop_column('user_profiles', 'auto_lock_timeout')
    op.drop_column('user_profiles', 'auto_lock_enabled')
    op.drop_column('user_profiles', 'failed_lock_at')
    op.drop_column('user_profiles', 'failed_lock_attempts')
