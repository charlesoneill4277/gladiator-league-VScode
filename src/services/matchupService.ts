import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from './sleeperApi';
import { matchupDataFlowDebugger } from './matchupDataFlowDebugger';

export interface DatabaseMatchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
  sleeper_matchup_id: string;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
  is_manual_override: boolean;
  status: string;
  matchup_date: string;
  notes: string;
}

export interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url: string;
}

export interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name: string;
  co_owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

export interface TeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
  joined_date: string;
}

export interface HybridMatchupTeam {
  roster_id: number;
  points: number;
  projected_points?: number;
  owner: SleeperUser | null;
  roster: SleeperRoster | null;
  team: Team | null;
  players_points: Record<string, number>;
  starters_points: number[];
  matchup_starters: string[];
  database_team_id?: number; // From database
}

export interface HybridMatchup {
  matchup_id: number;
  conference: Conference;
  teams: HybridMatchupTeam[];
  status: 'live' | 'completed' | 'upcoming';
  isManualOverride: boolean;
  databaseMatchupId?: number;
  overrideNotes?: string;
  dataSource: 'database' | 'sleeper' | 'hybrid';
  week: number;
  rawData?: any;
}

class MatchupService {
  private teamConferenceMap = new Map<string, {teamId: number;rosterId: string;}>();
  private rosterValidationCache = new Map<string, any>();
  private debugMode = false;

  /**
   * Enable/disable debug mode for comprehensive data flow tracking
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    matchupDataFlowDebugger.setDebugMode(enabled);
    console.log(`🔧 MatchupService debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (enabled) {
      console.log('🔍 Enhanced debugging features:');
      console.log('  ✓ Roster API verification');
      console.log('  ✓ Data validation tracing (roster_id → team_id → matchup)');
      console.log('  ✓ Comprehensive data flow logging');
      console.log('  ✓ Scoring data mapping validation');
      console.log('  ✓ Fallback logic monitoring');
      console.log('  ✓ Complete transformation pipeline tracking');
    }
  }

  /**
   * Get current debug mode status
   */
  getDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * Enhanced roster API verification method to cross-check team assignments
   * Validates that roster_id → team_id → matchup assignments are consistent
   */
  async verifyRosterAssignments(
    conferenceIds: number[],
    sleeperRosters: SleeperRoster[],
    teamMap: Map<string, {teamId: number; rosterId: string;}>
  ): Promise<{isValid: boolean; issues: string[]; recommendations: string[]}> {
    const traceId = this.debugMode ? matchupDataFlowDebugger.startTrace('roster_verification', 'verify_roster_assignments') : '';
    const stepId = this.debugMode ? matchupDataFlowDebugger.logStep(traceId, 'validation', 'roster_verification', {
      conferenceIds,
      sleeperRosterCount: sleeperRosters.length,
      teamMapSize: teamMap.size
    }).id : '';

    try {
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      console.log('🔍 Starting comprehensive roster assignment verification...');
      
      // 1. Cross-reference Sleeper rosters with team mappings
      const sleeperRosterIds = new Set(sleeperRosters.map(r => r.roster_id.toString()));
      const mappedRosterIds = new Set();
      
      for (const [key, mapping] of teamMap.entries()) {
        if (key.startsWith('roster_')) {
          mappedRosterIds.add(mapping.rosterId);
        }
      }
      
      // Check for missing roster mappings
      const unmappedSleeperRosters = [...sleeperRosterIds].filter(id => !mappedRosterIds.has(id));
      const unmappedTeamRosters = [...mappedRosterIds].filter(id => !sleeperRosterIds.has(id));
      
      if (unmappedSleeperRosters.length > 0) {
        issues.push(`Found ${unmappedSleeperRosters.length} Sleeper rosters without team mappings: ${unmappedSleeperRosters.join(', ')}`);
        recommendations.push('Update team_conferences_junction table to include missing roster mappings');
      }
      
      if (unmappedTeamRosters.length > 0) {
        issues.push(`Found ${unmappedTeamRosters.length} team roster mappings without corresponding Sleeper rosters: ${unmappedTeamRosters.join(', ')}`);
        recommendations.push('Review and clean up orphaned team roster mappings in database');
      }
      
      // 2. Validate team ownership consistency
      for (const roster of sleeperRosters) {
        const mapping = teamMap.get(`roster_${roster.roster_id}`);
        if (mapping) {
          // Verify the reverse mapping exists
          const reverseMapping = teamMap.get(`team_${mapping.teamId}`);
          if (!reverseMapping || reverseMapping.rosterId !== roster.roster_id.toString()) {
            issues.push(`Roster ${roster.roster_id} has inconsistent bidirectional team mapping`);
            recommendations.push(`Fix bidirectional mapping for roster ${roster.roster_id} and team ${mapping.teamId}`);
          }
        }
      }
      
      // 3. Check for duplicate roster assignments
      const rosterAssignments = new Map<string, number[]>();
      for (const [key, mapping] of teamMap.entries()) {
        if (key.startsWith('roster_')) {
          if (!rosterAssignments.has(mapping.rosterId)) {
            rosterAssignments.set(mapping.rosterId, []);
          }
          rosterAssignments.get(mapping.rosterId)!.push(mapping.teamId);
        }
      }
      
      for (const [rosterId, teamIds] of rosterAssignments.entries()) {
        if (teamIds.length > 1) {
          issues.push(`Roster ${rosterId} is assigned to multiple teams: ${teamIds.join(', ')}`);
          recommendations.push(`Resolve duplicate roster assignment for roster ${rosterId}`);
        }
      }
      
      const isValid = issues.length === 0;
      
      console.log(`${isValid ? '✅' : '❌'} Roster verification completed:`, {
        totalIssues: issues.length,
        isValid,
        sleeperRosters: sleeperRosters.length,
        mappedRosters: mappedRosterIds.size,
        unmappedSleeperRosters: unmappedSleeperRosters.length,
        unmappedTeamRosters: unmappedTeamRosters.length
      });
      
      if (this.debugMode) {
        matchupDataFlowDebugger.performConsistencyCheck(traceId, 'roster_mapping', 
          { expectedMappings: sleeperRosters.length, validationPassed: true },
          { actualMappings: mappedRosterIds.size, issues: issues.length }
        );
        
        if (!isValid) {
          matchupDataFlowDebugger.logError(traceId, 'high', 'validation', 'roster_verification',
            'Roster assignment validation failed', { issues, recommendations }
          );
        }
        
        matchupDataFlowDebugger.completeStep(traceId, stepId);
        matchupDataFlowDebugger.completeTrace(traceId);
      }
      
      return { isValid, issues, recommendations };
      
    } catch (error) {
      console.error('❌ Error during roster verification:', error);
      
      if (this.debugMode) {
        matchupDataFlowDebugger.logError(traceId, 'critical', 'validation', 'roster_verification', error, {
          conferenceIds, sleeperRosterCount: sleeperRosters.length
        });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
      }
      
      return {
        isValid: false,
        issues: [`Critical error during roster verification: ${error}`],
        recommendations: ['Review roster verification logic and data sources']
      };
    }
  }

