"""add email preferences table

Revision ID: add_email_preferences
Revises: 
Create Date: 2026-03-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_email_preferences'
down_revision = '001_contributors'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create email_preferences table."""
    op.create_table(
        'email_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('preferences', postgresql.JSON(), nullable=False, server_default='{}'),
        sa.Column('email_address', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create indexes
    op.create_index('ix_email_preferences_user_id', 'email_preferences', ['user_id'], unique=True)

    # Add foreign key to contributors table (if exists)
    # op.create_foreign_key(
    #     'fk_email_preferences_user_id',
    #     'email_preferences',
    #     'contributors',
    #     ['user_id'],
    #     ['id'],
    #     ondelete='CASCADE',
    # )


def downgrade() -> None:
    """Remove email_preferences table."""
    op.drop_index('ix_email_preferences_user_id', table_name='email_preferences')
    op.drop_table('email_preferences')