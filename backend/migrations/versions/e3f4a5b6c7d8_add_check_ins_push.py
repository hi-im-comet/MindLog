"""add_check_ins_push

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-03-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'e3f4a5b6c7d8'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'check_ins',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('recurrence', sa.String(10), nullable=False, server_default='none'),
        sa.Column('tone', sa.String(20), nullable=False, server_default='encouraging'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('source_entry_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('journal_entries.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notification_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('followup_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('snoozed_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
    )
    op.create_index('ix_check_ins_user_id', 'check_ins', ['user_id'])
    op.create_index('ix_check_ins_status_scheduled', 'check_ins', ['status', 'scheduled_at'])

    op.create_table(
        'check_in_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('check_in_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('check_ins.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(10), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('action_type', sa.String(20), nullable=True),
        sa.Column('model_used', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_check_in_messages_check_in_id', 'check_in_messages', ['check_in_id'])

    op.create_table(
        'push_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('endpoint', sa.Text, nullable=False, unique=True),
        sa.Column('p256dh', sa.Text, nullable=False),
        sa.Column('auth', sa.Text, nullable=False),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])

    op.add_column('user_profiles',
        sa.Column('reminders_enabled', sa.Boolean, server_default='true', nullable=False))
    op.add_column('user_profiles',
        sa.Column('quiet_hours_start', sa.Integer, nullable=True))
    op.add_column('user_profiles',
        sa.Column('quiet_hours_end', sa.Integer, nullable=True))


def downgrade():
    op.drop_column('user_profiles', 'quiet_hours_end')
    op.drop_column('user_profiles', 'quiet_hours_start')
    op.drop_column('user_profiles', 'reminders_enabled')
    op.drop_index('ix_push_subscriptions_user_id', table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
    op.drop_index('ix_check_in_messages_check_in_id', table_name='check_in_messages')
    op.drop_table('check_in_messages')
    op.drop_index('ix_check_ins_status_scheduled', table_name='check_ins')
    op.drop_index('ix_check_ins_user_id', table_name='check_ins')
    op.drop_table('check_ins')