  /**
   * Enhanced data validation that traces roster_id → team_id → matchup assignments
   * Provides comprehensive validation of the complete data flow
   */
  async validateDataFlowIntegrity(
    databaseMatchups: DatabaseMatchup[],
    sleeperMatchupsData: SleeperMatchup[],
    teamMap: Map<string, {teamId: number; rosterId: string;}>,
    teams: Team[]
  ): Promise<{isValid: boolean; integrity: any; recommendations: string[]}> {
    const traceId = this.debugMode ? matchupDataFlowDebugger.startTrace('data_flow_validation', 'validate_data_flow_integrity') : '';
    const stepId = this.debugMode ? matchupDataFlowDebugger.logStep(traceId, 'validation', 'data_flow_integrity', {
      databaseMatchups: databaseMatchups.length,
      sleeperMatchups: sleeperMatchupsData.length,
      teamMappings: teamMap.size,
      teams: teams.length
    }).id : '';

    try {
      console.log('🔬 Starting comprehensive data flow integrity validation...');
      
      const integrity = {
        rosterToTeamMappings: { valid: 0, invalid: 0, missing: 0 },
        teamToMatchupAssignments: { valid: 0, invalid: 0, missing: 0 },
        scoringDataConsistency: { valid: 0, invalid: 0, missing: 0 },
        dataCompleteness: { complete: 0, partial: 0, empty: 0 },
        crossReferenceValidation: { passed: 0, failed: 0 }
      };
      
      const recommendations: string[] = [];
      const validationErrors: string[] = [];
      
      // 1. Validate roster_id → team_id mappings
      console.log('🔗 Validating roster_id → team_id mappings...');
      for (const dbMatchup of databaseMatchups) {
        const team1Mapping = teamMap.get(`team_${dbMatchup.team_1_id}`);
        const team2Mapping = teamMap.get(`team_${dbMatchup.team_2_id}`);
        
        if (team1Mapping && team2Mapping) {
          // Verify reverse mappings exist and are consistent
          const reverseTeam1 = teamMap.get(`roster_${team1Mapping.rosterId}`);
          const reverseTeam2 = teamMap.get(`roster_${team2Mapping.rosterId}`);
          
          if (reverseTeam1?.teamId === dbMatchup.team_1_id && reverseTeam2?.teamId === dbMatchup.team_2_id) {
            integrity.rosterToTeamMappings.valid++;
          } else {
            integrity.rosterToTeamMappings.invalid++;
            validationErrors.push(`Matchup ${dbMatchup.id}: Inconsistent bidirectional roster mappings`);
          }
        } else {
          integrity.rosterToTeamMappings.missing++;
          validationErrors.push(`Matchup ${dbMatchup.id}: Missing roster mappings for teams ${dbMatchup.team_1_id}, ${dbMatchup.team_2_id}`);
        }
      }
      
      // 2. Validate team_id → matchup assignments
      console.log('📋 Validating team_id → matchup assignments...');
      for (const dbMatchup of databaseMatchups) {
        const team1 = teams.find(t => t.id === dbMatchup.team_1_id);
        const team2 = teams.find(t => t.id === dbMatchup.team_2_id);
        
        if (team1 && team2) {
          integrity.teamToMatchupAssignments.valid++;
        } else {
          integrity.teamToMatchupAssignments.invalid++;
          validationErrors.push(`Matchup ${dbMatchup.id}: Missing team records for IDs ${dbMatchup.team_1_id}, ${dbMatchup.team_2_id}`);
        }
      }
      
      // 3. Validate scoring data consistency
      console.log('📊 Validating scoring data consistency...');
      for (const dbMatchup of databaseMatchups) {
        const team1Mapping = teamMap.get(`team_${dbMatchup.team_1_id}`);
        const team2Mapping = teamMap.get(`team_${dbMatchup.team_2_id}`);
        
        if (team1Mapping && team2Mapping) {
          const sleeperTeam1 = sleeperMatchupsData.find(m => m.roster_id === parseInt(team1Mapping.rosterId));
          const sleeperTeam2 = sleeperMatchupsData.find(m => m.roster_id === parseInt(team2Mapping.rosterId));
          
          if (sleeperTeam1 && sleeperTeam2) {
            // Check if scoring data is available and consistent
            const hasValidScoringData = 
              (sleeperTeam1.points !== undefined && sleeperTeam1.points >= 0) &&
              (sleeperTeam2.points !== undefined && sleeperTeam2.points >= 0);
            
            if (hasValidScoringData) {
              integrity.scoringDataConsistency.valid++;
              
              // For manual overrides, check if scores match database
              if (dbMatchup.is_manual_override) {
                const scoreDiscrepancy = 
                  Math.abs(dbMatchup.team_1_score - sleeperTeam1.points) > 0.1 ||
                  Math.abs(dbMatchup.team_2_score - sleeperTeam2.points) > 0.1;
                
                if (scoreDiscrepancy && this.debugMode) {
                  console.log(`ℹ️ Manual override detected with score differences for matchup ${dbMatchup.id}`);
                }
              }
            } else {
              integrity.scoringDataConsistency.invalid++;
              validationErrors.push(`Matchup ${dbMatchup.id}: Invalid or missing scoring data from Sleeper`);
            }
          } else {
            integrity.scoringDataConsistency.missing++;
            validationErrors.push(`Matchup ${dbMatchup.id}: Missing Sleeper matchup data for rosters ${team1Mapping.rosterId}, ${team2Mapping.rosterId}`);
          }
        }
      }
      
      // 4. Validate data completeness
      console.log('📝 Validating data completeness...');
      for (const sleeperMatchup of sleeperMatchupsData) {
        const hasPlayerPoints = sleeperMatchup.players_points && Object.keys(sleeperMatchup.players_points).length > 0;
        const hasStarters = sleeperMatchup.starters && sleeperMatchup.starters.length > 0;
        const hasStartersPoints = sleeperMatchup.starters_points && sleeperMatchup.starters_points.length > 0;
        
        if (hasPlayerPoints && hasStarters && hasStartersPoints) {
          integrity.dataCompleteness.complete++;
        } else if (hasPlayerPoints || hasStarters || hasStartersPoints) {
          integrity.dataCompleteness.partial++;
        } else {
          integrity.dataCompleteness.empty++;
        }
      }
      
      // 5. Cross-reference validation
      console.log('🔄 Performing cross-reference validation...');
      const sleeperRosterIds = new Set(sleeperMatchupsData.map(m => m.roster_id));
      for (const [key, mapping] of teamMap.entries()) {
        if (key.startsWith('roster_')) {
          if (sleeperRosterIds.has(parseInt(mapping.rosterId))) {
            integrity.crossReferenceValidation.passed++;
          } else {
            integrity.crossReferenceValidation.failed++;
            validationErrors.push(`Roster ${mapping.rosterId} in team mapping but not found in Sleeper data`);
          }
        }
      }
      
      // Generate recommendations based on validation results
      if (integrity.rosterToTeamMappings.invalid > 0 || integrity.rosterToTeamMappings.missing > 0) {
        recommendations.push('Review and fix roster-to-team mappings in team_conferences_junction table');
      }
      
      if (integrity.teamToMatchupAssignments.invalid > 0) {
        recommendations.push('Verify team records exist for all matchup assignments');
      }
      
      if (integrity.scoringDataConsistency.invalid > 0 || integrity.scoringDataConsistency.missing > 0) {
        recommendations.push('Check Sleeper API connectivity and data synchronization for scoring information');
      }
      
      if (integrity.dataCompleteness.empty > 0) {
        recommendations.push('Some matchups have no player or scoring data - verify week and league configuration');
      }
      
      if (integrity.crossReferenceValidation.failed > 0) {
        recommendations.push('Clean up orphaned roster mappings or update Sleeper API data source');
      }
      
      const isValid = validationErrors.length === 0;
      
      console.log(`${isValid ? '✅' : '❌'} Data flow integrity validation completed:`, {
        isValid,
        totalErrors: validationErrors.length,
        integrity,
        recommendations: recommendations.length
      });
      
      if (this.debugMode) {
        matchupDataFlowDebugger.logDataTransformation(traceId, 'validation', 'hybrid_service', 
          { databaseMatchups, sleeperMatchupsData }, 
          { integrity, validationErrors, isValid }
        );
        
        if (!isValid) {
          matchupDataFlowDebugger.logError(traceId, 'high', 'validation', 'data_flow_integrity',
            `Data flow validation failed with ${validationErrors.length} errors`, 
            { validationErrors, integrity }
          );
        }
        
        matchupDataFlowDebugger.completeStep(traceId, stepId);
        matchupDataFlowDebugger.completeTrace(traceId);
      }
      
      return { isValid, integrity, recommendations };
      
    } catch (error) {
      console.error('❌ Error during data flow integrity validation:', error);
      
      if (this.debugMode) {
        matchupDataFlowDebugger.logError(traceId, 'critical', 'validation', 'data_flow_integrity', error, {
          databaseMatchups: databaseMatchups.length,
          sleeperMatchups: sleeperMatchupsData.length
        });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
      }
      
      return {
        isValid: false,
        integrity: { error: 'Critical validation error' },
        recommendations: ['Review data flow integrity validation logic']
      };
    }
  }

