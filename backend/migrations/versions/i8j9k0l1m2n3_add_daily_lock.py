"""add daily_lock_enabled to user_profiles

Revision ID: i8j9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2026-03-01

매일 자동 잠금: 오늘 잠금 해제 후 날짜가 바뀌면 다시 비밀번호를 요구.
디바이스 스코프 (localStorage). 서버는 사용자 설정만 저장.
"""
from alembic import op
import sqlalchemy as sa

revision = 'i8j9k0l1m2n3'
down_revision = 'h7i8j9k0l1m2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'user_profiles',
        sa.Column('daily_lock_enabled', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('user_profiles', 'daily_lock_enabled')
