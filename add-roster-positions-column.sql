-- Add roster_positions column to seasons table
-- This column will store the roster position configuration as JSONB

ALTER TABLE seasons 
ADD COLUMN IF NOT EXISTS roster_positions JSONB DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN seasons.roster_positions IS 'JSONB column storing fantasy football roster positions from Sleeper API';