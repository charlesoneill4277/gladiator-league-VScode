/**
 * Hybrid Data Service - Updated to work with new matchup data pipeline
 * Manages data flow between database and Sleeper API
 */

import { matchupDataPipeline, ProcessedMatchup } from './matchupDataPipeline';

export interface HybridTeamData {
  id: number;
  name: string;
  owner: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  conference: string;
  // Sleeper specific data
  rosterId?: number;
  leagueId?: string;
}

export interface HybridMatchupData {
  week: number;
  team1: HybridTeamData;
  team2: HybridTeamData;
  team1Score: number;
  team2Score: number;
  winner?: HybridTeamData;
  isComplete: boolean;
}

class HybridDataService {
  private static instance: HybridDataService;
  private dataCache: Map<string, any> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): HybridDataService {
    if (!HybridDataService.instance) {
      HybridDataService.instance = new HybridDataService();
    }
    return HybridDataService.instance;
  }

  /**
   * Get teams data combining database and Sleeper information
   */
  async getTeamsData(): Promise<HybridTeamData[]> {
    const cacheKey = 'teams_data';
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      console.log('Returning cached teams data');
      return cached;
    }

    try {
      console.log('Fetching fresh teams data');
      
      // Get teams from database
      const teamsResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true
      });

      if (teamsResponse.error) {
        throw new Error(`Failed to fetch teams: ${teamsResponse.error}`);
      }

      const teams = teamsResponse.data?.List || [];
      
      // Get team records
      const recordsResponse = await window.ezsite.apis.tablePage('13768', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_id',
        IsAsc: true
      });

      const records = recordsResponse.data?.List || [];
      
      // Get conferences for team mapping
      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true
      });

      const conferences = conferencesResponse.data?.List || [];
      
      // Combine the data
      const hybridTeams: HybridTeamData[] = teams.map(team => {
        const teamRecord = records.find(r => r.team_id === team.id);
        const conference = conferences.find(c => c.id === teamRecord?.conference_id);
        
        return {
          id: team.id,
          name: team.team_name || 'Unknown Team',
          owner: team.owner_name || 'Unknown Owner',
          wins: teamRecord?.wins || 0,
          losses: teamRecord?.losses || 0,
          pointsFor: teamRecord?.points_for || 0,
          pointsAgainst: teamRecord?.points_against || 0,
          conference: conference?.conference_name || 'Unknown Conference'
        };
      });

      this.setCachedData(cacheKey, hybridTeams);
      console.log(`Processed ${hybridTeams.length} teams`);
      
      return hybridTeams;
      
    } catch (error) {
      console.error('Error in hybrid teams data service:', error);
      throw error;
    }
  }

  /**
   * Get matchups data for a specific week using new data pipeline
   */
  async getMatchupsData(week: number): Promise<ProcessedMatchup[]> {
    const cacheKey = `processed_matchups_week_${week}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      console.log(`Returning cached processed matchups data for week ${week}`);
      return cached;
    }

    try {
      console.log(`Fetching processed matchups data for week ${week} using new pipeline`);
      
      // Use the new matchup data pipeline
      const processedMatchups = await matchupDataPipeline.getMatchupsForWeek(week);
      
      this.setCachedData(cacheKey, processedMatchups);
      console.log(`Processed ${processedMatchups.length} matchups for week ${week} via new pipeline`);
      
      return processedMatchups;
      
    } catch (error) {
      console.error(`Error in hybrid matchups data service for week ${week}:`, error);
      throw error;
    }
  }

  /**
   * Legacy method - converts ProcessedMatchup to HybridMatchupData for backward compatibility
   */
  async getLegacyMatchupsData(week: number): Promise<HybridMatchupData[]> {
    try {
      const processedMatchups = await this.getMatchupsData(week);
      
      return processedMatchups.map(matchup => ({
        week: matchup.week,
        team1: {
          id: matchup.team1.teamInfo.teamId,
          name: matchup.team1.teamInfo.teamName,
          owner: matchup.team1.teamInfo.ownerName,
          wins: 0, // Would need to be fetched separately
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          conference: matchup.team1.teamInfo.conferenceName,
          rosterId: parseInt(matchup.team1.teamInfo.rosterId),
          leagueId: matchup.team1.teamInfo.leagueId
        },
        team2: {
          id: matchup.team2.teamInfo.teamId,
          name: matchup.team2.teamInfo.teamName,
          owner: matchup.team2.teamInfo.ownerName,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          conference: matchup.team2.teamInfo.conferenceName,
          rosterId: parseInt(matchup.team2.teamInfo.rosterId),
          leagueId: matchup.team2.teamInfo.leagueId
        },
        team1Score: matchup.team1.totalPoints,
        team2Score: matchup.team2.totalPoints,
        winner: matchup.winner ? {
          id: matchup.winner.teamInfo.teamId,
          name: matchup.winner.teamInfo.teamName,
          owner: matchup.winner.teamInfo.ownerName,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          conference: matchup.winner.teamInfo.conferenceName
        } : undefined,
        isComplete: matchup.status === 'complete'
      }));
      
    } catch (error) {
      console.error('Error converting to legacy matchup format:', error);
      return [];
    }
  }

  /**
   * Clear specific cache entry
   */
  clearCache(key?: string): void {
    if (key) {
      this.dataCache.delete(key);
      console.log(`Cache cleared for key: ${key}`);
    } else {
      this.dataCache.clear();
      matchupDataPipeline.clearCaches(); // Also clear pipeline caches
      console.log('All cache cleared');
    }
  }

  private getCachedData(key: string): any {
    const cached = this.dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

export const hybridDataService = HybridDataService.getInstance();