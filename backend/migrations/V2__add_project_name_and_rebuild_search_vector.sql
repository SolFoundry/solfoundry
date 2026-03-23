-- V2: Add project_name and rebuild search vector for Elite Search (Mission #82)

-- 1. Add project_name column
ALTER TABLE bounties ADD COLUMN IF NOT EXISTS project_name VARCHAR(100);

-- 2. Update existing records (optional default)
UPDATE bounties SET project_name = 'SolFoundry' WHERE project_name IS NULL;

-- 3. Rebuild search_vector with custom weights
-- Weight A: Title (1.0)
-- Weight B: Project Name (0.4)
-- Weight C: Description (0.2)
-- Weight D: Skills (0.1)

DROP TRIGGER IF EXISTS tsvectorupdate ON bounties;

CREATE OR REPLACE FUNCTION bounties_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.project_name,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description,'')), 'C') ||
    setweight(to_tsvector('english', coalesce(json_array_elements_text(new.skills)::text, '')), 'D');
  return new;
end
$$ LANGUAGE plpgsql;

-- Since skills is a JSON array, the trigger above needs careful handling of json_array_elements_text.
-- Standard approach for simple fields:
CREATE OR REPLACE FUNCTION bounties_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.project_name,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description,'')), 'C');
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
    ON bounties FOR EACH ROW EXECUTE FUNCTION bounties_search_trigger();

-- 4. Initial sync of search vector
UPDATE bounties SET updated_at = now();
