import databaseMatchupService, { EnhancedMatchupData, DatabaseMatchup, Team } from './databaseMatchupService';
import crossConferenceSleeperService, { CrossConferenceSleeperData } from './crossConferenceSleeperService';
import SleeperApiService, { SleeperPlayer } from './sleeperApi';

export interface EnhancedMatchupResult {
  matchupId: string;
  week: number;
  status: 'upcoming' | 'live' | 'completed';
  isInterConference: boolean;
  isManualOverride: boolean;
  
  // Team 1 data
  team1: {
    teamInfo: {
      teamId: number;
      teamName: string;
      ownerName: string;
      ownerId: string;
      conferenceId: number;
      conferenceName: string;
      teamLogoUrl: string;
      primaryColor: string;
      secondaryColor: string;
    };
    roster: {
      rosterId: string;
      leagueId: string;
    };
    lineup: {
      starters: Array<{
        position: string;
        playerId: string;
        playerName: string;
        nflTeam: string;
        points: number;
        isValid: boolean;
      }>;
      totalPoints: number;
      projectedPoints?: number;
    };
    sleeperData?: any;
  };
  
  // Team 2 data  
  team2: {
    teamInfo: {
      teamId: number;
      teamName: string;
      ownerName: string;
      ownerId: string;
      conferenceId: number;
      conferenceName: string;
      teamLogoUrl: string;
      primaryColor: string;
      secondaryColor: string;
    };
    roster: {
      rosterId: string;
      leagueId: string;
    };
    lineup: {
      starters: Array<{
        position: string;
        playerId: string;
        playerName: string;
        nflTeam: string;
        points: number;
        isValid: boolean;
      }>;
      totalPoints: number;
      projectedPoints?: number;
    };
    sleeperData?: any;
  };

  // Match result
  winner?: 'team1' | 'team2' | null;
  margin?: number;
  
  // Data quality and validation
  dataQuality: {
    overallScore: number;
    team1DataComplete: boolean;
    team2DataComplete: boolean;
    lineupValidationPassed: boolean;
    scoringDataAvailable: boolean;
    issues: string[];
    warnings: string[];
  };

  // Metadata
  databaseMatchup: DatabaseMatchup;
  lastUpdated: string;
}

/**
 * Enhanced matchup service that combines database team assignments with Sleeper API data
 * Supports both intra-conference and inter-conference matchups
 */
class EnhancedMatchupService {
  private allPlayers: Record<string, SleeperPlayer> = {};
  private playersLastFetched = 0;
  private readonly PLAYERS_CACHE_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Get enhanced matchups for a specific week
   */
  async getEnhancedMatchupsForWeek(
    week: number, 
    conferenceIds?: number[]
  ): Promise<EnhancedMatchupResult[]> {
    console.log(`🚀 Getting enhanced matchups for week ${week}...`);
    console.log(`🎯 Conference filter: ${conferenceIds ? conferenceIds.join(', ') : 'All conferences'}`);

    try {
      // Ensure we have current player data
      await this.ensurePlayersData();

      // Step 1: Fetch database matchups
      console.log('📋 Step 1: Fetching database matchups...');
      const databaseMatchups = await databaseMatchupService.fetchDatabaseMatchups(week, conferenceIds);
      
      if (databaseMatchups.length === 0) {
        console.warn('⚠️ No database matchups found');
        return [];
      }

      // Step 2: Build team-conference mapping
      console.log('🔗 Step 2: Building team-conference mapping...');
      const teamMapping = await databaseMatchupService.buildTeamConferenceMapping();

      // Step 3: Fetch team and conference data
      console.log('👥 Step 3: Fetching teams and conferences...');
      const [teams, allConferenceIds] = await Promise.all([
        databaseMatchupService.fetchTeams(),
        this.extractConferenceIds(databaseMatchups, teamMapping)
      ]);

      const conferences = await databaseMatchupService.fetchConferences(allConferenceIds);

      // Step 4: Process enhanced matchups (database + team/conference data)
      console.log('⚙️ Step 4: Processing enhanced matchups...');
      const enhancedMatchups = await databaseMatchupService.processEnhancedMatchups(
        databaseMatchups, 
        teamMapping, 
        teams
      );

      console.log(`✅ Processed ${enhancedMatchups.length} enhanced matchups`);

      // Step 5: Fetch Sleeper data for all matchups
      console.log('🎯 Step 5: Fetching Sleeper data...');
      const sleeperData = await crossConferenceSleeperService.fetchSleeperDataForMatchups(
        enhancedMatchups,
        week,
        this.allPlayers
      );

      // Step 6: Combine all data into final results
      console.log('🔄 Step 6: Combining data into final results...');
      const results = await this.combineMatchupData(enhancedMatchups, sleeperData);

      // Log summary statistics
      this.logMatchupSummary(results, week);

      return results;

    } catch (error) {
      console.error('❌ Error getting enhanced matchups:', error);
      throw error;
    }
  }

