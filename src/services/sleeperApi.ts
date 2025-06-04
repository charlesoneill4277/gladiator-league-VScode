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

// Team data quality metrics interface
export interface TeamDataQuality {
  rosterId: number;
  hasRosterData: boolean;
  hasMatchupData: boolean;
  hasPlayerPoints: boolean;
  hasStarterPoints: boolean;
  validPlayersCount: number;
  validStartersCount: number;
  dataCompleteness: number; // 0-100 percentage
  issues: string[];
}

// Enhanced team roster with validation
export interface ValidatedTeamRoster {
  roster: SleeperRoster;
  matchupData: SleeperMatchup | null;
  organizedRoster: OrganizedRoster;
  dataQuality: TeamDataQuality;
  validationErrors: string[];
}

// Retry configuration interface
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponential: boolean;
}

export class SleeperApiService {
  private static baseUrl = 'https://api.sleeper.app/v1';
  private static defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponential: true
  };

  /**
   * Sleep utility for retry mechanism
   */
  private static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Enhanced fetch with retry mechanism
   */
  private static async fetchWithRetry(
  url: string,
  config: RetryConfig = this.defaultRetryConfig)
  : Promise<Response> {
    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        console.log(`🔄 Fetching ${url} (attempt ${attempt + 1}/${config.maxRetries + 1})`);
        const response = await fetch(url);

        if (response.ok) {
          console.log(`✅ Successfully fetched ${url} on attempt ${attempt + 1}`);
          return response;
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : config.baseDelay;
          console.log(`⏳ Rate limited, waiting ${delay}ms before retry`);
          await this.sleep(delay);
          continue;
        }

        // Handle server errors
        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status} ${response.statusText}`);
        } else {
          // Client errors - don't retry
          throw new Error(`Client error: ${response.status} ${response.statusText}`);
        }

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Attempt ${attempt + 1} failed for ${url}:`, error);
      }

      // Calculate delay for next attempt
      if (attempt < config.maxRetries) {
        const delay = config.exponential ?
        Math.min(config.baseDelay * Math.pow(2, attempt), config.maxDelay) :
        config.baseDelay;
        console.log(`⏳ Waiting ${delay}ms before next attempt`);
        await this.sleep(delay);
      }
    }

    console.error(`❌ All retry attempts failed for ${url}`);
    throw lastError!;
  }

  /**
   * Validate team data quality
   */
  static validateTeamData(
  rosterId: number,
  roster: SleeperRoster | null,
  matchupData: SleeperMatchup | null,
  allPlayers: Record<string, SleeperPlayer>)
  : TeamDataQuality {
    const issues: string[] = [];
    let dataCompleteness = 0;
    let validPlayersCount = 0;
    let validStartersCount = 0;

    // Check roster data
    const hasRosterData = roster !== null;
    if (!hasRosterData) {
      issues.push('Missing roster data');
    } else {
      // Validate players exist in player database
      if (roster.players) {
        validPlayersCount = roster.players.filter((playerId) =>
        allPlayers[playerId] !== undefined
        ).length;

        if (validPlayersCount < roster.players.length) {
          issues.push(`${roster.players.length - validPlayersCount} players not found in player database`);
        }
      }

      // Validate starters
      if (roster.starters) {
        validStartersCount = roster.starters.filter((playerId) =>
        allPlayers[playerId] !== undefined
        ).length;

        if (validStartersCount < roster.starters.length) {
          issues.push(`${roster.starters.length - validStartersCount} starters not found in player database`);
        }
      }

      dataCompleteness += 40; // Base roster data
    }

    // Check matchup data
    const hasMatchupData = matchupData !== null;
    if (!hasMatchupData) {
      issues.push('Missing matchup data');
    } else {
      dataCompleteness += 30; // Matchup data present
    }

    // Check player points
    const hasPlayerPoints = matchupData?.players_points &&
    Object.keys(matchupData.players_points).length > 0;
    if (!hasPlayerPoints) {
      issues.push('Missing player points data');
    } else {
      dataCompleteness += 20; // Player points available
    }

    // Check starter points
    const hasStarterPoints = matchupData?.starters_points &&
    matchupData.starters_points.length > 0;
    if (!hasStarterPoints) {
      issues.push('Missing starter points data');
    } else {
      dataCompleteness += 10; // Starter points available
    }

    return {
      rosterId,
      hasRosterData,
      hasMatchupData,
      hasPlayerPoints,
      hasStarterPoints,
      validPlayersCount,
      validStartersCount,
      dataCompleteness,
      issues
    };
  }

  /**
   * Enhanced roster data fetching with comprehensive validation
   */
  static async fetchIndividualTeamRoster(
  leagueId: string,
  rosterId: number,
  retryConfig?: RetryConfig)
  : Promise<ValidatedTeamRoster> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    const validationErrors: string[] = [];

    try {
      console.log(`🎯 Fetching individual team roster for roster ${rosterId}`);

      // Fetch all required data
      const [rosters, allPlayers] = await Promise.allSettled([
      this.fetchLeagueRosters(leagueId),
      this.fetchAllPlayers()]
      );

      // Handle roster fetch result
      let rosterData: SleeperRoster | null = null;
      if (rosters.status === 'fulfilled') {
        rosterData = rosters.value.find((r) => r.roster_id === rosterId) || null;
        if (!rosterData) {
          validationErrors.push(`Roster ${rosterId} not found in league ${leagueId}`);
        }
      } else {
        validationErrors.push(`Failed to fetch rosters: ${rosters.reason}`);
      }

      // Handle players fetch result
      let playersData: Record<string, SleeperPlayer> = {};
      if (allPlayers.status === 'fulfilled') {
        playersData = allPlayers.value;
      } else {
        validationErrors.push(`Failed to fetch players: ${allPlayers.reason}`);
      }

      // Create organized roster even with partial data
      const organizedRoster = rosterData ?
      this.organizeRoster(rosterData, playersData) :
      { starters: [], bench: [], ir: [] };

      // Validate data quality
      const dataQuality = this.validateTeamData(
        rosterId,
        rosterData,
        null, // No matchup data in this method
        playersData
      );

      console.log(`📊 Team ${rosterId} data quality:`, dataQuality);

      return {
        roster: rosterData!,
        matchupData: null,
        organizedRoster,
        dataQuality,
        validationErrors
      };

    } catch (error) {
      console.error(`❌ Error fetching individual team roster for ${rosterId}:`, error);
      validationErrors.push(`Unexpected error: ${error}`);

      // Return minimal structure with error information
      return {
        roster: null as any,
        matchupData: null,
        organizedRoster: { starters: [], bench: [], ir: [] },
        dataQuality: this.validateTeamData(rosterId, null, null, {}),
        validationErrors
      };
    }
  }

  /**
   * Fetch roster data for a specific league
   */
  static async fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
    try {
      console.log(`📈 Fetching rosters for league: ${leagueId}`);
      const response = await this.fetchWithRetry(`${this.baseUrl}/league/${leagueId}/rosters`);
      const data = await response.json();

      // Enhanced validation and logging
      const validationResults = {
        totalRosters: data.length,
        rostersWithPlayers: data.filter((r: SleeperRoster) => r.players && r.players.length > 0).length,
        rostersWithStarters: data.filter((r: SleeperRoster) => r.starters && r.starters.length > 0).length,
        rostersWithSettings: data.filter((r: SleeperRoster) => r.settings).length,
        averagePlayerCount: data.reduce((sum: number, r: SleeperRoster) => sum + (r.players?.length || 0), 0) / data.length
      };

      console.log(`✅ Fetched ${data.length} rosters for league ${leagueId}:`, validationResults);

      // Warn about potential data issues
      if (validationResults.rostersWithPlayers < validationResults.totalRosters) {
        console.warn(`⚠️ ${validationResults.totalRosters - validationResults.rostersWithPlayers} rosters have no players`);
      }

      return data;
    } catch (error) {
      console.error('❌ Error fetching league rosters:', error);
      throw error;
    }
  }

  /**
   * Fetch all NFL players data (cached data, updated weekly)
   */
  static async fetchAllPlayers(): Promise<Record<string, SleeperPlayer>> {
    try {
      console.log('🏈 Fetching all NFL players data...');
      const response = await this.fetchWithRetry(`${this.baseUrl}/players/nfl`);
      const data = await response.json();

      // Enhanced validation and logging
      const validationResults = {
        totalPlayers: Object.keys(data).length,
        playersByPosition: {} as Record<string, number>,
        activePlayersCount: 0,
        playersWithTeams: 0,
        playersWithInjuryStatus: 0
      };

      // Analyze player data quality
      Object.values(data).forEach((player: any) => {
        // Count by position
        const pos = player.position || 'UNKNOWN';
        validationResults.playersByPosition[pos] = (validationResults.playersByPosition[pos] || 0) + 1;

        // Count active players
        if (player.status === 'Active') validationResults.activePlayersCount++;

        // Count players with teams
        if (player.team) validationResults.playersWithTeams++;

        // Count players with injury status
        if (player.injury_status) validationResults.playersWithInjuryStatus++;
      });

      console.log(`✅ Fetched ${Object.keys(data).length} players from Sleeper API:`, validationResults);

      return data;
    } catch (error) {
      console.error('❌ Error fetching players:', error);
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
      const response = await this.fetchWithRetry(`${this.baseUrl}/league/${leagueId}/matchups/${week}`);
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
      console.log(`🏆 Fetching league info: ${leagueId}`);
      const response = await this.fetchWithRetry(`${this.baseUrl}/league/${leagueId}`);
      const data = await response.json();

      // Enhanced validation
      const validationResults = {
        hasSettings: !!data.settings,
        hasRosterPositions: data.roster_positions && data.roster_positions.length > 0,
        hasScoringSettings: data.scoring_settings && Object.keys(data.scoring_settings).length > 0,
        totalRosters: data.total_rosters,
        status: data.status
      };

      console.log(`✅ Fetched league info for ${leagueId}:`, validationResults);
      return data;
    } catch (error) {
      console.error('❌ Error fetching league:', error);
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
      this.fetchMatchups(leagueId, week).catch((error) => {
        console.error(`Failed to fetch matchups:`, error);
        return [];
      }),
      this.fetchLeagueRosters(leagueId).catch((error) => {
        console.error(`Failed to fetch rosters:`, error);
        return [];
      }),
      this.fetchLeagueUsers(leagueId).catch((error) => {
        console.error(`Failed to fetch users:`, error);
        return [];
      }),
      this.fetchAllPlayers().catch((error) => {
        console.error(`Failed to fetch players:`, error);
        return {};
      })];


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
        matchupsWithData: teamMatchups.filter((m) =>
        m.players_points && Object.keys(m.players_points).length > 0
        ).length,
        matchupsWithStarters: teamMatchups.filter((m) =>
        m.starters && m.starters.length > 0
        ).length,
        rostersWithStarters: teamRosters.filter((r) =>
        r.starters && r.starters.length > 0
        ).length
      };

      console.log(`✅ Enhanced team data fetch results:`, validationResults);

      // Warn about potential data issues
      if (validationResults.foundMatchups < validationResults.requestedRosters) {
        const missingRosters = rosterIds.filter((id) =>
        !teamMatchups.some((m) => m.roster_id === id)
        );
        console.warn(`⚠️ Missing matchup data for rosters:`, missingRosters);
      }

      if (validationResults.foundRosters < validationResults.requestedRosters) {
        const missingRosters = rosterIds.filter((id) =>
        !teamRosters.some((r) => r.roster_id === id)
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