  /**
   * Fetch database matchups for a specific week and conferences
   */
  async fetchDatabaseMatchups(conferenceIds: number[], week: number): Promise<DatabaseMatchup[]> {
    const traceId = this.debugMode ? matchupDataFlowDebugger.startTrace(`db_fetch_${week}`, 'fetch_database_matchups') : '';
    const stepId = this.debugMode ? matchupDataFlowDebugger.logStep(traceId, 'database', 'fetch_matchups', { conferenceIds, week }).id : '';

    try {
      console.log('🗄️ Fetching database matchups...', { conferenceIds, week });

      if (conferenceIds.length === 0) {
        console.log('No conference IDs provided, skipping database query');
        return [];
      }

      const filters = [
      {
        name: 'week',
        op: 'Equal',
        value: week
      }];


      // If we have specific conferences, filter by them
      if (conferenceIds.length === 1) {
        filters.push({
          name: 'conference_id',
          op: 'Equal',
          value: conferenceIds[0]
        });
      }

      const response = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const dbMatchups = response.data.List as DatabaseMatchup[];

      // Filter by conference IDs if we have multiple
      const filteredMatchups = conferenceIds.length > 1 ?
      dbMatchups.filter((m) => conferenceIds.includes(m.conference_id)) :
      dbMatchups;

      console.log(`✅ Found ${filteredMatchups.length} database matchups for week ${week}`);

      // Debug: Log data transformation and validation
      if (this.debugMode) {
        matchupDataFlowDebugger.logDataTransformation(traceId, 'database', 'hybrid_service', null, filteredMatchups);
        matchupDataFlowDebugger.performConsistencyCheck(traceId, 'data_integrity', { expectedCount: conferenceIds.length * 6 }, { actualCount: filteredMatchups.length });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
        matchupDataFlowDebugger.completeTrace(traceId);
      }

      return filteredMatchups;
    } catch (error) {
      console.error('❌ Error fetching database matchups:', error);

      // Debug: Log error
      if (this.debugMode) {
        matchupDataFlowDebugger.logError(traceId, 'high', 'database', 'fetch_matchups', error, { conferenceIds, week });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
      }

      throw error;
    }
  }

  /**
   * Build mapping between teams and conferences from junction table
   */
  async buildTeamConferenceMap(conferenceIds: number[]): Promise<Map<string, {teamId: number;rosterId: string;}>> {
    const traceId = this.debugMode ? matchupDataFlowDebugger.startTrace(`map_${conferenceIds.join('_')}`, 'build_team_conference_map') : '';
    const stepId = this.debugMode ? matchupDataFlowDebugger.logStep(traceId, 'database', 'build_team_map', { conferenceIds }).id : '';

    try {
      console.log('🔗 Building team-conference mapping...', { conferenceIds });

      const filters = conferenceIds.length > 0 ? [
      conferenceIds.length === 1 ? {
        name: 'conference_id',
        op: 'Equal',
        value: conferenceIds[0]
      } : null].
      filter(Boolean) : [];

      const response = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 500,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const junctions = response.data.List as TeamConferenceJunction[];
      const map = new Map<string, {teamId: number;rosterId: string;}>();

      junctions.forEach((junction) => {
        if (conferenceIds.length === 0 || conferenceIds.includes(junction.conference_id)) {
          // Map both ways: rosterId -> teamId and teamId -> rosterId
          map.set(`roster_${junction.roster_id}`, {
            teamId: junction.team_id,
            rosterId: junction.roster_id
          });
          map.set(`team_${junction.team_id}`, {
            teamId: junction.team_id,
            rosterId: junction.roster_id
          });
        }
      });

      this.teamConferenceMap = map;
      console.log(`✅ Built team-conference mapping with ${map.size} entries`);

      // Debug: Validate mapping integrity
      if (this.debugMode) {
        const mapArray = Array.from(map.entries());
        matchupDataFlowDebugger.logDataTransformation(traceId, 'database', 'hybrid_service', junctions, mapArray);
        matchupDataFlowDebugger.performConsistencyCheck(traceId, 'roster_mapping', { expectedMappings: junctions.length * 2 }, { actualMappings: map.size });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
        matchupDataFlowDebugger.completeTrace(traceId);
      }

      return map;
    } catch (error) {
      console.error('❌ Error building team-conference map:', error);

      // Debug: Log error
      if (this.debugMode) {
        matchupDataFlowDebugger.logError(traceId, 'critical', 'database', 'build_team_map', error, { conferenceIds });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
      }

      throw error;
    }
  }

  /**
   * Fetch teams from database
   */
  async fetchTeams(): Promise<Team[]> {
    try {
      const response = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data.List as Team[];
    } catch (error) {
      console.error('❌ Error fetching teams:', error);
      throw error;
    }
  }

