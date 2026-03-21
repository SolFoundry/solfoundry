"""create dispute system tables

Revision ID: 003_dispute_system
Revises: 002_full_pg_persistence
Create Date: 2024-01-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '003_dispute_system'
down_revision = '002_full_pg_persistence'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create disputes table
    op.create_table(
        'disputes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('bounty_id', UUID(as_uuid=True), sa.ForeignKey('bounties.id', ondelete='CASCADE'), nullable=False),
        sa.Column('submission_id', UUID(as_uuid=True), sa.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contributor_id', UUID(as_uuid=True), nullable=False),
        sa.Column('creator_id', UUID(as_uuid=True), nullable=False),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('state', sa.String(20), nullable=False, server_default='OPENED'),
        sa.Column('outcome', sa.String(30), nullable=True),
        sa.Column('contributor_evidence', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('creator_evidence', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('ai_review_score', sa.Float, nullable=True),
        sa.Column('ai_review_notes', sa.Text, nullable=True),
        sa.Column('auto_resolved', sa.Integer, nullable=False, server_default='0'),
        sa.Column('resolver_id', UUID(as_uuid=True), nullable=True),
        sa.Column('resolution_notes', sa.Text, nullable=True),
        sa.Column('creator_reputation_penalty', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('contributor_reputation_penalty', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('evidence_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create indexes for disputes
    op.create_index('ix_disputes_bounty_id', 'disputes', ['bounty_id'])
    op.create_index('ix_disputes_submission_id', 'disputes', ['submission_id'])
    op.create_index('ix_disputes_contributor_id', 'disputes', ['contributor_id'])
    op.create_index('ix_disputes_creator_id', 'disputes', ['creator_id'])
    op.create_index('ix_disputes_state', 'disputes', ['state'])
    op.create_index('ix_disputes_created_at', 'disputes', ['created_at'])

    # Create dispute_history table
    op.create_table(
        'dispute_history',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('dispute_id', UUID(as_uuid=True), sa.ForeignKey('disputes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('previous_state', sa.String(20), nullable=True),
        sa.Column('new_state', sa.String(20), nullable=True),
        sa.Column('actor_id', UUID(as_uuid=True), nullable=False),
        sa.Column('actor_role', sa.String(20), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create indexes for dispute_history
    op.create_index('ix_dispute_history_dispute_id', 'dispute_history', ['dispute_id'])
    op.create_index('ix_dispute_history_created_at', 'dispute_history', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_dispute_history_created_at', 'dispute_history')
    op.drop_index('ix_dispute_history_dispute_id', 'dispute_history')
    op.drop_table('dispute_history')

    op.drop_index('ix_disputes_created_at', 'disputes')
    op.drop_index('ix_disputes_state', 'disputes')
    op.drop_index('ix_disputes_creator_id', 'disputes')
    op.drop_index('ix_disputes_contributor_id', 'disputes')
    op.drop_index('ix_disputes_submission_id', 'disputes')
    op.drop_index('ix_disputes_bounty_id', 'disputes')
    op.drop_table('disputes')