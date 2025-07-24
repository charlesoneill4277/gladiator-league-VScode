-- Add charter-related fields to seasons table
-- This will store charter document metadata and file information

ALTER TABLE seasons 
ADD COLUMN IF NOT EXISTS charter_file_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charter_file_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charter_uploaded_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charter_uploaded_by TEXT DEFAULT NULL;

-- Add comments to document the columns
COMMENT ON COLUMN seasons.charter_file_url IS 'URL to the charter document in Supabase Storage';
COMMENT ON COLUMN seasons.charter_file_name IS 'Original filename of the uploaded charter document';
COMMENT ON COLUMN seasons.charter_uploaded_at IS 'Timestamp when the charter was uploaded';
COMMENT ON COLUMN seasons.charter_uploaded_by IS 'User ID of the admin who uploaded the charter';