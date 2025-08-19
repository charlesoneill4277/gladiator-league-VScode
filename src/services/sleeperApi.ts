// Service for integrating with Sleeper API
import { DatabaseService } from './databaseService';
export interface SleeperRoster {
  starters: string[] | null;
  settings: {
    wins: number;
    waiver_position: number;
    waiver_budget_used: number;
    total_moves: number;
    ties: number;
    losses: number;
    fpts_decimal: number;
    fpts_against_decimal: number;
    fpts_against: number;
    fpts: number;
  };
  roster_id: number;
  reserve: string[] | null;
  players: string[] | null;
  owner_id: string;
  league_id: string;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
  age: number;
  height: string;
  weight: number;
  years_exp: number;
  college: string;
}

export interface OrganizedRoster {
  starters: Array<{
    playerId: string;
    position: string;
    slotPosition: string;
  }>;
  bench: string[];
  ir: string[];
}

export interface SleeperMatchup {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  starters_points: number[];
  players_points: Record<string, number>;
}

export interface SleeperLeague {
  total_rosters: number;
  status: string;
  sport: string;
  settings: {
    max_keepers: number;
    draft_rounds: number;
    trade_deadline: number;
    playoff_week_start: number;
    num_teams: number;
    leg: number;
    playoff_type: number;
    playoff_round_type: number;
    playoff_seed_type: number;
    playoff_teams: number;
    waiver_type: number;
    waiver_clear_days: number;
    waiver_day_of_week: number;
    start_week: number;
    league_average_match: number;
    last_report: number;
    last_scored_leg: number;
    taxi_years: number;
    taxi_allow_vets: number;
    taxi_slots: number;
    trade_review_days: number;
    reserve_allow_dnr: number;
    reserve_allow_doubtful: number;
    reserve_slots: number;
    reserve_allow_sus: number;
    reserve_allow_out: number;
    bench_lock: number;
  };
  season_type: string;
  season: string;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  previous_league_id: string;
  name: string;
  league_id: string;
  draft_id: string;
  avatar: string;
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
  metadata: {
    team_name?: string;
  };
}

export interface SleeperNFLState {
  week: number;
  season_type: string;
  season: string;
  leg: number;
  season_start_date: string;
  previous_season: string;
  display_week: number;
}

export interface SleeperDraft {
  draft_id: string;
  season: string;
  league_id: string;
  type: string;
  status: string;
  start_time: number;
  sport: string;
  settings: {
    teams: number;
    slots_qb: number;
    slots_rb: number;
    slots_wr: number;
    slots_te: number;
    slots_k: number;
    slots_def: number;
    slots_bn: number;
    rounds: number;
    reversal_round: number;
  };
  season_type: string;
  creators: string[] | null;
}

export interface SleeperDraftPick {
  player_id: string;
  pick_no: number;
  round: number;
  roster_id: number;
  draft_slot: number;
  draft_id: string;
  picked_by: string;
  metadata: {
    team: string;
    status: string;
    sport: string;
    position: string;
    player_id: string;
    number: string;
    news_updated: string;
    last_name: string;
    injury_status: string;
    first_name: string;
  };
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: string;
  owner_id: string;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: 'trade' | 'waiver' | 'free_agent';
  status: 'complete' | 'failed';
  creator: string;
  created: number;
  roster_ids: number[];
  settings: {
    waiver_bid: number;
    seq: number;
  } | null;
  metadata: Record<string, any>;
  leg: number;
  drops: Record<string, number> | null;
  draft_picks: any[];
  consenter_ids: number[];
  adds: Record<string, number> | null;
}

export interface SleeperPlayoffBracket {
  r: number; // round
  m: number; // match
  t1: number; // team 1
  t2: number; // team 2
  w: number; // winner
  l: number; // loser
  t1_from: { winner_of?: number; loser_of?: number } | null;
  t2_from: { winner_of?: number; loser_of?: number } | null;
}

export interface SleeperPlayerStats {
  date: any;
  stats: Record<string, number>;
  category: string;
  last_modified: any;
  week: any;
  season: string;
  season_type: string;
  sport: string;
  player_id: string;
  game_id: string;
  updated_at: any;
  team: string;
  company: string;
  opponent: any;
  player: SleeperPlayer;
}

