-- RLS Policies for Gladiator League Application
-- This script creates the necessary Row Level Security policies for anonymous access

-- ================================
-- MATCHUPS TABLE POLICIES
-- ================================

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Allow anonymous read access to matchups" ON matchups;
DROP POLICY IF EXISTS "Allow anonymous write access to matchups" ON matchups;
DROP POLICY IF EXISTS "Allow anonymous update access to matchups" ON matchups;
DROP POLICY IF EXISTS "Allow anonymous delete access to matchups" ON matchups;

-- Enable RLS on matchups table (if not already enabled)
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
-- Allow anonymous users to SELECT matchups
CREATE POLICY "Allow anonymous read access to matchups" 
ON matchups FOR SELECT 
TO anon 
USING (true);

-- Allow anonymous users to INSERT matchups
CREATE POLICY "Allow anonymous insert access to matchups" 
ON matchups FOR INSERT 
TO anon 
WITH CHECK (true);

-- Allow anonymous users to UPDATE matchups
CREATE POLICY "Allow anonymous update access to matchups" 
ON matchups FOR UPDATE 
TO anon 
USING (true) 
WITH CHECK (true);

-- Allow anonymous users to DELETE matchups
CREATE POLICY "Allow anonymous delete access to matchups" 
ON matchups FOR DELETE 
TO anon 
USING (true);

-- ================================
-- OTHER ESSENTIAL TABLES
-- ================================

-- SEASONS TABLE
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to seasons" ON seasons;
CREATE POLICY "Allow anonymous access to seasons" 
ON seasons FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- CONFERENCES TABLE
ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to conferences" ON conferences;
CREATE POLICY "Allow anonymous access to conferences" 
ON conferences FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- TEAMS TABLE
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to teams" ON teams;
CREATE POLICY "Allow anonymous access to teams" 
ON teams FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- TEAM_CONFERENCE_JUNCTION TABLE
ALTER TABLE team_conference_junction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to team_conference_junction" ON team_conference_junction;
CREATE POLICY "Allow anonymous access to team_conference_junction" 
ON team_conference_junction FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- TEAM_RECORDS TABLE
ALTER TABLE team_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to team_records" ON team_records;
CREATE POLICY "Allow anonymous access to team_records" 
ON team_records FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- MATCHUP_ADMIN_OVERRIDE TABLE
ALTER TABLE matchup_admin_override ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to matchup_admin_override" ON matchup_admin_override;
CREATE POLICY "Allow anonymous access to matchup_admin_override" 
ON matchup_admin_override FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- PLAYERS TABLE
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to players" ON players;
CREATE POLICY "Allow anonymous access to players" 
ON players FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- DRAFT_RESULTS TABLE
ALTER TABLE draft_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to draft_results" ON draft_results;
CREATE POLICY "Allow anonymous access to draft_results" 
ON draft_results FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- TRANSACTIONS TABLE
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access to transactions" ON transactions;
CREATE POLICY "Allow anonymous access to transactions" 
ON transactions FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- ================================
-- VERIFICATION QUERIES
-- ================================

-- Check that RLS is enabled and policies exist
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'matchups', 'seasons', 'conferences', 'teams', 
    'team_conference_junction', 'team_records', 
    'matchup_admin_override', 'players', 'draft_results', 'transactions'
);

-- List all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
