"""cleanup non-canonical weekly pattern_logs

Revision ID: h7i8j9k0l1m2
Revises: g6h7i8j9k0l1
Create Date: 2026-03-01

Non-canonical 레코드: period_start의 요일이 사용자의 week_start_day와 다른 주간 로그.
ISODOW 규칙: 1=월, 2=화, ..., 7=일  → week_start_day 규칙: 0=월, 1=화, ..., 6=일
변환: ISODOW - 1 = week_start_day (canonical 조건)
"""
from alembic import op


revision = 'h7i8j9k0l1m2'
down_revision = 'g6h7i8j9k0l1'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DELETE FROM pattern_logs pl
        USING user_profiles up
        WHERE pl.user_id::text = up.user_id::text
          AND pl.log_type = 'weekly'
          AND (EXTRACT(ISODOW FROM pl.period_start)::int - 1) != up.week_start_day
    """)


def downgrade():
    # 삭제된 레코드는 복구 불가 — downgrade는 no-op
    pass