  /**
   * Ensure we have current player data
   */
  private async ensurePlayersData(): Promise<void> {
    const now = Date.now();
    
    if (Object.keys(this.allPlayers).length === 0 || 
        (now - this.playersLastFetched) > this.PLAYERS_CACHE_MS) {
      
      console.log('🏈 Fetching current player data...');
      try {
        this.allPlayers = await SleeperApiService.fetchAllPlayers();
        this.playersLastFetched = now;
        console.log(`✅ Loaded ${Object.keys(this.allPlayers).length} players`);
      } catch (error) {
        console.error('❌ Failed to fetch player data:', error);
        // Continue with existing data if available
      }
    }
  }

  /**
   * Extract all conference IDs involved in matchups
   */
  private async extractConferenceIds(
    databaseMatchups: DatabaseMatchup[],
    teamMapping: Map<string, any>
  ): Promise<number[]> {
    const conferenceIds = new Set<number>();

    // Add conference IDs from database matchups
    databaseMatchups.forEach(matchup => {
      conferenceIds.add(matchup.conference_id);
      
      // Also get conferences for the teams involved (for inter-conference support)
      const team1Mapping = teamMapping.get(`team_${matchup.team_1_id}`);
      const team2Mapping = teamMapping.get(`team_${matchup.team_2_id}`);
      
      if (team1Mapping) conferenceIds.add(team1Mapping.conference_id);
      if (team2Mapping) conferenceIds.add(team2Mapping.conference_id);
    });

    return Array.from(conferenceIds);
  }

  /**
   * Combine enhanced matchup data with Sleeper data
   */
  private async combineMatchupData(
    enhancedMatchups: EnhancedMatchupData[],
    sleeperDataArray: CrossConferenceSleeperData[]
  ): Promise<EnhancedMatchupResult[]> {
    console.log(`🔄 Combining data for ${enhancedMatchups.length} matchups...`);

    const results: EnhancedMatchupResult[] = [];

    for (let i = 0; i < enhancedMatchups.length; i++) {
      const enhanced = enhancedMatchups[i];
      const sleeperData = sleeperDataArray[i];

      try {
        const result = await this.createEnhancedMatchupResult(enhanced, sleeperData);
        results.push(result);
      } catch (error) {
        console.error(`❌ Error combining data for matchup ${enhanced.databaseMatchup.id}:`, error);
        continue;
      }
    }

    console.log(`✅ Successfully combined data for ${results.length} matchups`);
    return results;
  }

  /**
   * Create a single enhanced matchup result
   */
  private async createEnhancedMatchupResult(
    enhanced: EnhancedMatchupData,
    sleeperData: CrossConferenceSleeperData
  ): Promise<EnhancedMatchupResult> {
    const { databaseMatchup } = enhanced;

    // Process team 1 data
    const team1Data = this.processTeamData(
      enhanced.team1,
      enhanced.team1Conference,
      enhanced.team1RosterId,
      sleeperData.team1SleeperData,
      'team1'
    );

    // Process team 2 data
    const team2Data = this.processTeamData(
      enhanced.team2,
      enhanced.team2Conference,
      enhanced.team2RosterId,
      sleeperData.team2SleeperData,
      'team2'
    );

    // Determine match status
    const status = this.determineMatchStatus(databaseMatchup, sleeperData);

    // Determine winner
    const winner = this.determineWinner(team1Data, team2Data, databaseMatchup);
    const margin = winner ? Math.abs(team1Data.lineup.totalPoints - team2Data.lineup.totalPoints) : undefined;

    // Assess overall data quality
    const dataQuality = this.assessOverallDataQuality(enhanced, sleeperData, team1Data, team2Data);

    const result: EnhancedMatchupResult = {
      matchupId: databaseMatchup.id.toString(),
      week: databaseMatchup.week,
      status,
      isInterConference: enhanced.isInterConference,
      isManualOverride: databaseMatchup.is_manual_override,
      team1: team1Data,
      team2: team2Data,
      winner,
      margin,
      dataQuality,
      databaseMatchup,
      lastUpdated: new Date().toISOString()
    };

    console.log(`✅ Created enhanced result for matchup ${databaseMatchup.id}: ${team1Data.teamInfo.teamName} vs ${team2Data.teamInfo.teamName}`);

    return result;
  }

