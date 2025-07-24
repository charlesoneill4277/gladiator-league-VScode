import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database table names (matching your actual Supabase schema)
export const TABLES = {
  SEASONS: 'seasons',
  CONFERENCES: 'conferences', 
  TEAMS: 'teams',
  TEAM_CONFERENCE_JUNCTION: 'team_conference_junction', // Your actual table name
  MATCHUPS: 'matchups',
  TEAM_RECORDS: 'team_records',
  PLAYERS: 'players',
  DRAFT_RESULTS: 'draft_results', // Your actual table name
  MATCHUP_ADMIN_OVERRIDE: 'matchup_admin_override',
  PLAYOFF_BRACKETS: 'playoff_brackets',
  TEAM_ROSTERS: 'team_rosters',
  TRANSACTIONS: 'transactions'
} as const;

export default supabase;
