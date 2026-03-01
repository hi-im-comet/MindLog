"""add daily messages

Revision ID: f5g6h7i8j9k0
Revises: e3f4a5b6c7d8
Create Date: 2026-03-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f5g6h7i8j9k0'
down_revision = 'e3f4a5b6c7d8'
branch_labels = None
depends_on = None


def upgrade():
    # daily_messages 테이블 생성
    op.create_table(
        'daily_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('message_date', sa.Date(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ai_mood_used', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'message_date', name='uq_daily_message_user_date'),
    )
    op.create_index('ix_daily_message_user_date', 'daily_messages', ['user_id', 'message_date'])

    # user_profiles에 일일 메시지 설정 컬럼 추가
    op.add_column('user_profiles',
        sa.Column('daily_message_enabled', sa.Boolean(),
                  server_default='true', nullable=False))
    op.add_column('user_profiles',
        sa.Column('daily_message_time', sa.String(5),
                  server_default='08:00', nullable=True))


def downgrade():
    op.drop_column('user_profiles', 'daily_message_time')
    op.drop_column('user_profiles', 'daily_message_enabled')
    op.drop_index('ix_daily_message_user_date', table_name='daily_messages')
    op.drop_table('daily_messages')