  /**
   * Enhanced scoring data validation with comprehensive mapping verification
   * Ensures that scoring data is correctly mapped to the right teams in each matchup
   */
  validateScoringDataMapping(
    dbMatchup: DatabaseMatchup,
    sleeperMatchup1: SleeperMatchup | undefined,
    sleeperMatchup2: SleeperMatchup | undefined,
    teamMap: Map<string, {teamId: number; rosterId: string;}>
  ): {isValid: boolean; issues: string[]; corrections: any} {
    const issues: string[] = [];
    const corrections: any = {};
    
    console.log(`🎯 Validating scoring data mapping for matchup ${dbMatchup.id}...`);
    
    // Get expected roster IDs for the teams
    const team1Mapping = teamMap.get(`team_${dbMatchup.team_1_id}`);
    const team2Mapping = teamMap.get(`team_${dbMatchup.team_2_id}`);
    
    if (!team1Mapping || !team2Mapping) {
      issues.push('Missing roster mappings for one or both teams');
      return { isValid: false, issues, corrections };
    }
    
    const expectedRoster1Id = parseInt(team1Mapping.rosterId);
    const expectedRoster2Id = parseInt(team2Mapping.rosterId);
    
    // Validate that scoring data matches expected roster assignments
    if (sleeperMatchup1) {
      if (sleeperMatchup1.roster_id !== expectedRoster1Id) {
        issues.push(`Team 1 scoring data roster mismatch: expected ${expectedRoster1Id}, got ${sleeperMatchup1.roster_id}`);
        corrections.team1CorrectRosterId = expectedRoster1Id;
      }
      
      // Validate scoring data completeness
      if (sleeperMatchup1.points === undefined || sleeperMatchup1.points < 0) {
        issues.push('Team 1 has invalid or missing points data');
      }
      
      if (!sleeperMatchup1.players_points || Object.keys(sleeperMatchup1.players_points).length === 0) {
        issues.push('Team 1 missing player-level scoring data');
      }
    } else {
      issues.push('Missing Sleeper matchup data for team 1');
    }
    
    if (sleeperMatchup2) {
      if (sleeperMatchup2.roster_id !== expectedRoster2Id) {
        issues.push(`Team 2 scoring data roster mismatch: expected ${expectedRoster2Id}, got ${sleeperMatchup2.roster_id}`);
        corrections.team2CorrectRosterId = expectedRoster2Id;
      }
      
      // Validate scoring data completeness
      if (sleeperMatchup2.points === undefined || sleeperMatchup2.points < 0) {
        issues.push('Team 2 has invalid or missing points data');
      }
      
      if (!sleeperMatchup2.players_points || Object.keys(sleeperMatchup2.players_points).length === 0) {
        issues.push('Team 2 missing player-level scoring data');
      }
    } else {
      issues.push('Missing Sleeper matchup data for team 2');
    }
    
    // Cross-validate matchup assignment consistency
    if (sleeperMatchup1 && sleeperMatchup2) {
      if (sleeperMatchup1.matchup_id !== sleeperMatchup2.matchup_id) {
        issues.push(`Sleeper matchup ID mismatch: team 1 (${sleeperMatchup1.matchup_id}) vs team 2 (${sleeperMatchup2.matchup_id})`);
      }
    }
    
    const isValid = issues.length === 0;
    
    if (this.debugMode) {
      console.log(`${isValid ? '✅' : '❌'} Scoring data validation for matchup ${dbMatchup.id}:`, {
        isValid,
        issues: issues.length,
        expectedRosters: [expectedRoster1Id, expectedRoster2Id],
        actualRosters: [sleeperMatchup1?.roster_id, sleeperMatchup2?.roster_id]
      });
    }
    
    return { isValid, issues, corrections };
  }

  /**
   * Enhanced fallback logic for handling missing or inconsistent data
   * Provides graceful degradation when data is incomplete
   */
  async applyFallbackLogic(
    dbMatchup: DatabaseMatchup,
    conference: Conference,
    teams: Team[],
    teamMap: Map<string, {teamId: number; rosterId: string;}>,
    originalSleeperData?: {matchups: SleeperMatchup[]; rosters: SleeperRoster[]; users: SleeperUser[]},
    allPlayers?: Record<string, SleeperPlayer>
  ): Promise<{success: boolean; fallbackData: any; fallbackType: string}> {
    const traceId = this.debugMode ? matchupDataFlowDebugger.startTrace(`fallback_${dbMatchup.id}`, 'apply_fallback_logic') : '';
    
    try {
      console.log(`🔄 Applying fallback logic for matchup ${dbMatchup.id}...`);
      
      const team1 = teams.find(t => t.id === dbMatchup.team_1_id);
      const team2 = teams.find(t => t.id === dbMatchup.team_2_id);
      
      if (!team1 || !team2) {
        return { success: false, fallbackData: null, fallbackType: 'no_teams_found' };
      }
      
      // Try different fallback strategies in order of preference
      
      // 1. Try to fetch fresh data from Sleeper API
      if (conference.league_id) {
        try {
          console.log('🔄 Fallback strategy 1: Fresh Sleeper API fetch...');
          const teamMapping1 = teamMap.get(`team_${dbMatchup.team_1_id}`);
          const teamMapping2 = teamMap.get(`team_${dbMatchup.team_2_id}`);
          
          if (teamMapping1 && teamMapping2) {
            const freshData = await SleeperApiService.fetchTeamsMatchupData(
              conference.league_id,
              dbMatchup.week,
              [parseInt(teamMapping1.rosterId), parseInt(teamMapping2.rosterId)]
            );
            
            if (freshData.matchups.length >= 2) {
              console.log('✅ Fallback strategy 1 successful: Fresh data retrieved');
              return {
                success: true,
                fallbackData: freshData,
                fallbackType: 'fresh_sleeper_api'
              };
            }
          }
        } catch (error) {
          console.warn('⚠️ Fallback strategy 1 failed:', error);
        }
      }
      
      // 2. Use manual override data if available
      if (dbMatchup.is_manual_override) {
        console.log('🔄 Fallback strategy 2: Manual override data...');
        
        const fallbackMatchupData = {
          matchups: [
            {
              roster_id: parseInt(teamMap.get(`team_${dbMatchup.team_1_id}`)?.rosterId || '0'),
              points: dbMatchup.team_1_score,
              players_points: {},
              starters_points: [],
              starters: [],
              matchup_id: dbMatchup.id
            },
            {
              roster_id: parseInt(teamMap.get(`team_${dbMatchup.team_2_id}`)?.rosterId || '0'),
              points: dbMatchup.team_2_score,
              players_points: {},
              starters_points: [],
              starters: [],
              matchup_id: dbMatchup.id
            }
          ],
          rosters: originalSleeperData?.rosters || [],
          users: originalSleeperData?.users || []
        };
        
        console.log('✅ Fallback strategy 2 successful: Using manual override data');
        return {
          success: true,
          fallbackData: fallbackMatchupData,
          fallbackType: 'manual_override'
        };
      }
      
      // 3. Use partial original data with defaults
      if (originalSleeperData) {
        console.log('🔄 Fallback strategy 3: Partial original data with defaults...');
        
        const teamMapping1 = teamMap.get(`team_${dbMatchup.team_1_id}`);
        const teamMapping2 = teamMap.get(`team_${dbMatchup.team_2_id}`);
        
        if (teamMapping1 && teamMapping2) {
          const roster1Id = parseInt(teamMapping1.rosterId);
          const roster2Id = parseInt(teamMapping2.rosterId);
          
          // Find existing matchup data or create defaults
          let matchup1 = originalSleeperData.matchups.find(m => m.roster_id === roster1Id);
          let matchup2 = originalSleeperData.matchups.find(m => m.roster_id === roster2Id);
          
          if (!matchup1) {
            matchup1 = {
              roster_id: roster1Id,
              points: 0,
              players_points: {},
              starters_points: [],
              starters: [],
              matchup_id: dbMatchup.id
            };
          }
          
          if (!matchup2) {
            matchup2 = {
              roster_id: roster2Id,
              points: 0,
              players_points: {},
              starters_points: [],
              starters: [],
              matchup_id: dbMatchup.id
            };
          }
          
          const fallbackData = {
            matchups: [matchup1, matchup2],
            rosters: originalSleeperData.rosters,
            users: originalSleeperData.users
          };
          
          console.log('✅ Fallback strategy 3 successful: Using partial data with defaults');
          return {
            success: true,
            fallbackData,
            fallbackType: 'partial_with_defaults'
          };
        }
      }
      
      // 4. Last resort: Create minimal data structure
      console.log('🔄 Fallback strategy 4: Creating minimal data structure...');
      
      const teamMapping1 = teamMap.get(`team_${dbMatchup.team_1_id}`);
      const teamMapping2 = teamMap.get(`team_${dbMatchup.team_2_id}`);
      
      const minimalData = {
        matchups: [
          {
            roster_id: parseInt(teamMapping1?.rosterId || '0'),
            points: 0,
            players_points: {},
            starters_points: [],
            starters: [],
            matchup_id: dbMatchup.id
          },
          {
            roster_id: parseInt(teamMapping2?.rosterId || '0'),
            points: 0,
            players_points: {},
            starters_points: [],
            starters: [],
            matchup_id: dbMatchup.id
          }
        ],
        rosters: [],
        users: []
      };
      
      console.log('⚠️ Fallback strategy 4 applied: Minimal data structure created');
      return {
        success: true,
        fallbackData: minimalData,
        fallbackType: 'minimal_structure'
      };
      
    } catch (error) {
      console.error('❌ All fallback strategies failed:', error);
      
      if (this.debugMode) {
        matchupDataFlowDebugger.logError(traceId, 'critical', 'hybrid_service', 'fallback_logic', error, {
          matchupId: dbMatchup.id,
          conference: conference.conference_name
        });
      }
      
      return { success: false, fallbackData: null, fallbackType: 'all_strategies_failed' };
    }
  }

