"""Add search vector column and GIN index for full-text search

Revision ID: add_search_vector
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_search_vector'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add tsvector column for full-text search
    op.add_column('bounties', sa.Column('search_vector', postgresql.TSVECTOR, nullable=True))
    
    # Create GIN index on search_vector column for fast full-text search
    op.create_index(
        'ix_bounties_search_vector',
        'bounties',
        ['search_vector'],
        postgresql_using='gin'
    )
    
    # Create function to update search vector
    op.execute("""
        CREATE OR REPLACE FUNCTION update_bounty_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector := 
                setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
                setweight(to_tsvector('english', COALESCE(NEW.requirements, '')), 'C') ||
                setweight(to_tsvector('english', COALESCE(NEW.tags::text, '')), 'D');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create trigger to automatically update search vector on INSERT/UPDATE
    op.execute("""
        CREATE TRIGGER bounty_search_vector_trigger
        BEFORE INSERT OR UPDATE ON bounties
        FOR EACH ROW EXECUTE FUNCTION update_bounty_search_vector();
    """)
    
    # Update existing records
    op.execute("""
        UPDATE bounties SET search_vector = 
            setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(requirements, '')), 'C') ||
            setweight(to_tsvector('english', COALESCE(tags::text, '')), 'D');
    """)


def downgrade():
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS bounty_search_vector_trigger ON bounties;")
    
    # Drop function
    op.execute("DROP FUNCTION IF EXISTS update_bounty_search_vector();")
    
    # Drop index
    op.drop_index('ix_bounties_search_vector', table_name='bounties')
    
    # Drop column
    op.drop_column('bounties', 'search_vector')