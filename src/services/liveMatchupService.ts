/**
 * LiveMatchupService - Orchestrates data mapping between database matchups and Sleeper API
 * Handles the intelligent mapping of scoring data regardless of Sleeper's matchup structure
 */

import MatchupDataService, { DatabaseMatchup, MatchupTeam } from './matchupDataService';
import SleeperApiService, { LiveScoringData, SleeperPlayer } from './sleeperApi';

export interface LiveMatchupData {
  matchup: DatabaseMatchup;
  team_1_scoring: LiveScoringData | null;
  team_2_scoring: LiveScoringData | null;
  is_live: boolean;
  last_updated: Date;
  error?: string;
}

export interface MatchupSummary {
  total_matchups: number;
  live_matchups: number;
  completed_matchups: number;
  failed_matchups: number;
  last_refresh: Date;
}

class LiveMatchupService {
  private static instance: LiveMatchupService;
  private matchupDataService: MatchupDataService;
  private allPlayers: Record<string, SleeperPlayer> | null = null;
  private playersLastFetched: Date | null = null;
  private readonly PLAYERS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.matchupDataService = MatchupDataService.getInstance();
  }

  public static getInstance(): LiveMatchupService {
    if (!LiveMatchupService.instance) {
      LiveMatchupService.instance = new LiveMatchupService();
    }
    return LiveMatchupService.instance;
  }

  /**
   * Get live matchup data for a specific week
   */
  async getLiveMatchupsForWeek(week: number): Promise<LiveMatchupData[]> {
    try {
      console.log(`🎯 Getting live matchups for week ${week}`);
      
      // Get database matchups
      const dbMatchups = await this.matchupDataService.getMatchupsForWeek(week);
      console.log(`📊 Found ${dbMatchups.length} database matchups`);

      // Ensure we have fresh player data
      await this.ensureFreshPlayerData();

      // Process each matchup
      const liveMatchups: LiveMatchupData[] = [];
      
      for (const matchup of dbMatchups) {
        try {
          const liveMatchupData = await this.processMatchup(matchup, week);
          liveMatchups.push(liveMatchupData);
        } catch (error) {
          console.error(`❌ Error processing matchup ${matchup.id}:`, error);
          liveMatchups.push({
            matchup,
            team_1_scoring: null,
            team_2_scoring: null,
            is_live: false,
            last_updated: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`✅ Processed ${liveMatchups.length} live matchups`);
      return liveMatchups;
    } catch (error) {
      console.error('❌ Error getting live matchups:', error);
      throw error;
    }
  }

  /**
   * Process a single matchup with live scoring data
   */
  private async processMatchup(matchup: DatabaseMatchup, week: number): Promise<LiveMatchupData> {
    try {
      console.log(`🔄 Processing matchup: ${matchup.team_1.team_name} vs ${matchup.team_2.team_name}`);
      
      // Get live scoring data for both teams
      const [team1Scoring, team2Scoring] = await Promise.all([
        this.getTeamLiveScoring(matchup.league_id, week, matchup.team_1),
        this.getTeamLiveScoring(matchup.league_id, week, matchup.team_2)
      ]);

      const isLive = team1Scoring !== null || team2Scoring !== null;
      
      console.log(`📈 Matchup scoring - Team 1: ${team1Scoring?.team_points || 0}, Team 2: ${team2Scoring?.team_points || 0}`);
      
      return {
        matchup,
        team_1_scoring: team1Scoring,
        team_2_scoring: team2Scoring,
        is_live: isLive,
        last_updated: new Date()
      };
    } catch (error) {
      console.error(`❌ Error processing individual matchup:`, error);
      throw error;
    }
  }

  /**
   * Get live scoring data for a specific team using roster_id mapping
   */
  private async getTeamLiveScoring(
    leagueId: string, 
    week: number, 
    team: MatchupTeam
  ): Promise<LiveScoringData | null> {
    try {
      if (!team.roster_id) {
        console.warn(`⚠️ No roster_id found for team ${team.team_name}`);
        return null;
      }

      console.log(`🎯 Getting live scoring for team ${team.team_name} (roster_id: ${team.roster_id})`);
      
      // Get roster-specific live scoring data
      const liveScoringData = await SleeperApiService.getRosterLiveScoring(
        leagueId, 
        week, 
        parseInt(team.roster_id)
      );

      if (!liveScoringData) {
        console.warn(`⚠️ No live scoring data found for roster ${team.roster_id}`);
        return null;
      }

      console.log(`✅ Got live scoring for ${team.team_name}: ${liveScoringData.team_points} points`);
      return liveScoringData;
    } catch (error) {
      console.error(`❌ Error getting team live scoring for ${team.team_name}:`, error);
      return null;
    }
  }

  /**
   * Ensure we have fresh player data (cached for 24 hours)
   */
  private async ensureFreshPlayerData(): Promise<void> {
    try {
      const now = new Date();
      const needsFresh = !this.allPlayers || 
                        !this.playersLastFetched || 
                        (now.getTime() - this.playersLastFetched.getTime()) > this.PLAYERS_CACHE_DURATION;
      
      if (needsFresh) {
        console.log('🔄 Fetching fresh player data...');
        this.allPlayers = await SleeperApiService.fetchAllPlayers();
        this.playersLastFetched = now;
        console.log(`✅ Player data refreshed: ${Object.keys(this.allPlayers).length} players`);
      } else {
        console.log('📦 Using cached player data');
      }
    } catch (error) {
      console.error('❌ Error ensuring fresh player data:', error);
      // Don't throw here - we can still function without detailed player data
    }
  }

  /**
   * Get matchup summary statistics
   */
  async getMatchupSummary(week: number): Promise<MatchupSummary> {
    try {
      const liveMatchups = await this.getLiveMatchupsForWeek(week);
      
      const summary: MatchupSummary = {
        total_matchups: liveMatchups.length,
        live_matchups: liveMatchups.filter(m => m.is_live && !m.error).length,
        completed_matchups: liveMatchups.filter(m => m.is_live && m.team_1_scoring && m.team_2_scoring).length,
        failed_matchups: liveMatchups.filter(m => m.error).length,
        last_refresh: new Date()
      };
      
      return summary;
    } catch (error) {
      console.error('❌ Error getting matchup summary:', error);
      throw error;
    }
  }

  /**
   * Force refresh all cached data
   */
  async forceRefresh(): Promise<void> {
    try {
      console.log('🔄 Force refreshing all cached data...');
      
      // Clear Sleeper API cache
      SleeperApiService.clearMatchupCache();
      
      // Clear our player cache
      this.allPlayers = null;
      this.playersLastFetched = null;
      
      console.log('✅ All caches cleared');
    } catch (error) {
      console.error('❌ Error force refreshing:', error);
      throw error;
    }
  }

  /**
   * Get detailed matchup by ID
   */
  async getMatchupById(matchupId: number, week: number): Promise<LiveMatchupData | null> {
    try {
      const liveMatchups = await this.getLiveMatchupsForWeek(week);
      return liveMatchups.find(m => m.matchup.id === matchupId) || null;
    } catch (error) {
      console.error('❌ Error getting matchup by ID:', error);
      return null;
    }
  }

  /**
   * Get player name from cached data
   */
  getPlayerName(playerId: string): string {
    if (!this.allPlayers || !this.allPlayers[playerId]) {
      return 'Unknown Player';
    }
    return SleeperApiService.getPlayerName(this.allPlayers[playerId]);
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): Record<string, any> {
    return {
      players_cached: !!this.allPlayers,
      players_count: this.allPlayers ? Object.keys(this.allPlayers).length : 0,
      players_last_fetched: this.playersLastFetched,
      sleeper_cache: SleeperApiService.getCacheStatus()
    };
  }
}

export default LiveMatchupService;