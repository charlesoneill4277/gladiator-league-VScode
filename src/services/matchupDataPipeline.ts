/**
 * Comprehensive Matchup Data Pipeline Service
 * Handles the complete data flow from database tables to Sleeper API integration
 */

export interface TeamInfo {
  teamId: number;
  teamName: string;
  ownerName: string;
  ownerId: string;
  conferenceId: number;
  conferenceName: string;
  leagueId: string;
  rosterId: string;
  seasonId: number;
  seasonYear: number;
}

export interface SleeperMatchupData {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  starters_points?: { [key: string]: number };
  players_points?: { [key: string]: number };
}

export interface ProcessedTeamMatchupData {
  teamInfo: TeamInfo;
  sleeperData: SleeperMatchupData;
  starters: Array<{ playerId: string; playerName: string; points: number }>;
  bench: Array<{ playerId: string; playerName: string; points: number }>;
  totalPoints: number;
}

export interface ProcessedMatchup {
  matchupId: number;
  week: number;
  team1: ProcessedTeamMatchupData;
  team2: ProcessedTeamMatchupData;
  isPlayoff: boolean;
  status: string;
  winner?: ProcessedTeamMatchupData;
}

class MatchupDataPipeline {
  private static instance: MatchupDataPipeline;
  private playerCache: Map<string, string> = new Map();
  private teamInfoCache: Map<string, TeamInfo> = new Map();

  public static getInstance(): MatchupDataPipeline {
    if (!MatchupDataPipeline.instance) {
      MatchupDataPipeline.instance = new MatchupDataPipeline();
    }
    return MatchupDataPipeline.instance;
  }

  /**
   * Main method to get processed matchup data for a specific week
   */
  async getMatchupsForWeek(week: number): Promise<ProcessedMatchup[]> {
    try {
      console.log(`Starting matchup data pipeline for week ${week}`);
      
      // Step 1: Get all matchups for the week
      const matchups = await this.getMatchupsFromDatabase(week);
      console.log(`Found ${matchups.length} matchups for week ${week}`);
      
      // Step 2: Process each matchup
      const processedMatchups: ProcessedMatchup[] = [];
      
      for (const matchup of matchups) {
        try {
          const processedMatchup = await this.processMatchup(matchup, week);
          processedMatchups.push(processedMatchup);
        } catch (error) {
          console.error(`Error processing matchup ${matchup.id}:`, error);
          // Continue with other matchups even if one fails
        }
      }
      
      console.log(`Successfully processed ${processedMatchups.length} matchups`);
      return processedMatchups;
      
    } catch (error) {
      console.error('Error in matchup data pipeline:', error);
      throw error;
    }
  }

  /**
   * Get matchup records from database
   */
  private async getMatchupsFromDatabase(week: number) {
    const response = await window.ezsite.apis.tablePage('13329', {
      PageNo: 1,
      PageSize: 100,
      OrderByField: 'id',
      IsAsc: true,
      Filters: [
        {
          name: 'week',
          op: 'Equal',
          value: week
        }
      ]
    });

    if (response.error) {
      throw new Error(`Failed to fetch matchups: ${response.error}`);
    }

    return response.data?.List || [];
  }

