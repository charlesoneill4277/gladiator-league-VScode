// Database types for Supabase integration
// These match your actual database schema

export interface DbSeason {
  id: number;
  season_name: string;
  is_current: boolean;
  season_year: string; // Note: this is text in your schema
  scoring_settings?: Record<string, number>; // JSONB column for scoring configuration
  roster_positions?: string[]; // JSONB column for roster position configuration
  charter_file_url?: string; // URL to charter document in Supabase Storage
  charter_file_name?: string; // Original filename of uploaded charter
  charter_uploaded_at?: string; // Timestamp when charter was uploaded
  charter_uploaded_by?: string; // User ID of admin who uploaded charter
  created_at?: string;
  updated_at?: string;
}

export interface DbConference {
  id: number;
  conference_name: string;
  league_id: string; // Note: UNIQUE constraint
  season_id: number;
  draft_id?: string; // Note: UNIQUE constraint
  status: string;
  league_logo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbTeam {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string; // Note: UNIQUE constraint
  co_owner_name?: string;
  co_owner_id?: string; // Note: UNIQUE constraint
  team_logourl?: string; // Note: different field name
  team_primarycolor?: string;
  team_secondarycolor?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbTeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: number; // Note: integer, not text
  created_at?: string;
  updated_at?: string;
}

export interface DbMatchup {
  id: number;
  conference_id: number;
  week: string; // Note: text in your schema
  team1_id: number;
  team2_id: number | null; // Can be null for bye weeks
  is_playoff?: boolean;
  is_bye?: boolean; // For playoff bye weeks
  manual_override?: boolean;
  matchup_status?: string;
  notes?: string;
  matchup_type?: string; // USER-DEFINED type
  team1_score?: number; // numeric
  team2_score?: number; // numeric
  winning_team_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbTeamRecord {
  id: number;
  created_at: string; // NOT NULL with DEFAULT now()
  team_id: number;
  conference_id: number;
  season_id: number;
  wins?: number;
  losses?: number;
  points_for?: number;
  points_against?: number;
  point_diff?: number; // Additional field in your schema
  updated_at?: string;
}

export interface DbPlayer {
  id: number;
  sleeper_id: string; // Note: different field name, UNIQUE
  player_name: string;
  position: string;
  nfl_team?: string;
  number?: number; // Note: different field name
  playing_status?: string; // Note: different field name
  injury_status?: string;
  age?: number;
  height?: number; // Note: integer, not text
  weight?: number;
  depth_chart?: number; // Additional field
  college?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbDraftResult {
  id: number;
  draft_year: string;
  league_id: string;
  round: string; // Note: text in your schema
  draft_slot: string; // Note: text in your schema
  pick_number: string; // Note: text in your schema
  owner_id: string;
  sleeper_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbMatchupAdminOverride {
  id: number;
  season_id: number;
  week: number;
  conference_id: number;
  original_team1_id?: number; // Original teams from Sleeper API
  original_team2_id?: number;
  override_team1_id: number; // Manually assigned teams
  override_team2_id: number;
  override_reason?: string; // e.g., "Interconference Week", "Schedule Conflict"
  is_active: boolean; // Allow deactivating overrides
  sleeper_matchup_id?: string; // Reference to original Sleeper matchup
  admin_notes?: string;
  date_overridden?: string; // timestamp without time zone
  overridden_by_admin_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbPlayoffBracket {
  id: number;
  season_id: number;
  round: number;
  team1_seed: number;
  team2_seed: number;
  team1_id: number;
  team2_id: number;
  winner_team_id?: number;
  sleeper_match_id?: string;
  playoff_round_name?: string;
  is_bye?: boolean;
  matchup_number?: number;
  week: number;
  team1_score?: number;
  team2_score?: number;
}

export interface DbPlayoffFormat {
  id: number;
  season_id: number;
  playoff_teams: number;
  week_14_byes: number; // This is first_round_byes
  reseed: boolean;
  playoff_start_week: number;
  championship_week: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbTeamRoster {
  id: number;
  team_id: number;
  sleeper_id: string;
  season_id: number;
  week: number;
  status?: string;
  is_starter?: boolean;
  inserted_at?: string; // timestamp with time zone
  created_at?: string;
  updated_at?: string;
}

export interface DbTransaction {
  id: number;
  season_id: number;
  conference_id: number;
  sleeper_transaction_id?: string;
  type?: string;
  data?: any; // jsonb
  created_at?: string; // timestamp without time zone
  updated_at?: string;
}

// API Response type for paginated results
export interface PaginatedResponse<T> {
  data: T[];
  count?: number;
  error?: any;
}

// Filter types for database queries
export interface DbFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'not';
  value: any;
}

export interface DbQueryOptions {
  filters?: DbFilter[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  offset?: number;
}
