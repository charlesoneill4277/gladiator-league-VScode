// Service for integrating with Sleeper API
export interface SleeperRoster {
  starters: string[];
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
  reserve: string[];
  players: string[];
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

  /**
   * Fetch roster data for a specific league
   */
  static async fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
    try {
      console.log(`Fetching rosters for league: ${leagueId}`);
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
    const starters = roster.starters.map((playerId, index) => {
      const player = allPlayers[playerId];
      const slotPosition = STARTING_POSITIONS[index] || 'BENCH';

      return {
        playerId,
        position: player?.position || 'UNK',
        slotPosition
      };
    });

    // Players not in starters array go to bench (excluding IR)
    const bench = roster.players.filter((playerId) =>
    !roster.starters.includes(playerId) && !roster.reserve.includes(playerId)
    );

    return {
      starters,
      bench,
      ir: roster.reserve
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
      // Fetch both rosters and players data
      const [rosters, allPlayers] = await Promise.all([
      this.fetchLeagueRosters(leagueId),
      this.fetchAllPlayers()]
      );

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
      console.log(`Fetching matchups for league: ${leagueId}, week: ${week}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/matchups/${week}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch matchups: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} matchups for league ${leagueId}, week ${week}`);

      // Log points data for debugging
      data.forEach((matchup: SleeperMatchup) => {
        console.log(`Week ${week} - Roster ${matchup.roster_id}: ${matchup.points} points (Matchup ID: ${matchup.matchup_id})`);
      });

      return data;
    } catch (error) {
      console.error('Error fetching matchups:', error);
      throw error;
    }
  }

  /**
   * Fetch matchups for all weeks in a season (weeks 1-17)
   */
  static async fetchAllSeasonMatchups(leagueId: string): Promise<Record<number, SleeperMatchup[]>> {
    try {
      console.log(`Fetching all season matchups for league: ${leagueId}`);
      const weeklyMatchups: Record<number, SleeperMatchup[]> = {};

      // Fetch data for weeks 1-17
      for (let week = 1; week <= 17; week++) {
        try {
          const matchups = await this.fetchMatchups(leagueId, week);
          weeklyMatchups[week] = matchups;
        } catch (error) {
          console.warn(`Failed to fetch matchups for week ${week}:`, error);
          weeklyMatchups[week] = [];
        }
      }

      return weeklyMatchups;
    } catch (error) {
      console.error('Error fetching all season matchups:', error);
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
   * Organize matchups by pairing teams with enhanced data preservation
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
      custom_points?: number;
      starters: string[];
      players: string[];
      starters_points: number[];
      players_points: Record<string, number>;
      owner: SleeperUser | null;
      roster: SleeperRoster | null;
    }>;
  }> {
    console.log(`Starting organizeMatchups with ${matchups.length} raw matchups`);
    
    // Validate input data
    if (!Array.isArray(matchups) || matchups.length === 0) {
      console.warn('No matchups provided to organize');
      return [];
    }

    if (!Array.isArray(rosters) || rosters.length === 0) {
      console.warn('No rosters provided for matchup organization');
    }

    if (!Array.isArray(users) || users.length === 0) {
      console.warn('No users provided for matchup organization');
    }

    const matchupGroups = new Map<number, SleeperMatchup[]>();

    // Group matchups by matchup_id with validation
    matchups.forEach((matchup, index) => {
      // Validate matchup data integrity
      if (!matchup || typeof matchup.matchup_id !== 'number') {
        console.warn(`Invalid matchup at index ${index}:`, matchup);
        return;
      }

      if (!matchupGroups.has(matchup.matchup_id)) {
        matchupGroups.set(matchup.matchup_id, []);
      }
      
      // Log points data preservation for debugging
      console.log(`Processing matchup ${matchup.matchup_id} - Roster ${matchup.roster_id}:`, {
        points: matchup.points,
        custom_points: matchup.custom_points,
        starters_points_length: matchup.starters_points?.length || 0,
        players_points_count: Object.keys(matchup.players_points || {}).length,
        starters_count: matchup.starters?.length || 0,
        players_count: matchup.players?.length || 0
      });
      
      matchupGroups.get(matchup.matchup_id)!.push(matchup);
    });

    console.log(`Grouped matchups into ${matchupGroups.size} matchup pairs`);

    // Convert to organized format with comprehensive data preservation
    const organizedMatchups = Array.from(matchupGroups.entries())
    .filter(([matchup_id, teams]) => {
      if (teams.length !== 2) {
        console.warn(`Incomplete matchup ${matchup_id}: ${teams.length} teams (expected 2)`);
        return false;
      }
      return true;
    })
    .map(([matchup_id, teams]) => {
      console.log(`Organizing matchup ${matchup_id} with teams:`, teams.map(t => t.roster_id));
      
      return {
        matchup_id,
        teams: teams.map((team) => {
          // Find associated roster and owner
          const roster = rosters.find((r) => r.roster_id === team.roster_id);
          const owner = roster ? users.find((u) => u.user_id === roster.owner_id) : null;

          // Validate and preserve points data
          const points = typeof team.points === 'number' ? team.points : 0;
          const custom_points = typeof team.custom_points === 'number' ? team.custom_points : undefined;
          const starters_points = Array.isArray(team.starters_points) ? team.starters_points : [];
          const players_points = team.players_points && typeof team.players_points === 'object' ? team.players_points : {};
          const starters = Array.isArray(team.starters) ? team.starters : [];
          const players = Array.isArray(team.players) ? team.players : [];

          // Log data preservation for debugging
          console.log(`Team ${team.roster_id} data preservation:`, {
            roster_id: team.roster_id,
            points: points,
            custom_points: custom_points,
            starters_points_preserved: starters_points.length,
            players_points_preserved: Object.keys(players_points).length,
            starters_preserved: starters.length,
            players_preserved: players.length,
            owner_found: !!owner,
            roster_found: !!roster
          });

          // Validate points data integrity
          if (points === 0 && starters_points.length > 0) {
            const calculatedPoints = starters_points.reduce((sum, p) => sum + (p || 0), 0);
            console.warn(`Points mismatch for roster ${team.roster_id}: reported ${points}, calculated from starters ${calculatedPoints}`);
          }

          return {
            roster_id: team.roster_id,
            points: points,
            custom_points: custom_points,
            starters: starters,
            players: players,
            starters_points: starters_points,
            players_points: players_points,
            owner: owner,
            roster: roster
          };
        })
      };
    });

    console.log(`Successfully organized ${organizedMatchups.length} complete matchup pairs`);
    
    // Final validation log
    organizedMatchups.forEach((matchup) => {
      console.log(`Final matchup ${matchup.matchup_id} validation:`, {
        teams_count: matchup.teams.length,
        team_points: matchup.teams.map(t => ({ roster_id: t.roster_id, points: t.points })),
        data_integrity: matchup.teams.every(t => 
          typeof t.points === 'number' && 
          Array.isArray(t.starters_points) && 
          typeof t.players_points === 'object'
        )
      });
    });
    
    return organizedMatchups;
  }

  /**
   * Get current NFL week
   */
  static async getCurrentNFLWeek(): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/state/nfl`);
      if (!response.ok) {
        throw new Error('Failed to fetch NFL state');
      }
      const data = await response.json();
      return data.week || 1;
    } catch (error) {
      console.error('Error fetching current NFL week:', error);
      return 14; // Default to week 14 as fallback
    }
  }
}

export default SleeperApiService;