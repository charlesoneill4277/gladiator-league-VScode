import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from './sleeperApi';
import { EnhancedMatchupData } from './databaseMatchupService';

export interface CrossConferenceSleeperData {
  matchupId: string;
  team1SleeperData: {
    matchup?: SleeperMatchup;
    roster?: SleeperRoster;
    user?: SleeperUser;
    leagueId: string;
  };
  team2SleeperData: {
    matchup?: SleeperMatchup;
    roster?: SleeperRoster;
    user?: SleeperUser;
    leagueId: string;
  };
  isInterConference: boolean;
  dataQuality: {
    team1DataComplete: boolean;
    team2DataComplete: boolean;
    bothTeamsHaveData: boolean;
    scoringDataAvailable: boolean;
    starterDataAvailable: boolean;
  };
  warnings: string[];
}

/**
 * Service for handling Sleeper API data across different conferences
 * Supports both intra-conference and inter-conference matchups
 */
class CrossConferenceSleeperService {
  private leagueDataCache = new Map<string, {
    matchups: SleeperMatchup[];
    rosters: SleeperRoster[];
    users: SleeperUser[];
    timestamp: number;
  }>();

  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch Sleeper data for enhanced matchups with cross-conference support
   */
  async fetchSleeperDataForMatchups(
    enhancedMatchups: EnhancedMatchupData[],
    week: number,
    allPlayers: Record<string, SleeperPlayer>
  ): Promise<CrossConferenceSleeperData[]> {
    console.log(`🎯 Fetching Sleeper data for ${enhancedMatchups.length} enhanced matchups (week ${week})...`);

    const results: CrossConferenceSleeperData[] = [];

    // Group matchups by conferences involved
    const leagueGroups = this.groupMatchupsByLeagues(enhancedMatchups);
    console.log(`📊 League groups: ${Object.keys(leagueGroups).length} unique leagues involved`);

    // Pre-load data for all leagues involved
    await this.preloadLeagueData(Object.keys(leagueGroups), week);

    // Process each matchup
    for (const enhancedMatchup of enhancedMatchups) {
      try {
        const sleeperData = await this.processMatchupSleeperData(enhancedMatchup, week, allPlayers);
        results.push(sleeperData);
      } catch (error) {
        console.error(`❌ Error processing Sleeper data for matchup ${enhancedMatchup.databaseMatchup.id}:`, error);
        
        // Create placeholder data for failed matchups
        const placeholderData = this.createPlaceholderSleeperData(enhancedMatchup);
        results.push(placeholderData);
      }
    }

    console.log(`✅ Successfully processed Sleeper data for ${results.length} matchups`);
    this.logDataQualityReport(results);

    return results;
  }

