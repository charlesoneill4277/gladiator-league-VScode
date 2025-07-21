-- Supabase Database Schema Update for Gladiator League
-- This updates the existing database to match the application's expectations
-- Run this after your existing tables are already created

-- NOTE: Your existing tables are already in place!
-- This script just adds missing data and ensures compatibility

-- Insert sample data for testing (based on your existing configuration)
-- First, let's add seasons if they don't exist
INSERT INTO seasons (season_name, is_current, season_year) VALUES 
  ('2024 Season', false, '2024'),
  ('2025 Season', true, '2025')
ON CONFLICT (season_year) DO NOTHING;

-- Get the season IDs we just created
-- Insert conferences for 2024
INSERT INTO conferences (conference_name, league_id, season_id, status) VALUES 
  ('The Legions of Mars', '1072580179844857856', (SELECT id FROM seasons WHERE season_year = '2024'), 'completed'),
  ('The Guardians of Jupiter', '1072593839715667968', (SELECT id FROM seasons WHERE season_year = '2024'), 'completed'),
  ('Vulcan''s Oathsworn', '1072593416955015168', (SELECT id FROM seasons WHERE season_year = '2024'), 'completed')
ON CONFLICT (league_id) DO NOTHING;

-- Insert conferences for 2025
INSERT INTO conferences (conference_name, league_id, season_id, status) VALUES 
  ('The Legions of Mars', '1204854057169072128', (SELECT id FROM seasons WHERE season_year = '2025'), 'active'),
  ('The Guardians of Jupiter', '1204857692007440384', (SELECT id FROM seasons WHERE season_year = '2025'), 'active'),
  ('Vulcan''s Oathsworn', '1204857608989577216', (SELECT id FROM seasons WHERE season_year = '2025'), 'active')
ON CONFLICT (league_id) DO NOTHING;