export interface SleeperPlayerResearch {
  [playerId: string]: {
    owned: number;
    started?: number;
  };
}

export interface SleeperProjection {
  player_id: string;
  stats: Record<string, number>;
  week: number;
  season: string;
  season_type: string;
}

export interface SleeperScheduleGame {
  status: 'pre_game' | 'in_game' | 'complete';
  date: string;
  home: string;
  away: string;
  week: number;
  game_id: string;
}

export interface SleeperDepthChart {
  [position: string]: string[];
}

export interface SleeperTrendingPlayer {
  player_id: string;
  count: number;
}

// Position mapping for starting lineup slots
const STARTING_POSITIONS = [
  'QB', // Quarterback
  'RB', // Running Back 1
  'RB', // Running Back 2
  'WR', // Wide Receiver 1
  'WR', // Wide Receiver 2
  'WR', // Wide Receiver 3
  'TE', // Tight End
  'FLEX', // Flex (WR/RB/TE)
  'SUPER_FLEX', // Super Flex (QB/WR/RB/TE)
  'K', // Kicker
  'DEF' // Defense
];

export class SleeperApiService {
  private static baseUrl = 'https://api.sleeper.app/v1';
  private static baseUrlNoVersion = 'https://api.sleeper.app';

  /**
   * Fetch roster data for a specific league
   */
  static async fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
    try {
      console.log(`Fetching rosters for league: ${leagueId}`);

      // Track API call
      if (typeof window !== 'undefined') {
        (window as any).__apiCallCount = ((window as any).__apiCallCount || 0) + 1;
      }

      const response = await fetch(`${this.baseUrl}/league/${leagueId}/rosters`);

      if (!response.ok) {
        throw new Error(`Failed to fetch rosters: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} rosters for league ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching league rosters:', error);
      throw error;
    }
  }

  /**
   * Fetch all NFL players data (cached data, updated weekly)
   */
  static async fetchAllPlayers(): Promise<Record<string, SleeperPlayer>> {
    try {
      console.log('Fetching all NFL players data...');
      const response = await fetch(`${this.baseUrl}/players/nfl`);

      if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${Object.keys(data).length} players from Sleeper API`);
      return data;
    } catch (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
  }

  /**
   * Organize roster players into starters, bench, and IR
   */
  static organizeRoster(roster: SleeperRoster, allPlayers: Record<string, SleeperPlayer>): OrganizedRoster {
    const starters = (roster.starters || []).map((playerId, index) => {
      const player = allPlayers[playerId];
      const slotPosition = STARTING_POSITIONS[index] || 'BENCH';

      return {
        playerId,
        position: player?.position || 'UNK',
        slotPosition
      };
    });

    // Players not in starters array go to bench (excluding IR)
    const bench = (roster.players || []).filter((playerId) =>
      !(roster.starters || []).includes(playerId) && !(roster.reserve || []).includes(playerId)
    );

    return {
      starters,
      bench,
      ir: roster.reserve || []
    };
  }

  /**
   * Get team roster data with organized players
   */
  static async getTeamRosterData(leagueId: string, rosterId: number): Promise<{
    roster: SleeperRoster;
    organizedRoster: OrganizedRoster;
    allPlayers: Record<string, SleeperPlayer>;
  }> {
    try {
      // Fetch rosters from Sleeper API but players from database
      const [rosters, allPlayers] = await Promise.all([
        this.fetchLeagueRosters(leagueId),
        // Use robust player fetching method for complete coverage
        (async () => {

          // Use the robust player fetching method
          const allPlayersArray = await DatabaseService.getAllPlayersForMapping([
            { column: 'playing_status', operator: 'eq', value: 'Active' },
            { column: 'position', operator: 'in', value: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] }
          ]);

          // Convert to Sleeper format for compatibility
          const playersRecord: Record<string, SleeperPlayer> = {};
          allPlayersArray.forEach(player => {
            if (player.sleeper_id) {
              const nameParts = player.player_name.split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';

              playersRecord[player.sleeper_id] = {
                player_id: player.sleeper_id,
                first_name: firstName,
                last_name: lastName,
                position: player.position || '',
                team: player.nfl_team || '',
                jersey_number: player.number || 0,
                status: player.playing_status || '',
                injury_status: player.injury_status || '',
                age: player.age || 0,
                height: player.height?.toString() || '',
                weight: player.weight || 0,
                years_exp: 0,
                college: player.college || ''
              };
            }
          });

          return playersRecord;
        })()
      ]);

      // Find the specific roster
      const roster = rosters.find((r) => r.roster_id === rosterId);
      if (!roster) {
        throw new Error(`Roster with ID ${rosterId} not found in league ${leagueId}`);
      }

      // Organize the roster
      const organizedRoster = this.organizeRoster(roster, allPlayers);

      return {
        roster,
        organizedRoster,
        allPlayers
      };
    } catch (error) {
      console.error('Error getting team roster data:', error);
      throw error;
    }
  }

