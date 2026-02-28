"""global lock password: user_profiles에 lock_password_hash 추가, journal_entries에서 제거

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-02-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'b7c8d9e0f1a2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # 전역 잠금 비밀번호: user_profiles에 추가
    op.add_column('user_profiles',
        sa.Column('lock_password_hash', sa.String(255), nullable=True))

    # 개별 일기 비밀번호: journal_entries에서 제거 (전역으로 통합)
    op.drop_column('journal_entries', 'lock_password_hash')


def downgrade():
    op.add_column('journal_entries',
        sa.Column('lock_password_hash', sa.String(255), nullable=True))
    op.drop_column('user_profiles', 'lock_password_hash')
