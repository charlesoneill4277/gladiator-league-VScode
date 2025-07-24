-- Add scoring_settings column to seasons table
-- This column will store the scoring configuration as JSONB

ALTER TABLE seasons 
ADD COLUMN IF NOT EXISTS scoring_settings JSONB DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN seasons.scoring_settings IS 'JSONB column storing fantasy football scoring settings from Sleeper API';