  /**
   * Process data for a single team
   */
  private processTeamData(
    team: Team,
    conference: any,
    rosterId: string,
    sleeperData: CrossConferenceSleeperData['team1SleeperData'],
    teamLabel: string
  ): EnhancedMatchupResult['team1'] {
    console.log(`⚙️ Processing ${teamLabel} data: ${team.team_name}`);

    // Build team info
    const teamInfo = {
      teamId: team.id,
      teamName: team.team_name,
      ownerName: team.owner_name,
      ownerId: team.owner_id,
      conferenceId: conference.id,
      conferenceName: conference.conference_name,
      teamLogoUrl: team.team_logo_url,
      primaryColor: team.team_primary_color,
      secondaryColor: team.team_secondary_color
    };

    // Build roster info
    const roster = {
      rosterId,
      leagueId: sleeperData.leagueId
    };

    // Process lineup data
    const lineup = this.processLineupData(sleeperData, teamLabel);

    return {
      teamInfo,
      roster,
      lineup,
      sleeperData
    };
  }

  /**
   * Process lineup data for a team
   */
  private processLineupData(
    sleeperData: CrossConferenceSleeperData['team1SleeperData'],
    teamLabel: string
  ): EnhancedMatchupResult['team1']['lineup'] {
    console.log(`📋 Processing lineup for ${teamLabel}...`);

    const starters: EnhancedMatchupResult['team1']['lineup']['starters'] = [];
    let totalPoints = 0;

    // Expected positions for The Gladiator League
    const expectedPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'WRT', 'WRTQ'];

    const sleeperStarters = sleeperData.matchup?.starters || sleeperData.roster?.starters || [];
    const starterPoints = sleeperData.matchup?.starters_points || [];
    const playerPoints = sleeperData.matchup?.players_points || {};

    expectedPositions.forEach((expectedPos, index) => {
      const playerId = sleeperStarters[index];
      const points = starterPoints[index] || playerPoints[playerId] || 0;
      
      if (playerId && this.allPlayers[playerId]) {
        const player = this.allPlayers[playerId];
        const isValid = this.validatePlayerPosition(player.position, expectedPos);
        
        starters.push({
          position: expectedPos,
          playerId,
          playerName: this.getPlayerName(player),
          nflTeam: player.team || 'FA',
          points,
          isValid
        });

        totalPoints += points;
      } else {
        // Empty slot or unknown player
        starters.push({
          position: expectedPos,
          playerId: playerId || '',
          playerName: playerId ? 'Unknown Player' : 'Empty Slot',
          nflTeam: '',
          points,
          isValid: false
        });

        totalPoints += points;
      }
    });

    console.log(`  Lineup processed: ${starters.length} positions, ${totalPoints.toFixed(1)} total points`);

