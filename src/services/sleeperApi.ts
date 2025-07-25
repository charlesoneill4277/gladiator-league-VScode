// Service for integrating with Sleeper API
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
          const { DatabaseService } = await import('./databaseService');
          
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
      console.log(`Current NFL week: ${data.week}`);
      return data.week || 1;
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
}

export default SleeperApiService;