  /**
   * Get formatted player name
   */
  static getPlayerName(player: SleeperPlayer): string {
    if (!player) return 'Unknown Player';
    return `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown Player';
  }

  /**
   * Calculate points per game average
   */
  static calculatePointsPerGame(totalPoints: number, gamesPlayed: number): number {
    if (gamesPlayed === 0) return 0;
    return totalPoints / gamesPlayed;
  }

  /**
   * Format points with decimal precision
   */
  static formatPoints(points: number, decimal: number = 0): number {
    return points + decimal / 100;
  }

  /**
   * Fetch matchups for a specific league and week
   */
  static async fetchMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
    try {
      console.log(`🔗 Fetching matchups for league: ${leagueId}, week: ${week}`);

      // Track API call
      if (typeof window !== 'undefined') {
        (window as any).__apiCallCount = ((window as any).__apiCallCount || 0) + 1;
      }

      const response = await fetch(`${this.baseUrl}/league/${leagueId}/matchups/${week}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch matchups: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Enhanced logging for points debugging
      console.log(`✅ Fetched ${data.length} matchups for league ${leagueId}, week ${week}`);

      if (data.length > 0) {
        const pointsAnalysis = {
          totalMatchups: data.length,
          matchupsWithPoints: data.filter((m) => m.points > 0).length,
          matchupsWithZeroPoints: data.filter((m) => m.points === 0).length,
          matchupsWithNullPoints: data.filter((m) => m.points === null || m.points === undefined).length,
          pointsRange: {
            min: Math.min(...data.map((m) => m.points || 0)),
            max: Math.max(...data.map((m) => m.points || 0)),
            average: data.reduce((sum, m) => sum + (m.points || 0), 0) / data.length
          },
          playersPointsAvailability: {
            withPlayersPoints: data.filter((m) => m.players_points && Object.keys(m.players_points).length > 0).length,
            withStartersPoints: data.filter((m) => m.starters_points && m.starters_points.length > 0).length
          },
          sampleMatchup: {
            rosterId: data[0].roster_id,
            points: data[0].points,
            playersPointsKeys: Object.keys(data[0].players_points || {}).length,
            startersPointsLength: (data[0].starters_points || []).length,
            matchupId: data[0].matchup_id
          }
        };

        console.log(`📊 Points analysis for league ${leagueId}, week ${week}:`, pointsAnalysis);

        // Warn if no points data is available
        if (pointsAnalysis.matchupsWithPoints === 0) {
          console.warn(`⚠️ No matchups with points > 0 found for league ${leagueId}, week ${week}`);
          console.warn(`🔍 This could indicate: week hasn't started, games in progress, or API delay`);
        }

        // Warn if detailed points are missing
        if (pointsAnalysis.playersPointsAvailability.withPlayersPoints === 0) {
          console.warn(`⚠️ No player-level points data available for league ${leagueId}, week ${week}`);
        }
      } else {
        console.warn(`⚠️ No matchup data returned for league ${leagueId}, week ${week}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ Error fetching matchups for league ${leagueId}, week ${week}:`, error);
      throw error;
    }
  }