  /**
   * Process Sleeper data for a single enhanced matchup
   */
  private async processMatchupSleeperData(
    enhancedMatchup: EnhancedMatchupData,
    week: number,
    allPlayers: Record<string, SleeperPlayer>
  ): Promise<CrossConferenceSleeperData> {
    const { databaseMatchup, team1, team2, team1Conference, team2Conference, 
            team1RosterId, team2RosterId, isInterConference } = enhancedMatchup;

    console.log(`🔄 Processing Sleeper data for matchup ${databaseMatchup.id}...`);
    console.log(`  Team 1: ${team1.team_name} (Roster: ${team1RosterId}, League: ${team1Conference.league_id})`);
    console.log(`  Team 2: ${team2.team_name} (Roster: ${team2RosterId}, League: ${team2Conference.league_id})`);

    const warnings: string[] = [];

    // Get Sleeper data for team 1
    const team1SleeperData = await this.getTeamSleeperData(
      team1Conference.league_id,
      team1RosterId,
      week,
      `${team1.team_name} (${team1Conference.conference_name})`
    );

    // Get Sleeper data for team 2 (may be from different league)
    const team2SleeperData = await this.getTeamSleeperData(
      team2Conference.league_id,
      team2RosterId,
      week,
      `${team2.team_name} (${team2Conference.conference_name})`
    );

    // Validate data quality
    const dataQuality = this.assessDataQuality(team1SleeperData, team2SleeperData, isInterConference);

    // Add warnings for inter-conference matchups
    if (isInterConference) {
      warnings.push(`Inter-conference matchup: ${team1Conference.conference_name} vs ${team2Conference.conference_name}`);
      
      if (team1Conference.league_id === team2Conference.league_id) {
        warnings.push('Teams marked as inter-conference but in same Sleeper league');
      }
    }

    // Add data quality warnings
    if (!dataQuality.bothTeamsHaveData) {
      warnings.push('Incomplete data for one or both teams');
    }

    if (!dataQuality.scoringDataAvailable) {
      warnings.push('Scoring data not available for this matchup');
    }

    if (!dataQuality.starterDataAvailable) {
      warnings.push('Starter lineup data not available');
    }

    const result: CrossConferenceSleeperData = {
      matchupId: databaseMatchup.id.toString(),
      team1SleeperData,
      team2SleeperData,
      isInterConference,
      dataQuality,
      warnings
    };

    console.log(`✅ Processed Sleeper data for matchup ${databaseMatchup.id}`);
    console.log(`  Data quality: Team1=${dataQuality.team1DataComplete}, Team2=${dataQuality.team2DataComplete}`);
    console.log(`  Warnings: ${warnings.length}`);

    return result;
  }

  /**
   * Get Sleeper data for a specific team
   */
  private async getTeamSleeperData(
    leagueId: string,
    rosterId: string,
    week: number,
    teamDescription: string
  ): Promise<CrossConferenceSleeperData['team1SleeperData']> {
    console.log(`🎯 Getting Sleeper data for ${teamDescription} (League: ${leagueId}, Roster: ${rosterId})`);

    try {
      // Get cached league data
      const leagueData = await this.getCachedLeagueData(leagueId, week);

      if (!leagueData) {
        console.warn(`⚠️ No league data available for ${leagueId}`);
        return { leagueId };
      }

      // Find specific roster and matchup data
      const roster = leagueData.rosters.find(r => r.roster_id.toString() === rosterId);
      const matchup = leagueData.matchups.find(m => m.roster_id.toString() === rosterId);
      const user = leagueData.users.find(u => u.user_id === roster?.owner_id);

      console.log(`  Found data: Roster=${!!roster}, Matchup=${!!matchup}, User=${!!user}`);

      return {
        matchup,
        roster,
        user,
        leagueId
      };

    } catch (error) {
      console.error(`❌ Error getting Sleeper data for ${teamDescription}:`, error);
      return { leagueId };
    }
  }

  /**
   * Group matchups by the leagues they involve
   */
  private groupMatchupsByLeagues(enhancedMatchups: EnhancedMatchupData[]): Record<string, number> {
    const leagueGroups: Record<string, number> = {};

    enhancedMatchups.forEach(matchup => {
      const team1League = matchup.team1Conference.league_id;
      const team2League = matchup.team2Conference.league_id;

      leagueGroups[team1League] = (leagueGroups[team1League] || 0) + 1;
      
      // Only count team2 league if different from team1
      if (team1League !== team2League) {
        leagueGroups[team2League] = (leagueGroups[team2League] || 0) + 1;
      }
    });

    return leagueGroups;
  }

  /**
   * Pre-load data for multiple leagues to optimize API calls
   */
  private async preloadLeagueData(leagueIds: string[], week: number): Promise<void> {
    console.log(`📥 Pre-loading data for ${leagueIds.length} leagues...`);

    const loadPromises = leagueIds.map(async (leagueId) => {
      try {
        await this.getCachedLeagueData(leagueId, week);
        console.log(`✅ Pre-loaded data for league ${leagueId}`);
      } catch (error) {
        console.error(`❌ Failed to pre-load data for league ${leagueId}:`, error);
      }
    });

    await Promise.all(loadPromises);
    console.log(`🎯 Pre-loading completed for ${leagueIds.length} leagues`);
  }