  /**
   * Enhanced debug pipeline for complete data transformation tracking
   * Provides detailed logging of each step in the data transformation process
   */
  logDataTransformationPipeline(
    stage: string,
    operation: string,
    inputData: any,
    outputData: any,
    transformationDetails: any = {}
  ): void {
    if (!this.debugMode) return;
    
    const timestamp = new Date().toISOString();
    const pipelineStep = {
      timestamp,
      stage,
      operation,
      input: {
        type: Array.isArray(inputData) ? 'array' : typeof inputData,
        size: Array.isArray(inputData) ? inputData.length : Object.keys(inputData || {}).length,
        keys: Array.isArray(inputData) ? [] : Object.keys(inputData || {}),
        sample: this.getSampleData(inputData)
      },
      output: {
        type: Array.isArray(outputData) ? 'array' : typeof outputData,
        size: Array.isArray(outputData) ? outputData.length : Object.keys(outputData || {}).length,
        keys: Array.isArray(outputData) ? [] : Object.keys(outputData || {}),
        sample: this.getSampleData(outputData)
      },
      transformationDetails,
      metrics: {
        dataGrowth: this.calculateDataGrowth(inputData, outputData),
        fieldsAdded: this.getFieldsAdded(inputData, outputData),
        fieldsRemoved: this.getFieldsRemoved(inputData, outputData),
        fieldsModified: this.getFieldsModified(inputData, outputData)
      }
    };
    
    console.log(`🔌 Data Transformation Pipeline [${stage}/${operation}]:`, pipelineStep);
    
    // Track performance implications
    if (pipelineStep.metrics.dataGrowth > 5) {
      console.warn(`⚠️ Significant data growth detected: ${pipelineStep.metrics.dataGrowth}x increase`);
    }
    
    if (pipelineStep.metrics.fieldsRemoved.length > 0) {
      console.warn(`⚠️ Data fields removed during transformation:`, pipelineStep.metrics.fieldsRemoved);
    }
  }

  /**
   * Helper method to get sample data for debugging without overwhelming logs
   */
  private getSampleData(data: any): any {
    if (!data) return null;
    
    if (Array.isArray(data)) {
      return data.slice(0, 2); // First 2 items
    }
    
    if (typeof data === 'object') {
      const keys = Object.keys(data).slice(0, 5); // First 5 keys
      const sample: any = {};
      keys.forEach(key => {
        sample[key] = data[key];
      });
      return sample;
    }
    
    return data;
  }

  /**
   * Calculate data growth ratio between input and output
   */
  private calculateDataGrowth(input: any, output: any): number {
    if (!input || !output) return 0;
    
    const inputSize = JSON.stringify(input).length;
    const outputSize = JSON.stringify(output).length;
    
    return inputSize > 0 ? outputSize / inputSize : 0;
  }

  /**
   * Get fields that were added during transformation
   */
  private getFieldsAdded(input: any, output: any): string[] {
    if (!input || !output || typeof input !== 'object' || typeof output !== 'object') {
      return [];
    }
    
    const inputKeys = new Set(Object.keys(input));
    const outputKeys = new Set(Object.keys(output));
    
    return Array.from(outputKeys).filter(key => !inputKeys.has(key));
  }

  /**
   * Get fields that were removed during transformation
   */
  private getFieldsRemoved(input: any, output: any): string[] {
    if (!input || !output || typeof input !== 'object' || typeof output !== 'object') {
      return [];
    }
    
    const inputKeys = new Set(Object.keys(input));
    const outputKeys = new Set(Object.keys(output));
    
    return Array.from(inputKeys).filter(key => !outputKeys.has(key));
  }

  /**
   * Get fields that were modified during transformation
   */
  private getFieldsModified(input: any, output: any): string[] {
    if (!input || !output || typeof input !== 'object' || typeof output !== 'object') {
      return [];
    }
    
    const modified: string[] = [];
    const commonKeys = Object.keys(input).filter(key => Object.keys(output).includes(key));
    
    commonKeys.forEach(key => {
      if (JSON.stringify(input[key]) !== JSON.stringify(output[key])) {
        modified.push(key);
      }
    });
    
    return modified;
  }