  /**
   * Process individual matchup
   */
  private async processMatchup(matchupRecord: any, week: number): Promise<ProcessedMatchup> {
    console.log(`Processing matchup ${matchupRecord.id}: Team ${matchupRecord.team_1_id} vs Team ${matchupRecord.team_2_id}`);
    
    // Get team information for both teams
    const team1Info = await this.getTeamInfo(matchupRecord.team_1_id, matchupRecord.conference_id);
    const team2Info = await this.getTeamInfo(matchupRecord.team_2_id, matchupRecord.conference_id);
    
    // Get Sleeper matchup data
    const sleeperMatchups = await this.getSleeperMatchupData(team1Info.leagueId, week);
    
    // Map Sleeper data to teams
    const team1SleeperData = this.findSleeperDataForTeam(sleeperMatchups, team1Info);
    const team2SleeperData = this.findSleeperDataForTeam(sleeperMatchups, team2Info);
    
    if (!team1SleeperData || !team2SleeperData) {
      throw new Error(`Could not find Sleeper data for matchup ${matchupRecord.id}`);
    }
    
    // Process team data
    const team1Processed = await this.processTeamMatchupData(team1Info, team1SleeperData);
    const team2Processed = await this.processTeamMatchupData(team2Info, team2SleeperData);
    
    // Determine winner
    let winner: ProcessedTeamMatchupData | undefined;
    if (team1Processed.totalPoints > team2Processed.totalPoints) {
      winner = team1Processed;
    } else if (team2Processed.totalPoints > team1Processed.totalPoints) {
      winner = team2Processed;
    }
    
    return {
      matchupId: matchupRecord.id,
      week,
      team1: team1Processed,
      team2: team2Processed,
      isPlayoff: matchupRecord.is_playoff || false,
      status: matchupRecord.status || 'pending',
      winner
    };
  }

