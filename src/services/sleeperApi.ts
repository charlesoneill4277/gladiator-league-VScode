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
  custom_points: number | null;
  points: number;
}

export interface ProcessedMatchupData {
  matchupId: number;
  week: number;
  teams: Array<{
    teamId: number;
    teamName: string;
    ownerName: string;
    rosterId: number;
    points: number;
    starters: Array<{
      playerId: string;
      playerName: string;
      position: string;
      nflTeam: string;
      points: number;
      slotPosition: string;
    }>;
    bench: Array<{
      playerId: string;
      playerName: string;
      position: string;
      nflTeam: string;
      points: number;
    }>;
  }>;
  isLive: boolean;
  lastUpdate: string;
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
   * Fetch matchup data for a specific league and week
   */
  static async fetchMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
    try {
      console.log(`Fetching matchups for league: ${leagueId}, week: ${week}`);
      const response = await fetch(`${this.baseUrl}/league/${leagueId}/matchups/${week}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch matchups: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} matchup entries for league ${leagueId}, week ${week}`);
      return data;
    } catch (error) {
      console.error('Error fetching matchups:', error);
      throw error;
    }
  }

  /**
   * Process matchup data by combining teams and mapping to database info
   */
  static async processMatchupData(
    leagueId: string,
    week: number,
    teamDataMap: Map<number, { teamId: number; teamName: string; ownerName: string }>
  ): Promise<ProcessedMatchupData[]> {
    try {
      const [matchups, allPlayers] = await Promise.all([
        this.fetchMatchups(leagueId, week),
        this.fetchAllPlayers()
      ]);

      // Group matchups by matchup_id
      const matchupGroups = new Map<number, SleeperMatchup[]>();
      matchups.forEach(matchup => {
        if (!matchupGroups.has(matchup.matchup_id)) {
          matchupGroups.set(matchup.matchup_id, []);
        }
        matchupGroups.get(matchup.matchup_id)!.push(matchup);
      });

      const processedMatchups: ProcessedMatchupData[] = [];

      for (const [matchupId, teamMatchups] of matchupGroups) {
        if (teamMatchups.length !== 2) {
          console.warn(`Matchup ${matchupId} has ${teamMatchups.length} teams, skipping`);
          continue;
        }

        const teams = teamMatchups.map(matchup => {
          const teamData = teamDataMap.get(matchup.roster_id);
          if (!teamData) {
            console.warn(`No team data found for roster_id ${matchup.roster_id}`);
            return null;
          }

          // Process starters
          const starters = matchup.starters.map((playerId, index) => {
            const player = allPlayers[playerId];
            const slotPosition = STARTING_POSITIONS[index] || 'BENCH';
            
            return {
              playerId,
              playerName: player ? this.getPlayerName(player) : 'Unknown Player',
              position: player?.position || 'UNK',
              nflTeam: player?.team || 'FA',
              points: 0, // Will be updated with real scoring data when available
              slotPosition
            };
          });

          // Process bench players
          const bench = matchup.players
            .filter(playerId => !matchup.starters.includes(playerId))
            .map(playerId => {
              const player = allPlayers[playerId];
              return {
                playerId,
                playerName: player ? this.getPlayerName(player) : 'Unknown Player',
                position: player?.position || 'UNK',
                nflTeam: player?.team || 'FA',
                points: 0 // Will be updated with real scoring data when available
              };
            });

          return {
            teamId: teamData.teamId,
            teamName: teamData.teamName,
            ownerName: teamData.ownerName,
            rosterId: matchup.roster_id,
            points: matchup.custom_points || matchup.points,
            starters,
            bench
          };
        }).filter(Boolean) as ProcessedMatchupData['teams'];

        if (teams.length === 2) {
          processedMatchups.push({
            matchupId,
            week,
            teams,
            isLive: true, // Can be determined based on game status
            lastUpdate: new Date().toISOString()
          });
        }
      }

      return processedMatchups;
    } catch (error) {
      console.error('Error processing matchup data:', error);
      throw error;
    }
  }
}

export default SleeperApiService;