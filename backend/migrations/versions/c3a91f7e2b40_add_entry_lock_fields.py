"""add_entry_lock_fields

Revision ID: c3a91f7e2b40
Revises: 126d59924a35
Create Date: 2026-02-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3a91f7e2b40'
down_revision = '126d59924a35'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('entry_lock_enabled', sa.Boolean(), nullable=True, server_default='false'))

    with op.batch_alter_table('journal_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_locked', sa.Boolean(), nullable=True, server_default='false'))
        batch_op.add_column(sa.Column('lock_password_hash', sa.String(255), nullable=True))


def downgrade():
    with op.batch_alter_table('journal_entries', schema=None) as batch_op:
        batch_op.drop_column('lock_password_hash')
        batch_op.drop_column('is_locked')

    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.drop_column('entry_lock_enabled')
