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
      console.log(`🔗 Fetching matchups for league: ${leagueId}, week: ${week}`);
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

  /**
   * Fetch matchup data for a specific roster in a specific week
   * This is used for manual override scenarios where we need team-specific data
   */
  static async fetchTeamMatchupData(
  leagueId: string,
  week: number,
  rosterId: number)
  : Promise<SleeperMatchup | null> {
    try {
      console.log(`🎯 Fetching team-specific matchup data for roster ${rosterId}, league: ${leagueId}, week: ${week}`);

      const matchups = await this.fetchMatchups(leagueId, week);
      const teamMatchup = matchups.find((m) => m.roster_id === rosterId);

      if (!teamMatchup) {
        console.warn(`⚠️ No matchup data found for roster ${rosterId} in week ${week}`);
        return null;
      }

      console.log(`✅ Found matchup data for roster ${rosterId}:`, {
        points: teamMatchup.points,
        starters: teamMatchup.starters?.length || 0,
        playersPoints: Object.keys(teamMatchup.players_points || {}).length
      });

      return teamMatchup;
    } catch (error) {
      console.error(`❌ Error fetching team matchup data for roster ${rosterId}:`, error);
      return null;
    }
  }

  /**
   * Fetch roster and matchup data for multiple specific teams
   * Used for manual override scenarios with enhanced error handling and validation
   */
  static async fetchTeamsMatchupData(
  leagueId: string,
  week: number,
  rosterIds: number[])
  : Promise<{
    matchups: SleeperMatchup[];
    rosters: SleeperRoster[];
    users: SleeperUser[];
    allPlayers: Record<string, SleeperPlayer>;
  }> {
    try {
      console.log(`🎯 Enhanced team-specific data fetch for rosters:`, rosterIds);

      // Validate input parameters
      if (!leagueId || !leagueId.trim()) {
        throw new Error('Invalid league ID provided');
      }
      if (!Array.isArray(rosterIds) || rosterIds.length === 0) {
        throw new Error('Invalid or empty roster IDs array provided');
      }
      if (week < 1 || week > 18) {
        console.warn(`⚠️ Week ${week} is outside normal range (1-18)`);
      }

      // Fetch all necessary data in parallel with individual error handling
      const dataPromises = [
        this.fetchMatchups(leagueId, week).catch(error => {
          console.error(`Failed to fetch matchups:`, error);
          return [];
        }),
        this.fetchLeagueRosters(leagueId).catch(error => {
          console.error(`Failed to fetch rosters:`, error);
          return [];
        }),
        this.fetchLeagueUsers(leagueId).catch(error => {
          console.error(`Failed to fetch users:`, error);
          return [];
        }),
        this.fetchAllPlayers().catch(error => {
          console.error(`Failed to fetch players:`, error);
          return {};
        })
      ];

      const [matchups, rosters, users, allPlayers] = await Promise.all(dataPromises);

      // Filter matchups for the specific roster IDs
      const teamMatchups = matchups.filter((m) => rosterIds.includes(m.roster_id));

      // Filter rosters for the specific roster IDs
      const teamRosters = rosters.filter((r) => rosterIds.includes(r.roster_id));

      // Enhanced validation and logging
      const validationResults = {
        requestedRosters: rosterIds.length,
        foundMatchups: teamMatchups.length,
        foundRosters: teamRosters.length,
        totalUsers: users.length,
        totalPlayers: Object.keys(allPlayers).length,
        matchupsWithData: teamMatchups.filter(m => 
          m.players_points && Object.keys(m.players_points).length > 0
        ).length,
        matchupsWithStarters: teamMatchups.filter(m => 
          m.starters && m.starters.length > 0
        ).length,
        rostersWithStarters: teamRosters.filter(r => 
          r.starters && r.starters.length > 0
        ).length
      };

      console.log(`✅ Enhanced team data fetch results:`, validationResults);

      // Warn about potential data issues
      if (validationResults.foundMatchups < validationResults.requestedRosters) {
        const missingRosters = rosterIds.filter(id => 
          !teamMatchups.some(m => m.roster_id === id)
        );
        console.warn(`⚠️ Missing matchup data for rosters:`, missingRosters);
      }

      if (validationResults.foundRosters < validationResults.requestedRosters) {
        const missingRosters = rosterIds.filter(id => 
          !teamRosters.some(r => r.roster_id === id)
        );
        console.warn(`⚠️ Missing roster data for rosters:`, missingRosters);
      }

      if (validationResults.matchupsWithData === 0 && teamMatchups.length > 0) {
        console.warn(`⚠️ No player points data available for any matchups in week ${week}`);
      }

      // Log detailed matchup data for debugging
      teamMatchups.forEach((matchup, index) => {
        console.log(`📈 Matchup ${index + 1} data quality:`, {
          rosterId: matchup.roster_id,
          points: matchup.points ?? 'null',
          playersPointsCount: Object.keys(matchup.players_points || {}).length,
          startersPointsCount: (matchup.starters_points || []).length,
          startersCount: (matchup.starters || []).length
        });
      });

      return {
        matchups: teamMatchups,
        rosters: teamRosters,
        users,
        allPlayers
      };
    } catch (error) {
      console.error(`❌ Error in enhanced teams matchup data fetch:`, error);
      throw new Error(`Failed to fetch team matchup data: ${error}`);
    }
  }

  /**
   * Get roster data for a specific team (enhanced version)
   */
  static async getTeamRosterWithMatchupData(
  leagueId: string,
  rosterId: number,
  week: number)
  : Promise<{
    roster: SleeperRoster;
    matchupData: SleeperMatchup | null;
    organizedRoster: OrganizedRoster;
    allPlayers: Record<string, SleeperPlayer>;
  }> {
    try {
      console.log(`🎯 Fetching enhanced roster data for roster ${rosterId}, week ${week}`);

      // Fetch both roster and matchup data
      const [rosterData, matchupData] = await Promise.all([
      this.getTeamRosterData(leagueId, rosterId),
      this.fetchTeamMatchupData(leagueId, week, rosterId)]
      );

      return {
        roster: rosterData.roster,
        matchupData,
        organizedRoster: rosterData.organizedRoster,
        allPlayers: rosterData.allPlayers
      };
    } catch (error) {
      console.error(`❌ Error fetching enhanced roster data for roster ${rosterId}:`, error);
      throw error;
    }
  }
}

export default SleeperApiService;