    return {
      starters,
      totalPoints,
      projectedPoints: sleeperData.matchup?.projected_points
    };
  }

  /**
   * Validate if a player's position is eligible for the expected position
   */
  private validatePlayerPosition(playerPosition: string, expectedPosition: string): boolean {
    switch (expectedPosition) {
      case 'QB':
      case 'RB':
      case 'WR': 
      case 'TE':
        return playerPosition === expectedPosition;
      case 'WRT': // Flex: RB/WR/TE
        return ['RB', 'WR', 'TE'].includes(playerPosition);
      case 'WRTQ': // SuperFlex: QB/RB/WR/TE
        return ['QB', 'RB', 'WR', 'TE'].includes(playerPosition);
      default:
        return false;
    }
  }

  /**
   * Get formatted player name
   */
  private getPlayerName(player: SleeperPlayer): string {
    if (player.first_name && player.last_name) {
      return `${player.first_name} ${player.last_name}`;
    }
    return player.full_name || player.last_name || player.first_name || 'Unknown Player';
  }

  /**
   * Determine match status
   */
  private determineMatchStatus(
    databaseMatchup: DatabaseMatchup,
    sleeperData: CrossConferenceSleeperData
  ): 'upcoming' | 'live' | 'completed' {
    if (databaseMatchup.status === 'complete' || databaseMatchup.status === 'completed') {
      return 'completed';
    }

    // Check if we have scoring data
    const hasScoring = sleeperData.dataQuality.scoringDataAvailable;
    
    if (hasScoring) {
      const team1Points = sleeperData.team1SleeperData.matchup?.points || 0;
      const team2Points = sleeperData.team2SleeperData.matchup?.points || 0;
      
      if (team1Points > 0 || team2Points > 0) {
        return databaseMatchup.status === 'complete' ? 'completed' : 'live';
      }
    }

    return 'upcoming';
  }

  /**
   * Determine the winner of a matchup
   */
  private determineWinner(
    team1Data: EnhancedMatchupResult['team1'],
    team2Data: EnhancedMatchupResult['team2'],
    databaseMatchup: DatabaseMatchup
  ): 'team1' | 'team2' | null {
    // Use database winner if available
    if (databaseMatchup.winner_id) {
      if (databaseMatchup.winner_id === team1Data.teamInfo.teamId) {
        return 'team1';
      } else if (databaseMatchup.winner_id === team2Data.teamInfo.teamId) {
        return 'team2';
      }
    }

    // Calculate winner from scores
    const team1Points = team1Data.lineup.totalPoints;
    const team2Points = team2Data.lineup.totalPoints;

    if (team1Points > team2Points) {
      return 'team1';
    } else if (team2Points > team1Points) {
      return 'team2';
    }

    return null; // Tie or no scoring data
  }

  /**
   * Assess overall data quality
   */
  private assessOverallDataQuality(
    enhanced: EnhancedMatchupData,
    sleeperData: CrossConferenceSleeperData,
    team1Data: EnhancedMatchupResult['team1'],
    team2Data: EnhancedMatchupResult['team2']
  ): EnhancedMatchupResult['dataQuality'] {
    const issues: string[] = [];
    const warnings: string[] = [...sleeperData.warnings];

    // Check lineup validation
    const team1LineupValid = team1Data.lineup.starters.every(s => s.isValid);
    const team2LineupValid = team2Data.lineup.starters.every(s => s.isValid);
    const lineupValidationPassed = team1LineupValid && team2LineupValid;

    if (!team1LineupValid) {
      issues.push(`${team1Data.teamInfo.teamName} has invalid lineup positions`);
    }
    if (!team2LineupValid) {
      issues.push(`${team2Data.teamInfo.teamName} has invalid lineup positions`);
    }

    // Check data completeness
    if (!sleeperData.dataQuality.team1DataComplete) {
      issues.push(`Incomplete Sleeper data for ${team1Data.teamInfo.teamName}`);
    }
    if (!sleeperData.dataQuality.team2DataComplete) {
      issues.push(`Incomplete Sleeper data for ${team2Data.teamInfo.teamName}`);
    }

    // Calculate overall score
    let score = 100;
    score -= issues.length * 15; // Major penalty for issues
    score -= warnings.length * 5; // Minor penalty for warnings
    score = Math.max(0, score);

    return {
      overallScore: score,
      team1DataComplete: sleeperData.dataQuality.team1DataComplete,
      team2DataComplete: sleeperData.dataQuality.team2DataComplete,
      lineupValidationPassed,
      scoringDataAvailable: sleeperData.dataQuality.scoringDataAvailable,
      issues,
      warnings
    };
  }

  /**
   * Log comprehensive matchup summary
   */
  private logMatchupSummary(results: EnhancedMatchupResult[], week: number): void {
    const stats = {
      total: results.length,
      interConference: results.filter(r => r.isInterConference).length,
      manualOverrides: results.filter(r => r.isManualOverride).length,
      completed: results.filter(r => r.status === 'completed').length,
      live: results.filter(r => r.status === 'live').length,
      upcoming: results.filter(r => r.status === 'upcoming').length,
      highQuality: results.filter(r => r.dataQuality.overallScore >= 90).length,
      withIssues: results.filter(r => r.dataQuality.issues.length > 0).length
    };

    console.log(`📊 Enhanced Matchup Summary for Week ${week}:`);
    console.log(`  📈 Total matchups: ${stats.total}`);
    console.log(`  🌐 Inter-conference: ${stats.interConference} (${(stats.interConference/stats.total*100).toFixed(1)}%)`);
    console.log(`  🔧 Manual overrides: ${stats.manualOverrides} (${(stats.manualOverrides/stats.total*100).toFixed(1)}%)`);
    console.log(`  ✅ Completed: ${stats.completed}`);
    console.log(`  🔴 Live: ${stats.live}`);
    console.log(`  ⏳ Upcoming: ${stats.upcoming}`);
    console.log(`  💎 High quality (90%+): ${stats.highQuality} (${(stats.highQuality/stats.total*100).toFixed(1)}%)`);
    console.log(`  ⚠️ With issues: ${stats.withIssues} (${(stats.withIssues/stats.total*100).toFixed(1)}%)`);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.allPlayers = {};
    this.playersLastFetched = 0;
    databaseMatchupService.clearCaches();
    crossConferenceSleeperService.clearCaches();
    console.log('🧹 Enhanced matchup service caches cleared');
  }

  /**
   * Get service status
   */
  getServiceStatus(): {
    playersLoaded: number;
    playersLastFetched: Date | null;
    cacheStatistics: any;
  } {
    return {
      playersLoaded: Object.keys(this.allPlayers).length,
      playersLastFetched: this.playersLastFetched > 0 ? new Date(this.playersLastFetched) : null,
      cacheStatistics: crossConferenceSleeperService.getCacheStatistics()
    };
  }
}

export default new EnhancedMatchupService();