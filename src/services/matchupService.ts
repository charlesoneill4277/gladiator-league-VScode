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
  private debugMode = false;

  /**
   * Enable/disable debug mode for comprehensive data flow tracking
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    matchupDataFlowDebugger.setDebugMode(enabled);
    console.log(`🔧 MatchupService debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Get current debug mode status
   */
  getDebugMode(): boolean {
    return this.debugMode;
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