  /**
   * Get cached league data or fetch fresh if needed
   */
  private async getCachedLeagueData(leagueId: string, week: number): Promise<{
    matchups: SleeperMatchup[];
    rosters: SleeperRoster[];
    users: SleeperUser[];
  } | null> {
    const cacheKey = `${leagueId}_${week}`;
    const cached = this.leagueDataCache.get(cacheKey);

    // Return cached data if still valid
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiryMs) {
      console.log(`💾 Using cached data for league ${leagueId}`);
      return {
        matchups: cached.matchups,
        rosters: cached.rosters,
        users: cached.users
      };
    }

    // Fetch fresh data
    try {
      console.log(`🌐 Fetching fresh data for league ${leagueId}, week ${week}...`);

      const [matchups, rosters, users] = await Promise.all([
        SleeperApiService.fetchMatchups(leagueId, week),
        SleeperApiService.fetchLeagueRosters(leagueId),
        SleeperApiService.fetchLeagueUsers(leagueId)
      ]);

      // Cache the data
      this.leagueDataCache.set(cacheKey, {
        matchups,
        rosters,
        users,
        timestamp: Date.now()
      });

      console.log(`✅ Cached fresh data for league ${leagueId}: ${matchups.length} matchups, ${rosters.length} rosters, ${users.length} users`);

      return { matchups, rosters, users };

    } catch (error) {
      console.error(`❌ Failed to fetch data for league ${leagueId}:`, error);
      return null;
    }
  }

  /**
   * Assess data quality for a matchup
   */
  private assessDataQuality(
    team1Data: CrossConferenceSleeperData['team1SleeperData'],
    team2Data: CrossConferenceSleeperData['team2SleeperData'],
    isInterConference: boolean
  ): CrossConferenceSleeperData['dataQuality'] {
    const team1DataComplete = !!(team1Data.matchup && team1Data.roster && team1Data.user);
    const team2DataComplete = !!(team2Data.matchup && team2Data.roster && team2Data.user);
    const bothTeamsHaveData = team1DataComplete && team2DataComplete;

    const scoringDataAvailable = !!(
      team1Data.matchup?.points !== undefined && 
      team2Data.matchup?.points !== undefined
    );

    const starterDataAvailable = !!(
      team1Data.matchup?.starters?.length && 
      team2Data.matchup?.starters?.length
    );

    return {
      team1DataComplete,
      team2DataComplete,
      bothTeamsHaveData,
      scoringDataAvailable,
      starterDataAvailable
    };
  }

  /**
   * Create placeholder data for failed matchups
   */
  private createPlaceholderSleeperData(enhancedMatchup: EnhancedMatchupData): CrossConferenceSleeperData {
    const { databaseMatchup, team1Conference, team2Conference, isInterConference } = enhancedMatchup;

    return {
      matchupId: databaseMatchup.id.toString(),
      team1SleeperData: { leagueId: team1Conference.league_id },
      team2SleeperData: { leagueId: team2Conference.league_id },
      isInterConference,
      dataQuality: {
        team1DataComplete: false,
        team2DataComplete: false,
        bothTeamsHaveData: false,
        scoringDataAvailable: false,
        starterDataAvailable: false
      },
      warnings: ['Failed to fetch Sleeper data for this matchup']
    };
  }

  /**
   * Log comprehensive data quality report
   */
  private logDataQualityReport(results: CrossConferenceSleeperData[]): void {
    const stats = {
      total: results.length,
      interConference: results.filter(r => r.isInterConference).length,
      bothTeamsComplete: results.filter(r => r.dataQuality.bothTeamsHaveData).length,
      scoringDataAvailable: results.filter(r => r.dataQuality.scoringDataAvailable).length,
      starterDataAvailable: results.filter(r => r.dataQuality.starterDataAvailable).length,
      withWarnings: results.filter(r => r.warnings.length > 0).length
    };

    console.log('📊 Cross-Conference Sleeper Data Quality Report:');
    console.log(`  📈 Total matchups: ${stats.total}`);
    console.log(`  🌐 Inter-conference: ${stats.interConference} (${(stats.interConference/stats.total*100).toFixed(1)}%)`);
    console.log(`  ✅ Both teams complete: ${stats.bothTeamsComplete} (${(stats.bothTeamsComplete/stats.total*100).toFixed(1)}%)`);
    console.log(`  🎯 Scoring data: ${stats.scoringDataAvailable} (${(stats.scoringDataAvailable/stats.total*100).toFixed(1)}%)`);
    console.log(`  👥 Starter data: ${stats.starterDataAvailable} (${(stats.starterDataAvailable/stats.total*100).toFixed(1)}%)`);
    console.log(`  ⚠️ With warnings: ${stats.withWarnings} (${(stats.withWarnings/stats.total*100).toFixed(1)}%)`);
  }

  /**
   * Get enhanced starting lineup data with position validation
   */
  getEnhancedStartingLineupData(
    sleeperData: CrossConferenceSleeperData['team1SleeperData'] | CrossConferenceSleeperData['team2SleeperData'],
    allPlayers: Record<string, SleeperPlayer>
  ): {
    starters: string[];
    starterPoints: number[];
    playerPoints: Record<string, number>;
    positionValidation: {
      isValid: boolean;
      violations: string[];
      expectedPositions: string[];
    };
  } {
    const starters = sleeperData.matchup?.starters || sleeperData.roster?.starters || [];
    const starterPoints = sleeperData.matchup?.starters_points || [];
    const playerPoints = sleeperData.matchup?.players_points || {};

    // Expected positions for The Gladiator League
    const expectedPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'WRT', 'WRTQ'];
    const violations: string[] = [];

    // Validate lineup positions
    starters.forEach((playerId, index) => {
      if (!playerId || !allPlayers[playerId]) {
        violations.push(`Position ${index + 1}: Player not found (${playerId})`);
        return;
      }

      const player = allPlayers[playerId];
      const expectedPos = expectedPositions[index];
      
      // Position validation logic
      if (expectedPos === 'WRT' && !['RB', 'WR', 'TE'].includes(player.position)) {
        violations.push(`Position ${index + 1} (Flex): ${player.position} not eligible for WRT`);
      } else if (expectedPos === 'WRTQ' && !['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
        violations.push(`Position ${index + 1} (SuperFlex): ${player.position} not eligible for WRTQ`);
      } else if (expectedPos !== 'WRT' && expectedPos !== 'WRTQ' && player.position !== expectedPos) {
        violations.push(`Position ${index + 1}: Expected ${expectedPos}, got ${player.position}`);
      }
    });

    return {
      starters,
      starterPoints,
      playerPoints,
      positionValidation: {
        isValid: violations.length === 0,
        violations,
        expectedPositions
      }
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.leagueDataCache.clear();
    console.log('🧹 Cross-conference Sleeper service caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    cachedLeagues: number;
    cacheHitRate: number;
    oldestCacheEntry: number;
  } {
    const now = Date.now();
    const cacheEntries = Array.from(this.leagueDataCache.values());
    
    let oldestCacheEntry = 0;
    if (cacheEntries.length > 0) {
      oldestCacheEntry = Math.min(...cacheEntries.map(entry => now - entry.timestamp));
    }

    return {
      cachedLeagues: this.leagueDataCache.size,
      cacheHitRate: 0, // Would need to track hits/misses to calculate
      oldestCacheEntry
    };
  }
}

export default new CrossConferenceSleeperService();