  /**
   * Get comprehensive team information from multiple tables
   */
  private async getTeamInfo(teamId: number, conferenceId: number): Promise<TeamInfo> {
    const cacheKey = `${teamId}-${conferenceId}`;
    
    if (this.teamInfoCache.has(cacheKey)) {
      return this.teamInfoCache.get(cacheKey)!;
    }

    console.log(`Fetching team info for team ${teamId} in conference ${conferenceId}`);
    
    // Get team data
    const teamResponse = await window.ezsite.apis.tablePage('12852', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: teamId }]
    });
    
    if (teamResponse.error || !teamResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch team ${teamId}: ${teamResponse.error}`);
    }
    
    const team = teamResponse.data.List[0];
    
    // Get conference data
    const conferenceResponse = await window.ezsite.apis.tablePage('12820', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: conferenceId }]
    });
    
    if (conferenceResponse.error || !conferenceResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch conference ${conferenceId}: ${conferenceResponse.error}`);
    }
    
    const conference = conferenceResponse.data.List[0];
    
    // Get season data
    const seasonResponse = await window.ezsite.apis.tablePage('12818', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'id', op: 'Equal', value: conference.season_id }]
    });
    
    if (seasonResponse.error || !seasonResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch season ${conference.season_id}: ${seasonResponse.error}`);
    }
    
    const season = seasonResponse.data.List[0];
    
    // Get roster ID from junction table
    const junctionResponse = await window.ezsite.apis.tablePage('12853', {
      PageNo: 1,
      PageSize: 1,
      Filters: [
        { name: 'team_id', op: 'Equal', value: teamId },
        { name: 'conference_id', op: 'Equal', value: conferenceId },
        { name: 'is_active', op: 'Equal', value: true }
      ]
    });
    
    if (junctionResponse.error || !junctionResponse.data?.List?.[0]) {
      throw new Error(`Failed to fetch roster ID for team ${teamId} in conference ${conferenceId}: ${junctionResponse.error}`);
    }
    
    const junction = junctionResponse.data.List[0];
    
    const teamInfo: TeamInfo = {
      teamId: team.id,
      teamName: team.team_name,
      ownerName: team.owner_name,
      ownerId: team.owner_id,
      conferenceId: conference.id,
      conferenceName: conference.conference_name,
      leagueId: conference.league_id,
      rosterId: junction.roster_id,
      seasonId: season.id,
      seasonYear: season.season_year
    };
    
    this.teamInfoCache.set(cacheKey, teamInfo);
    console.log(`Team info cached for ${teamInfo.teamName} (${teamInfo.rosterId})`);
    
    return teamInfo;
  }

  /**
   * Get matchup data from Sleeper API
   */
  private async getSleeperMatchupData(leagueId: string, week: number): Promise<SleeperMatchupData[]> {
    try {
      console.log(`Fetching Sleeper matchup data for league ${leagueId}, week ${week}`);
      
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
      
      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Retrieved ${data.length} roster entries from Sleeper for league ${leagueId}, week ${week}`);
      
      return data;
    } catch (error) {
      console.error(`Error fetching Sleeper data for league ${leagueId}, week ${week}:`, error);
      throw error;
    }
  }

  /**
   * Find Sleeper data for specific team using roster ID verification
   */
  private findSleeperDataForTeam(sleeperMatchups: SleeperMatchupData[], teamInfo: TeamInfo): SleeperMatchupData | null {
    const rosterId = parseInt(teamInfo.rosterId);
    
    console.log(`Looking for roster_id ${rosterId} for team ${teamInfo.teamName} in league ${teamInfo.leagueId}`);
    
    const matchingData = sleeperMatchups.find(data => data.roster_id === rosterId);
    
    if (matchingData) {
      console.log(`Found Sleeper data for ${teamInfo.teamName}: ${matchingData.points} points`);
    } else {
      console.error(`No Sleeper data found for ${teamInfo.teamName} with roster_id ${rosterId}`);
      console.log('Available roster_ids:', sleeperMatchups.map(d => d.roster_id));
    }
    
    return matchingData || null;
  }

  /**
   * Process team matchup data including player names and points
   */
  private async processTeamMatchupData(teamInfo: TeamInfo, sleeperData: SleeperMatchupData): Promise<ProcessedTeamMatchupData> {
    console.log(`Processing team data for ${teamInfo.teamName}`);
    
    // Process starters
    const starters = await Promise.all(
      sleeperData.starters.map(async (playerId, index) => {
        const playerName = await this.getPlayerName(playerId);
        const points = sleeperData.starters_points?.[index.toString()] || 0;
        return { playerId, playerName, points };
      })
    );
    
    // Process bench (players not in starters)
    const benchPlayerIds = sleeperData.players.filter(playerId => !sleeperData.starters.includes(playerId));
    const bench = await Promise.all(
      benchPlayerIds.map(async (playerId) => {
        const playerName = await this.getPlayerName(playerId);
        const points = sleeperData.players_points?.[playerId] || 0;
        return { playerId, playerName, points };
      })
    );
    
    return {
      teamInfo,
      sleeperData,
      starters,
      bench,
      totalPoints: sleeperData.custom_points || sleeperData.points
    };
  }

  /**
   * Get player name from database or Sleeper API
   */
  private async getPlayerName(sleeperId: string): Promise<string> {
    if (this.playerCache.has(sleeperId)) {
      return this.playerCache.get(sleeperId)!;
    }

    try {
      // First try to get from database
      const response = await window.ezsite.apis.tablePage('12870', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'sleeper_player_id', op: 'Equal', value: sleeperId }]
      });

      if (!response.error && response.data?.List?.[0]) {
        const playerName = response.data.List[0].player_name;
        this.playerCache.set(sleeperId, playerName);
        return playerName;
      }

      // If not in database, try Sleeper API
      const sleeperResponse = await fetch(`https://api.sleeper.app/v1/players/nfl`);
      if (sleeperResponse.ok) {
        const players = await sleeperResponse.json();
        if (players[sleeperId]) {
          const fullName = players[sleeperId].full_name || `${players[sleeperId].first_name} ${players[sleeperId].last_name}`;
          this.playerCache.set(sleeperId, fullName);
          return fullName;
        }
      }

      // Fallback to player ID if name not found
      const fallbackName = `Player ${sleeperId}`;
      this.playerCache.set(sleeperId, fallbackName);
      return fallbackName;

    } catch (error) {
      console.error(`Error getting player name for ${sleeperId}:`, error);
      const fallbackName = `Player ${sleeperId}`;
      this.playerCache.set(sleeperId, fallbackName);
      return fallbackName;
    }
  }

  /**
   * Clear caches (useful for testing or data refresh)
   */
  public clearCaches(): void {
    this.playerCache.clear();
    this.teamInfoCache.clear();
    console.log('Matchup data pipeline caches cleared');
  }
}

export const matchupDataPipeline = MatchupDataPipeline.getInstance();