  /**
   * Fetch league information
   */
  static async fetchLeague(leagueId: string): Promise<SleeperLeague> {
    try {
      console.log(`Fetching league info: ${leagueId}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch league: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched league info for ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching league:', error);
      throw error;
    }
  }

  /**
   * Fetch users in a league
   */
  static async fetchLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
    try {
      console.log(`Fetching users for league: ${leagueId}`);

      // Track API call
      if (typeof window !== 'undefined') {
        (window as any).__apiCallCount = ((window as any).__apiCallCount || 0) + 1;
      }

      const response = await fetch(`${this.baseUrl}/league/${leagueId}/users`);

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} users for league ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching league users:', error);
      throw error;
    }
  }

  /**
   * Organize matchups by pairing teams
   */
  static organizeMatchups(
    matchups: SleeperMatchup[],
    rosters: SleeperRoster[],
    users: SleeperUser[])
    : Array<{
      matchup_id: number;
      teams: Array<{
        roster_id: number;
        points: number;
        owner: SleeperUser | null;
        roster: SleeperRoster | null;
      }>;
    }> {
    const matchupGroups = new Map<number, SleeperMatchup[]>();

    // Group matchups by matchup_id
    matchups.forEach((matchup) => {
      if (!matchupGroups.has(matchup.matchup_id)) {
        matchupGroups.set(matchup.matchup_id, []);
      }
      matchupGroups.get(matchup.matchup_id)!.push(matchup);
    });

    // Convert to organized format
    return Array.from(matchupGroups.entries()).
      filter(([_, teams]) => teams.length === 2) // Only include complete matchup pairs
      .map(([matchup_id, teams]) => ({
        matchup_id,
        teams: teams.map((team) => {
          const roster = rosters.find((r) => r.roster_id === team.roster_id);
          const owner = roster ? users.find((u) => u.user_id === roster.owner_id) : null;
          return {
            roster_id: team.roster_id,
            points: team.points,
            owner,
            roster
          };
        })
      }));
  }

  /**
   * Get current NFL week and state information
   */
  static async getCurrentNFLWeek(): Promise<number> {
    try {
      console.log('Fetching current NFL week from Sleeper API...');
      const response = await fetch(`${this.baseUrl}/state/nfl`);
      if (!response.ok) {
        throw new Error(`Failed to fetch NFL state: ${response.status} ${response.statusText}`);
      }
      const data: SleeperNFLState = await response.json();
      console.log('NFL State from Sleeper:', data);
      
      // Apply user's logic: if preseason, use week 1; if regular season, use actual week
      let currentWeek: number;
      if (data.season_type === 'pre') {
        // Preseason: always use week 1 for the current season
        currentWeek = 1;
        console.log(`Preseason detected - using week 1 for current season ${data.season}`);
      } else {
        // Regular season: use actual week, with fallbacks
        currentWeek = data.week || data.display_week || 1;
        console.log(`Regular season detected - using week ${currentWeek}`);
      }
      
      console.log(`Final current NFL week: ${currentWeek}`);
      return currentWeek;
    } catch (error) {
      console.error('Error fetching current NFL week:', error);
      console.warn('Falling back to default week 1');
      return 1; // Default to week 1 as fallback
    }
  }

  /**
   * Get full NFL state information
   */
  static async getNFLState(): Promise<SleeperNFLState> {
    try {
      console.log('Fetching NFL state from Sleeper API...');
      const response = await fetch(`${this.baseUrl}/state/nfl`);
      if (!response.ok) {
        throw new Error(`Failed to fetch NFL state: ${response.status} ${response.statusText}`);
      }
      const data: SleeperNFLState = await response.json();
      console.log('NFL State from Sleeper:', data);
      return data;
    } catch (error) {
      console.error('Error fetching NFL state:', error);
      throw error;
    }
  }

  /**
   * Fetch detailed weekly stats for a specific player and season
   */
  static async fetchPlayerSeasonStats(playerId: string, season: string): Promise<any[]> {
    try {
      console.log(`🔄 Fetching season stats for player: ${playerId}, season: ${season}`);

      // Validate inputs
      if (!playerId || !season) {
        console.error('❌ Invalid parameters: playerId or season is missing');
        return [];
      }

      // Track API call
      if (typeof window !== 'undefined') {
        (window as any).__apiCallCount = ((window as any).__apiCallCount || 0) + 1;
      }

      const response = await fetch(`${this.baseUrlNoVersion}/stats/nfl/player/${playerId}?season_type=regular&season=${season}&grouping=week`);

      if (!response.ok) {
        console.warn(`Failed to fetch player stats: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();

      // Log the raw response for debugging
      console.log(`🔍 Raw API response for player ${playerId}, season ${season}:`, data);
      console.log(`📊 Response type: ${typeof data}, is array: ${Array.isArray(data)}`);

      // Check if response is empty or null
      if (!data) {
        console.log(`ℹ️ No data returned for player ${playerId}, season ${season}`);
        return [];
      }

      // The API returns an object where keys are week numbers and values contain stats
      // Example: { "1": { stats: {...}, week: 1, ... }, "2": { stats: {...}, week: 2, ... } }
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const dataKeys = Object.keys(data);
        console.log(`📋 Found ${dataKeys.length} weeks in response:`, dataKeys);

        if (dataKeys.length === 0) {
          console.log(`ℹ️ Empty object returned for player ${playerId}, season ${season}`);
          return [];
        }
        const weeklyStats = Object.keys(data)
          .map(weekKey => {
            const weekData = data[weekKey];
            const weekNumber = parseInt(weekKey);

            // Skip null or invalid week data
            if (!weekData || typeof weekData !== 'object') {
              console.warn(`⚠️ Skipping invalid week data for week ${weekKey}:`, weekData);
              return null;
            }

            // Extract stats from the nested stats object and flatten with week info
            const stats = weekData.stats || {};

            // Ensure we have some meaningful data
            if (!stats || typeof stats !== 'object') {
              console.warn(`⚠️ No stats found for week ${weekKey}:`, weekData);
              return null;
            }

            return {
              week: weekNumber,
              season: weekData.season || season,
              team: weekData.team || null,
              opponent: weekData.opponent || null,
              date: weekData.date || null,
              // Flatten all the stats
              ...stats
            };
          })
          .filter(stat => stat !== null); // Remove null entries

        console.log(`✅ Parsed ${weeklyStats.length} weekly stats for player ${playerId}, season ${season}`);
        if (weeklyStats.length > 0) {
          console.log('Sample stat object:', weeklyStats[0]);
        } else {
          console.log('⚠️ No valid weekly stats found');
        }
        return weeklyStats;
      }

      // Fallback for array format (if API changes)
      if (Array.isArray(data)) {
        console.log(`Fetched ${data.length} weekly stats (array format) for player ${playerId}, season ${season}`);
        return data;
      }

      // Handle case where API returns a different format or error message
      if (typeof data === 'string') {
        console.warn(`⚠️ API returned string response for player ${playerId}, season ${season}:`, data);
        return [];
      }

      console.warn(`⚠️ Unexpected data format for player ${playerId}, season ${season}:`, data);
      console.warn(`Data type: ${typeof data}, keys:`, Object.keys(data || {}));
      return [];
    } catch (error) {
      console.error(`Error fetching player season stats for ${playerId}, season ${season}:`, error);
      return [];
    }
  }

