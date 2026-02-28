"""add pattern log sections (mirror, data_badges, small_experiment, safety_content, unique constraint)

Revision ID: a1b2c3d4e5f6
Revises: c3a91f7e2b40
Create Date: 2026-02-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'a1b2c3d4e5f6'
down_revision = 'c3a91f7e2b40'
branch_labels = None
depends_on = None


def upgrade():
    # 1. 새 컬럼 추가
    op.add_column('pattern_logs', sa.Column('mirror', sa.Text(), nullable=True))
    op.add_column('pattern_logs', sa.Column('data_badges', sa.JSON(), nullable=True))
    op.add_column('pattern_logs', sa.Column('small_experiment', sa.Text(), nullable=True))
    op.add_column('pattern_logs', sa.Column('safety_content', sa.Text(), nullable=True))

    # 2. 기존 중복 레코드 정리: (user_id, log_type, period_start) 기준 최신 1개만 남김
    conn = op.get_bind()
    conn.execute(text("""
        DELETE FROM pattern_logs
        WHERE id NOT IN (
            SELECT DISTINCT ON (user_id, log_type, period_start) id
            FROM pattern_logs
            ORDER BY user_id, log_type, period_start, generated_at DESC NULLS LAST
        )
    """))

    # 3. Unique constraint 추가
    op.create_unique_constraint(
        'uq_pattern_log_period',
        'pattern_logs',
        ['user_id', 'log_type', 'period_start'],
    )


def downgrade():
    op.drop_constraint('uq_pattern_log_period', 'pattern_logs', type_='unique')
    op.drop_column('pattern_logs', 'safety_content')
    op.drop_column('pattern_logs', 'small_experiment')
    op.drop_column('pattern_logs', 'data_badges')
    op.drop_column('pattern_logs', 'mirror')
