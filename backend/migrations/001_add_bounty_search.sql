-- Migration: Add full-text search support for bounties
-- Run this after creating the bounties table

-- Add tsvector column for full-text search
ALTER TABLE bounties ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS ix_bounties_search_vector ON bounties USING GIN(search_vector);

-- Create trigger to automatically update search_vector on insert or update
CREATE OR REPLACE FUNCTION update_bounty_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        coalesce(NEW.title, '') || ' ' || 
        coalesce(NEW.description, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS bounty_search_vector_update ON bounties;

-- Create trigger
CREATE TRIGGER bounty_search_vector_update
    BEFORE INSERT OR UPDATE ON bounties
    FOR EACH ROW
    EXECUTE FUNCTION update_bounty_search_vector();

-- Update existing records
UPDATE bounties SET search_vector = to_tsvector('english', 
    coalesce(title, '') || ' ' || 
    coalesce(description, '')
);

-- Create additional indexes for common filter combinations
CREATE INDEX IF NOT EXISTS ix_bounties_tier_status ON bounties(tier, status);
CREATE INDEX IF NOT EXISTS ix_bounties_category_status ON bounties(category, status);
CREATE INDEX IF NOT EXISTS ix_bounties_reward ON bounties(reward_amount);
CREATE INDEX IF NOT EXISTS ix_bounties_deadline ON bounties(deadline);
CREATE INDEX IF NOT EXISTS ix_bounties_popularity ON bounties(popularity);

-- Create index on skills array for faster JSON queries
CREATE INDEX IF NOT EXISTS ix_bounties_skills ON bounties USING GIN(skills);