  // User Endpoints

  /**
   * Get user by username or user ID
   */
  static async fetchUser(usernameOrId: string): Promise<SleeperUser> {
    try {
      console.log(`Fetching user: ${usernameOrId}`);
      const response = await fetch(`${this.baseUrl}/user/${usernameOrId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched user info for ${usernameOrId}`);
      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  /**
   * Get all leagues for a user
   */
  static async fetchUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
    try {
      console.log(`Fetching leagues for user: ${userId}, season: ${season}`);
      const response = await fetch(`${this.baseUrl}/user/${userId}/leagues/nfl/${season}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch user leagues: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} leagues for user ${userId}`);
      return data;
    } catch (error) {
      console.error('Error fetching user leagues:', error);
      throw error;
    }
  }

  // Draft Endpoints

  /**
   * Get all drafts for a user
   */
  static async fetchUserDrafts(userId: string, season: string): Promise<SleeperDraft[]> {
    try {
      console.log(`Fetching drafts for user: ${userId}, season: ${season}`);
      const response = await fetch(`${this.baseUrl}/user/${userId}/drafts/nfl/${season}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch user drafts: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} drafts for user ${userId}`);
      return data;
    } catch (error) {
      console.error('Error fetching user drafts:', error);
      throw error;
    }
  }

  /**
   * Get all drafts for a league
   */
  static async fetchLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
    try {
      console.log(`Fetching drafts for league: ${leagueId}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/drafts`);

      if (!response.ok) {
        throw new Error(`Failed to fetch league drafts: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} drafts for league ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching league drafts:', error);
      throw error;
    }
  }

  /**
   * Get a specific draft
   */
  static async fetchDraft(draftId: string): Promise<SleeperDraft> {
    try {
      console.log(`Fetching draft: ${draftId}`);
      const response = await fetch(`${this.baseUrl}/draft/${draftId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch draft: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched draft info for ${draftId}`);
      return data;
    } catch (error) {
      console.error('Error fetching draft:', error);
      throw error;
    }
  }

  /**
   * Get all picks in a draft
   */
  static async fetchDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
    try {
      console.log(`Fetching draft picks: ${draftId}`);
      const response = await fetch(`${this.baseUrl}/draft/${draftId}/picks`);

      if (!response.ok) {
        throw new Error(`Failed to fetch draft picks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} picks for draft ${draftId}`);
      return data;
    } catch (error) {
      console.error('Error fetching draft picks:', error);
      throw error;
    }
  }

  /**
   * Get traded picks in a draft
   */
  static async fetchDraftTradedPicks(draftId: string): Promise<SleeperTradedPick[]> {
    try {
      console.log(`Fetching traded picks for draft: ${draftId}`);
      const response = await fetch(`${this.baseUrl}/draft/${draftId}/traded_picks`);

      if (!response.ok) {
        throw new Error(`Failed to fetch traded picks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} traded picks for draft ${draftId}`);
      return data;
    } catch (error) {
      console.error('Error fetching traded picks:', error);
      throw error;
    }
  }

  // League Transaction and Playoff Endpoints

  /**
   * Get playoff bracket (winners)
   */
  static async fetchWinnersBracket(leagueId: string): Promise<SleeperPlayoffBracket[]> {
    try {
      console.log(`Fetching winners bracket for league: ${leagueId}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/winners_bracket`);

      if (!response.ok) {
        throw new Error(`Failed to fetch winners bracket: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched winners bracket for league ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching winners bracket:', error);
      throw error;
    }
  }

  /**
   * Get playoff bracket (losers)
   */
  static async fetchLosersBracket(leagueId: string): Promise<SleeperPlayoffBracket[]> {
    try {
      console.log(`Fetching losers bracket for league: ${leagueId}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/losers_bracket`);

      if (!response.ok) {
        throw new Error(`Failed to fetch losers bracket: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched losers bracket for league ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching losers bracket:', error);
      throw error;
    }
  }

  /**
   * Get transactions for a league
   */
  static async fetchTransactions(leagueId: string, round: number): Promise<SleeperTransaction[]> {
    try {
      console.log(`Fetching transactions for league: ${leagueId}, round: ${round}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/transactions/${round}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} transactions for league ${leagueId}, round ${round}`);
      return data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Get traded picks in a league
   */
  static async fetchLeagueTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
    try {
      console.log(`Fetching traded picks for league: ${leagueId}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/traded_picks`);

      if (!response.ok) {
        throw new Error(`Failed to fetch league traded picks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} traded picks for league ${leagueId}`);
      return data;
    } catch (error) {
      console.error('Error fetching league traded picks:', error);
      throw error;
    }
  }

  // Player Research and Statistics Endpoints

  /**
   * Get trending players by add/drop
   */
  static async fetchTrendingPlayers(
    sport: string = 'nfl',
    type: 'add' | 'drop' = 'add',
    lookbackHours: number = 24,
    limit: number = 25
  ): Promise<SleeperTrendingPlayer[]> {
    try {
      console.log(`Fetching trending ${type} players for ${sport}`);
      const response = await fetch(
        `${this.baseUrl}/players/${sport}/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch trending players: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} trending ${type} players`);
      return data;
    } catch (error) {
      console.error('Error fetching trending players:', error);
      throw error;
    }
  }

  /**
   * Get specific NFL player information
   */
  static async fetchPlayerInfo(playerId: string): Promise<SleeperPlayer> {
    try {
      console.log(`Fetching player info: ${playerId}`);
      const response = await fetch(`${this.baseUrlNoVersion}/players/nfl/${playerId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch player info: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched player info for ${playerId}`);
      return data;
    } catch (error) {
      console.error('Error fetching player info:', error);
      throw error;
    }
  }

  /**
   * Get NFL player research (ownership/starter percentages)
   */
  static async fetchPlayerResearch(
    seasonType: 'regular' | 'post',
    year: string,
    week: number
  ): Promise<SleeperPlayerResearch> {
    try {
      console.log(`Fetching player research for ${seasonType} season ${year}, week ${week}`);
      const response = await fetch(`${this.baseUrlNoVersion}/players/nfl/research/${seasonType}/${year}/${week}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch player research: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched player research data for ${seasonType} season ${year}, week ${week}`);
      return data;
    } catch (error) {
      console.error('Error fetching player research:', error);
      throw error;
    }
  }

  /**
   * Get NFL player season stats (full season)
   */
  static async fetchPlayerSeasonStatsComplete(
    playerId: string,
    seasonType: 'regular' | 'post',
    season: string
  ): Promise<SleeperPlayerStats[]> {
    try {
      console.log(`Fetching complete season stats for player: ${playerId}, ${seasonType} ${season}`);
      const response = await fetch(
        `${this.baseUrlNoVersion}/stats/nfl/player/${playerId}?season_type=${seasonType}&season=${season}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch player season stats: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched complete season stats for player ${playerId}`);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error('Error fetching player season stats:', error);
      throw error;
    }
  }

  /**
   * Get NFL player projections
   */
  static async fetchPlayerProjections(
    season: string,
    week: number,
    seasonType: 'regular' | 'post' = 'regular',
    positions: string[] = ['FLEX', 'QB', 'RB', 'TE', 'WR']
  ): Promise<SleeperProjection[]> {
    try {
      console.log(`Fetching player projections for ${seasonType} season ${season}, week ${week}`);
      const positionParams = positions.map(pos => `position[]=${pos}`).join('&');
      const response = await fetch(
        `${this.baseUrlNoVersion}/projections/nfl/${season}/${week}?season_type=${seasonType}&${positionParams}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch player projections: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched projections for ${data.length} players`);
      return data;
    } catch (error) {
      console.error('Error fetching player projections:', error);
      throw error;
    }
  }

  // NFL Schedule and Team Information

  /**
   * Get NFL schedule
   */
  static async fetchNFLSchedule(
    seasonType: 'regular' | 'post',
    year: string
  ): Promise<SleeperScheduleGame[]> {
    try {
      console.log(`Fetching NFL schedule for ${seasonType} ${year}`);
      const response = await fetch(`${this.baseUrlNoVersion}/schedule/nfl/${seasonType}/${year}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch NFL schedule: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} games from NFL schedule`);
      return data;
    } catch (error) {
      console.error('Error fetching NFL schedule:', error);
      throw error;
    }
  }

  /**
   * Get NFL team depth chart
   */
  static async fetchTeamDepthChart(team: string): Promise<SleeperDepthChart> {
    try {
      console.log(`Fetching depth chart for team: ${team}`);
      const response = await fetch(`${this.baseUrlNoVersion}/players/nfl/${team}/depth_chart`);

      if (!response.ok) {
        throw new Error(`Failed to fetch team depth chart: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched depth chart for team ${team}`);
      return data;
    } catch (error) {
      console.error('Error fetching team depth chart:', error);
      throw error;
    }
  }

  /**
   * Helper method to get avatar URL
   */
  static getAvatarUrl(avatarId: string | null, isThumb: boolean = false): string {
    if (!avatarId) {
      return '';
    }

    const baseUrl = isThumb
      ? 'https://sleepercdn.com/avatars/thumbs/'
      : 'https://sleepercdn.com/avatars/';

    return `${baseUrl}${avatarId}`;
  }
}

export default SleeperApiService;