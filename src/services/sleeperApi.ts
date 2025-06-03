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

export interface LiveScoringData {
  roster_id: number;
  team_points: number;
  matchup_id: number;
  starters: Array<{
    playerId: string;
    position: string;
    points: number;
    is_starter: boolean;
  }>;
  bench: Array<{
    playerId: string;
    position: string;
    points: number;
  }>;
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
  private static matchupCache = new Map<string, { data: SleeperMatchup[]; timestamp: number }>();
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
   * Fetch matchup data for a specific league and week
   */
  static async fetchLeagueMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
    try {
      const cacheKey = `${leagueId}_${week}`;
      const cached = this.matchupCache.get(cacheKey);
      
      // Check if we have valid cached data
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`📦 Using cached matchup data for league ${leagueId}, week ${week}`);
        return cached.data;
      }

      console.log(`🔄 Fetching fresh matchup data for league ${leagueId}, week ${week}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/matchups/${week}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch matchups: ${response.status} ${response.statusText}`);
      }

      const data: SleeperMatchup[] = await response.json();
      
      // Cache the data
      this.matchupCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      console.log(`✅ Fetched ${data.length} matchups for league ${leagueId}, week ${week}`);
      return data;
    } catch (error) {
      console.error('❌ Error fetching league matchups:', error);
      throw error;
    }
  }

  /**
   * Process matchup data into live scoring format
   */
  static async processLiveScoringData(
    leagueId: string, 
    week: number, 
    allPlayers?: Record<string, SleeperPlayer>
  ): Promise<LiveScoringData[]> {
    try {
      // Fetch matchups and players data
      const [matchups, players] = await Promise.all([
        this.fetchLeagueMatchups(leagueId, week),
        allPlayers || this.fetchAllPlayers()
      ]);

      const liveScoringData: LiveScoringData[] = [];

      for (const matchup of matchups) {
        const starters = matchup.starters.map((playerId, index) => ({
          playerId,
          position: players[playerId]?.position || 'UNK',
          points: matchup.starters_points?.[index] || 0,
          is_starter: true
        }));

        const bench = matchup.players
          .filter(playerId => !matchup.starters.includes(playerId))
          .map(playerId => ({
            playerId,
            position: players[playerId]?.position || 'UNK',
            points: matchup.players_points?.[playerId] || 0
          }));

        liveScoringData.push({
          roster_id: matchup.roster_id,
          team_points: matchup.points || 0,
          matchup_id: matchup.matchup_id,
          starters,
          bench
        });
      }

      return liveScoringData;
    } catch (error) {
      console.error('❌ Error processing live scoring data:', error);
      throw error;
    }
  }

  /**
   * Get live scoring data for specific roster
   */
  static async getRosterLiveScoring(
    leagueId: string, 
    week: number, 
    rosterId: number
  ): Promise<LiveScoringData | null> {
    try {
      const liveScoringData = await this.processLiveScoringData(leagueId, week);
      return liveScoringData.find(data => data.roster_id === rosterId) || null;
    } catch (error) {
      console.error('❌ Error getting roster live scoring:', error);
      return null;
    }
  }

  /**
   * Clear matchup cache (for manual refresh)
   */
  static clearMatchupCache(): void {
    console.log('🗑️ Clearing matchup cache');
    this.matchupCache.clear();
  }

  /**
   * Get cache status for debugging
   */
  static getCacheStatus(): Record<string, { age: number; entries: number }> {
    const status: Record<string, { age: number; entries: number }> = {};
    
    this.matchupCache.forEach((cached, key) => {
      status[key] = {
        age: Date.now() - cached.timestamp,
        entries: cached.data.length
      };
    });

    return status;
  }
}

export default SleeperApiService;