  /**
   * Get hybrid matchup data by combining database assignments with Sleeper API data
   */
  async getHybridMatchups(
  conferences: Conference[],
  teams: Team[],
  week: number,
  currentWeek: number,
  selectedSeason: number,
  allPlayers: Record<string, SleeperPlayer>)
  : Promise<HybridMatchup[]> {
    const traceId = this.debugMode ? matchupDataFlowDebugger.startTrace(`hybrid_${week}`, 'get_hybrid_matchups') : '';
    const stepId = this.debugMode ? matchupDataFlowDebugger.logStep(traceId, 'hybrid_service', 'fetch_hybrid_data', {
      conferences: conferences.length,
      teams: teams.length,
      week,
      currentWeek,
      selectedSeason
    }).id : '';

    try {
      console.log('🚀 Starting hybrid matchup data fetch...', {
        conferences: conferences.length,
        teams: teams.length,
        week,
        currentWeek,
        selectedSeason
      });

      const conferenceIds = conferences.map((c) => c.id);

      // Step 1: Fetch database matchups (team assignments)
      const [databaseMatchups, teamMap] = await Promise.all([
      this.fetchDatabaseMatchups(conferenceIds, week),
      this.buildTeamConferenceMap(conferenceIds)]
      );

      console.log(`📊 Database matchups: ${databaseMatchups.length}`);
      console.log(`🔗 Team mappings: ${teamMap.size}`);

      const hybridMatchups: HybridMatchup[] = [];

      // Step 2: Process each conference
      for (const conference of conferences) {
        try {
          console.log(`🏟️ Processing conference: ${conference.conference_name}`);

          // Get database matchups for this conference
          const conferenceDbMatchups = databaseMatchups.filter(
            (m) => m.conference_id === conference.id
          );

          console.log(`📋 Conference DB matchups: ${conferenceDbMatchups.length}`);

          if (conferenceDbMatchups.length === 0) {
            // No database matchups - fall back to Sleeper API for matchup assignments
            console.log(`⚠️ No database matchups for ${conference.conference_name}, falling back to Sleeper API`);

            const sleeperMatchups = await this.getSleeperMatchups(
              conference,
              teams,
              week,
              currentWeek,
              selectedSeason,
              allPlayers
            );

            hybridMatchups.push(...sleeperMatchups);
            continue;
          }

          // Fetch real-time data from Sleeper API
          const [sleeperMatchupsData, rostersData, usersData] = await Promise.all([
          SleeperApiService.fetchMatchups(conference.league_id, week),
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)]
          );

          console.log(`📈 Sleeper API data:`, {
            matchups: sleeperMatchupsData.length,
            rosters: rostersData.length,
            users: usersData.length
          });

          // Step 3: Create hybrid matchups using database assignments + Sleeper data
          for (const dbMatchup of conferenceDbMatchups) {
            const hybridMatchup = await this.createHybridMatchup(
              dbMatchup,
              conference,
              teams,
              sleeperMatchupsData,
              rostersData,
              usersData,
              teamMap,
              allPlayers,
              week,
              currentWeek,
              selectedSeason
            );

            if (hybridMatchup) {
              hybridMatchups.push(hybridMatchup);
            }
          }

        } catch (error) {
          console.error(`❌ Error processing conference ${conference.conference_name}:`, error);

          // Continue with other conferences even if one fails
          continue;
        }
      }

      console.log(`✅ Created ${hybridMatchups.length} hybrid matchups`);

      // Debug: Final validation and consistency checks
      if (this.debugMode) {
        const dataSourceCounts = {
          database: hybridMatchups.filter((m) => m.dataSource === 'database').length,
          sleeper: hybridMatchups.filter((m) => m.dataSource === 'sleeper').length,
          hybrid: hybridMatchups.filter((m) => m.dataSource === 'hybrid').length
        };

        matchupDataFlowDebugger.logDataTransformation(traceId, 'hybrid_service', 'ui_component', databaseMatchups, hybridMatchups);
        matchupDataFlowDebugger.performConsistencyCheck(traceId, 'data_integrity',
        { expectedConferences: conferences.length },
        { actualMatchups: hybridMatchups.length, dataSourceCounts }
        );

        // Check for any matchups with missing team assignments
        const missingTeamAssignments = hybridMatchups.filter((m) =>
        !m.teams[0]?.database_team_id || !m.teams[1]?.database_team_id
        );

        if (missingTeamAssignments.length > 0) {
          matchupDataFlowDebugger.logError(traceId, 'medium', 'hybrid_service', 'team_assignment_validation',
          `${missingTeamAssignments.length} matchups missing team assignments`,
          { missingMatchupIds: missingTeamAssignments.map((m) => m.matchup_id) }
          );
        }

        matchupDataFlowDebugger.completeStep(traceId, stepId);
        matchupDataFlowDebugger.completeTrace(traceId);
      }

      return hybridMatchups;

    } catch (error) {
      console.error('❌ Error creating hybrid matchups:', error);

      // Debug: Log critical error
      if (this.debugMode) {
        matchupDataFlowDebugger.logError(traceId, 'critical', 'hybrid_service', 'get_hybrid_matchups', error, {
          conferences: conferences.length,
          teams: teams.length,
          week
        });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
      }

      throw error;
    }
  }

  /**
   * Create a single hybrid matchup from database assignment + Sleeper data
   * Enhanced to better handle manual overrides and ensure data consistency
   */
  private async createHybridMatchup(
  dbMatchup: DatabaseMatchup,
  conference: Conference,
  teams: Team[],
  sleeperMatchupsData: SleeperMatchup[],
  rostersData: SleeperRoster[],
  usersData: SleeperUser[],
  teamMap: Map<string, {teamId: number;rosterId: string;}>,
  allPlayers: Record<string, SleeperPlayer>,
  week: number,
  currentWeek: number,
  selectedSeason: number)
  : Promise<HybridMatchup | null> {
    const traceId = this.debugMode ? matchupDataFlowDebugger.startTrace(dbMatchup.id, 'create_hybrid_matchup') : '';
    const stepId = this.debugMode ? matchupDataFlowDebugger.logStep(traceId, 'hybrid_service', 'create_matchup', {
      matchupId: dbMatchup.id,
      teams: `${dbMatchup.team_1_id} vs ${dbMatchup.team_2_id}`,
      isManualOverride: dbMatchup.is_manual_override,
      conference: conference.conference_name
    }).id : '';

    try {
      // Find teams from database
      const team1 = teams.find((t) => t.id === dbMatchup.team_1_id);
      const team2 = teams.find((t) => t.id === dbMatchup.team_2_id);

      if (!team1 || !team2) {
        console.warn(`❌ Could not find teams for matchup ${dbMatchup.id}`);

        // Debug: Log team lookup failure
        if (this.debugMode) {
          matchupDataFlowDebugger.logError(traceId, 'high', 'hybrid_service', 'team_lookup',
          'Could not find teams in database',
          { matchupId: dbMatchup.id, team1Id: dbMatchup.team_1_id, team2Id: dbMatchup.team_2_id, availableTeams: teams.length }
          );
          matchupDataFlowDebugger.completeStep(traceId, stepId);
        }

        return null;
      }

      // Get roster IDs for these teams
      const team1RosterMapping = teamMap.get(`team_${team1.id}`);
      const team2RosterMapping = teamMap.get(`team_${team2.id}`);

      if (!team1RosterMapping || !team2RosterMapping) {
        console.warn(`❌ Could not find roster mappings for teams ${team1.id}, ${team2.id}`);

        // Debug: Log roster mapping failure
        if (this.debugMode) {
          matchupDataFlowDebugger.logError(traceId, 'critical', 'hybrid_service', 'roster_mapping',
          'Could not find roster mappings for teams',
          {
            matchupId: dbMatchup.id,
            team1: { id: team1.id, name: team1.team_name },
            team2: { id: team2.id, name: team2.team_name },
            availableMappings: teamMap.size
          }
          );
          matchupDataFlowDebugger.performConsistencyCheck(traceId, 'roster_mapping',
          { team1Id: team1.id, team2Id: team2.id },
          { team1Mapping: !!team1RosterMapping, team2Mapping: !!team2RosterMapping }
          );
          matchupDataFlowDebugger.completeStep(traceId, stepId);
        }

        return null;
      }

      const team1RosterId = parseInt(team1RosterMapping.rosterId);
      const team2RosterId = parseInt(team2RosterMapping.rosterId);

      // Determine if we should use database override or Sleeper data
      const useManualOverride = dbMatchup.is_manual_override;

      let team1SleeperData: SleeperMatchup | undefined;
      let team2SleeperData: SleeperMatchup | undefined;
      let team1Roster: SleeperRoster | undefined;
      let team2Roster: SleeperRoster | undefined;

      // Enhanced manual override logic for better data fetching
      if (useManualOverride) {
        console.log(`🔄 Manual override detected - ensuring complete data for rosters ${team1RosterId}, ${team2RosterId}`);

        try {
          // Fetch team-specific data with validation
          const teamBasedData = await this.fetchTeamsMatchupDataWithValidation(
            conference.league_id,
            week,
            [team1RosterId, team2RosterId],
            allPlayers
          );

          team1SleeperData = teamBasedData.matchups.find((m) => m.roster_id === team1RosterId);
          team2SleeperData = teamBasedData.matchups.find((m) => m.roster_id === team2RosterId);
          team1Roster = teamBasedData.rosters.find((r) => r.roster_id === team1RosterId);
          team2Roster = teamBasedData.rosters.find((r) => r.roster_id === team2RosterId);

          // Validate data completeness for manual overrides
          const validationResult = this.validateManualOverrideData({
            team1SleeperData,
            team2SleeperData,
            team1Roster,
            team2Roster
          }, `${team1.team_name} vs ${team2.team_name}`);

          if (!validationResult.isValid) {
            console.warn(`⚠️ Data validation failed for manual override, using fallback data:`, validationResult.issues);
            // Use fallback data but continue with the override
          }

          console.log(`✅ Manual override data validated:`, {
            team1HasData: !!team1SleeperData,
            team2HasData: !!team2SleeperData,
            team1Points: team1SleeperData?.points || 0,
            team2Points: team2SleeperData?.points || 0,
            team1PlayersPoints: Object.keys(team1SleeperData?.players_points || {}).length,
            team2PlayersPoints: Object.keys(team2SleeperData?.players_points || {}).length
          });
        } catch (error) {
          console.warn(`⚠️ Failed to fetch team-specific data for manual override, using fallback:`, error);
          // Fallback to original data but log this for debugging
          team1SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team1RosterId);
          team2SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team2RosterId);
          team1Roster = rostersData.find((r) => r.roster_id === team1RosterId);
          team2Roster = rostersData.find((r) => r.roster_id === team2RosterId);
        }
      } else {
        // For non-manual overrides, use the original matchup data
        team1SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team1RosterId);
        team2SleeperData = sleeperMatchupsData.find((m) => m.roster_id === team2RosterId);
        team1Roster = rostersData.find((r) => r.roster_id === team1RosterId);
        team2Roster = rostersData.find((r) => r.roster_id === team2RosterId);
      }

      const team1User = usersData.find((u) => u.user_id === team1Roster?.owner_id);
      const team2User = usersData.find((u) => u.user_id === team2Roster?.owner_id);

      // Enhanced team data creation with better fallback handling
      const hybridTeam1: HybridMatchupTeam = {
        roster_id: team1RosterId,
        points: useManualOverride ? dbMatchup.team_1_score : team1SleeperData?.points ?? 0,
        projected_points: team1SleeperData?.projected_points,
        owner: team1User || null,
        roster: team1Roster || null,
        team: team1,
        players_points: this.ensureValidPlayersPoints(team1SleeperData?.players_points),
        starters_points: this.ensureValidStartersPoints(team1SleeperData?.starters_points),
        matchup_starters: this.ensureValidMatchupStarters(team1SleeperData?.starters, team1Roster?.starters),
        database_team_id: team1.id
      };

      const hybridTeam2: HybridMatchupTeam = {
        roster_id: team2RosterId,
        points: useManualOverride ? dbMatchup.team_2_score : team2SleeperData?.points ?? 0,
        projected_points: team2SleeperData?.projected_points,
        owner: team2User || null,
        roster: team2Roster || null,
        team: team2,
        players_points: this.ensureValidPlayersPoints(team2SleeperData?.players_points),
        starters_points: this.ensureValidStartersPoints(team2SleeperData?.starters_points),
        matchup_starters: this.ensureValidMatchupStarters(team2SleeperData?.starters, team2Roster?.starters),
        database_team_id: team2.id
      };

      const status = this.determineMatchupStatus(week, currentWeek, selectedSeason, [hybridTeam1, hybridTeam2]);

      const hybridMatchup: HybridMatchup = {
        matchup_id: dbMatchup.id,
        conference,
        teams: [hybridTeam1, hybridTeam2],
        status,
        isManualOverride: useManualOverride,
        databaseMatchupId: dbMatchup.id,
        overrideNotes: dbMatchup.notes,
        dataSource: useManualOverride ? 'database' : 'hybrid',
        week,
        rawData: {
          databaseMatchup: dbMatchup,
          sleeperData: {
            team1: team1SleeperData,
            team2: team2SleeperData
          }
        }
      };

      console.log(`✅ Created hybrid matchup: ${team1.team_name} vs ${team2.team_name} (Manual Override: ${useManualOverride})`);

      // Debug: Log successful matchup creation and validate data integrity
      if (this.debugMode) {
        matchupDataFlowDebugger.logDataTransformation(traceId, 'database', 'hybrid_service', dbMatchup, hybridMatchup);

        // Perform comprehensive data validation
        matchupDataFlowDebugger.performConsistencyCheck(traceId, 'team_assignment',
        { team1Id: dbMatchup.team_1_id, team2Id: dbMatchup.team_2_id },
        { team1Id: hybridTeam1.database_team_id, team2Id: hybridTeam2.database_team_id }
        );

        matchupDataFlowDebugger.performConsistencyCheck(traceId, 'scoring_data',
        { team1Score: dbMatchup.team_1_score, team2Score: dbMatchup.team_2_score },
        { team1Score: hybridTeam1.points, team2Score: hybridTeam2.points }
        );

        matchupDataFlowDebugger.performConsistencyCheck(traceId, 'roster_mapping',
        { team1RosterId: team1RosterId, team2RosterId: team2RosterId },
        { team1RosterId: hybridTeam1.roster_id, team2RosterId: hybridTeam2.roster_id }
        );

        matchupDataFlowDebugger.completeStep(traceId, stepId);
        matchupDataFlowDebugger.completeTrace(traceId);
      }
      return hybridMatchup;

    } catch (error) {
      console.error('❌ Error creating hybrid matchup:', error);

      // Debug: Log matchup creation error
      if (this.debugMode) {
        matchupDataFlowDebugger.logError(traceId, 'high', 'hybrid_service', 'create_matchup', error, {
          matchupId: dbMatchup.id,
          teams: `${dbMatchup.team_1_id} vs ${dbMatchup.team_2_id}`,
          conference: conference.conference_name
        });
        matchupDataFlowDebugger.completeStep(traceId, stepId);
      }

      return null;
    }
  }

  /**
   * Fallback to pure Sleeper API matchups when no database assignments exist
   */
  private async getSleeperMatchups(
  conference: Conference,
  teams: Team[],
  week: number,
  currentWeek: number,
  selectedSeason: number,
  allPlayers: Record<string, SleeperPlayer>)
  : Promise<HybridMatchup[]> {
    try {
      const [matchupsData, rostersData, usersData] = await Promise.all([
      SleeperApiService.fetchMatchups(conference.league_id, week),
      SleeperApiService.fetchLeagueRosters(conference.league_id),
      SleeperApiService.fetchLeagueUsers(conference.league_id)]
      );

      const organizedMatchups = SleeperApiService.organizeMatchups(
        matchupsData,
        rostersData,
        usersData
      );

      return organizedMatchups.map((matchup) => ({
        matchup_id: matchup.matchup_id,
        conference,
        teams: matchup.teams.map((team) => {
          const dbTeam = teams.find((t) => t.owner_id === team.owner?.user_id);
          const matchupTeam = matchupsData.find((m) => m.roster_id === team.roster_id);

          return {
            ...team,
            team: dbTeam || null,
            players_points: matchupTeam?.players_points || {},
            starters_points: matchupTeam?.starters_points || [],
            matchup_starters: matchupTeam?.starters || [],
            database_team_id: dbTeam?.id
          };
        }),
        status: this.determineMatchupStatus(week, currentWeek, selectedSeason, matchup.teams),
        isManualOverride: false,
        dataSource: 'sleeper' as const,
        week
      }));
    } catch (error) {
      console.error('❌ Error getting Sleeper matchups:', error);
      return [];
    }
  }

  /**
   * Enhanced team-specific data fetching with validation for manual overrides
   */
  private async fetchTeamsMatchupDataWithValidation(
  leagueId: string,
  week: number,
  rosterIds: number[],
  allPlayers: Record<string, SleeperPlayer>)
  : Promise<{
    matchups: SleeperMatchup[];
    rosters: SleeperRoster[];
    users: SleeperUser[];
  }> {
    try {
      console.log(`🎯 Enhanced team-specific data fetch for rosters:`, rosterIds);

      // Use the existing SleeperApiService method but with enhanced logging
      const teamData = await SleeperApiService.fetchTeamsMatchupData(leagueId, week, rosterIds);

      // Additional validation for manual override scenarios
      const validation = {
        requestedRosters: rosterIds.length,
        foundMatchups: teamData.matchups.length,
        foundRosters: teamData.rosters.length,
        matchupsWithPlayerPoints: teamData.matchups.filter((m) =>
        m.players_points && Object.keys(m.players_points).length > 0
        ).length,
        matchupsWithStartersPoints: teamData.matchups.filter((m) =>
        m.starters_points && m.starters_points.length > 0
        ).length
      };

      console.log(`✅ Enhanced team data validation:`, validation);

      // Log any potential data issues
      if (validation.foundMatchups !== validation.requestedRosters) {
        console.warn(`⚠️ Matchup data mismatch: requested ${validation.requestedRosters}, found ${validation.foundMatchups}`);
      }

      if (validation.matchupsWithPlayerPoints === 0) {
        console.warn(`⚠️ No player-level points data found for any requested rosters`);
      }

      return teamData;
    } catch (error) {
      console.error(`❌ Error in enhanced team data fetch:`, error);
      throw error;
    }
  }

  /**
   * Validate data completeness for manual override scenarios
   */
  private validateManualOverrideData(
  data: {
    team1SleeperData?: SleeperMatchup;
    team2SleeperData?: SleeperMatchup;
    team1Roster?: SleeperRoster;
    team2Roster?: SleeperRoster;
  },
  matchupName: string)
  : {isValid: boolean;issues: string[];} {
    const issues: string[] = [];

    // Check if we have basic matchup data
    if (!data.team1SleeperData) {
      issues.push('Missing team 1 matchup data');
    }
    if (!data.team2SleeperData) {
      issues.push('Missing team 2 matchup data');
    }

    // Check if we have roster data
    if (!data.team1Roster) {
      issues.push('Missing team 1 roster data');
    }
    if (!data.team2Roster) {
      issues.push('Missing team 2 roster data');
    }

    // Check for detailed scoring data
    if (data.team1SleeperData && (!data.team1SleeperData.players_points || Object.keys(data.team1SleeperData.players_points).length === 0)) {
      issues.push('Missing team 1 player points data');
    }
    if (data.team2SleeperData && (!data.team2SleeperData.players_points || Object.keys(data.team2SleeperData.players_points).length === 0)) {
      issues.push('Missing team 2 player points data');
    }

    // Check for starting lineup data
    if (data.team1SleeperData && (!data.team1SleeperData.starters || data.team1SleeperData.starters.length === 0)) {
      issues.push('Missing team 1 starters data');
    }
    if (data.team2SleeperData && (!data.team2SleeperData.starters || data.team2SleeperData.starters.length === 0)) {
      issues.push('Missing team 2 starters data');
    }

    const isValid = issues.length === 0;

    if (!isValid) {
      console.warn(`📊 Data validation for ${matchupName}:`, {
        isValid,
        issues,
        dataAvailable: {
          team1Matchup: !!data.team1SleeperData,
          team2Matchup: !!data.team2SleeperData,
          team1Roster: !!data.team1Roster,
          team2Roster: !!data.team2Roster
        }
      });
    }

    return { isValid, issues };
  }

  /**
   * Ensure valid players_points data with fallback
   */
  private ensureValidPlayersPoints(playersPoints?: Record<string, number>): Record<string, number> {
    if (!playersPoints || typeof playersPoints !== 'object') {
      console.warn(`⚠️ Invalid players_points data, using empty object`);
      return {};
    }
    return playersPoints;
  }

  /**
   * Ensure valid starters_points data with fallback
   */
  private ensureValidStartersPoints(startersPoints?: number[]): number[] {
    if (!Array.isArray(startersPoints)) {
      console.warn(`⚠️ Invalid starters_points data, using empty array`);
      return [];
    }
    return startersPoints;
  }

  /**
   * Ensure valid matchup_starters data with fallback to roster starters
   */
  private ensureValidMatchupStarters(matchupStarters?: string[], rosterStarters?: string[]): string[] {
    // Prefer matchup starters (actual lineup for this specific week)
    if (Array.isArray(matchupStarters) && matchupStarters.length > 0) {
      return matchupStarters;
    }

    // Fallback to roster starters (general roster lineup)
    if (Array.isArray(rosterStarters) && rosterStarters.length > 0) {
      console.warn(`⚠️ Using roster starters as fallback for matchup starters`);
      return rosterStarters;
    }

    // Last resort: empty array
    console.warn(`⚠️ No valid starters data available, using empty array`);
    return [];
  }

  /**
   * Determine matchup status based on week and scoring data
   */
  private determineMatchupStatus(
  week: number,
  currentWeek: number,
  selectedSeason: number,
  teams: any[])
  : 'live' | 'completed' | 'upcoming' {
    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = selectedSeason < currentYear;

    if (isHistoricalSeason) {
      return 'completed';
    }

    if (week > currentWeek) {
      return 'upcoming';
    }

    const hasPoints = teams.some((team) => (team.points ?? 0) > 0);

    if (week < currentWeek) {
      return 'completed';
    }

    return hasPoints ? 'live' : 'upcoming';
  }
}

export default new MatchupService();