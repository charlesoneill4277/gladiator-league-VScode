import { toast } from '@/hooks/use-toast';

export interface DataIntegrityReport {
  duplicate_records: number;
  orphaned_records: number;
  invalid_relationships: number;
  missing_junction_records: number;
  total_team_records: number;
  seasons_affected: number[];
  conferences_affected: number[];
  cleanup_recommendations: string[];
}

export interface CleanupResult {
  records_deleted: number;
  records_updated: number;
  records_created: number;
  errors: string[];
  success: boolean;
}

class DataIntegrityService {
  private readonly TEAM_RECORDS_TABLE_ID = 13768;
  private readonly TEAMS_TABLE_ID = 12852;
  private readonly CONFERENCES_TABLE_ID = 12820;
  private readonly SEASONS_TABLE_ID = 12818;
  private readonly TEAM_CONFERENCES_JUNCTION_TABLE_ID = 12853;

  /**
   * Perform a comprehensive data integrity audit
   */
  async auditDataIntegrity(): Promise<DataIntegrityReport> {
    try {
      const report: DataIntegrityReport = {
        duplicate_records: 0,
        orphaned_records: 0,
        invalid_relationships: 0,
        missing_junction_records: 0,
        total_team_records: 0,
        seasons_affected: [],
        conferences_affected: [],
        cleanup_recommendations: []
      };

      // Get all team records
      const { data: teamRecordsData, error: teamRecordsError } = await window.ezsite.apis.tablePage(
        this.TEAM_RECORDS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (teamRecordsError) throw teamRecordsError;
      const teamRecords = teamRecordsData.List || [];
      report.total_team_records = teamRecords.length;

      // Get all teams
      const { data: teamsData, error: teamsError } = await window.ezsite.apis.tablePage(
        this.TEAMS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (teamsError) throw teamsError;
      const teams = teamsData.List || [];
      const teamIds = new Set(teams.map(t => t.id));

      // Get all conferences
      const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage(
        this.CONFERENCES_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (conferencesError) throw conferencesError;
      const conferences = conferencesData.List || [];
      const conferenceIds = new Set(conferences.map(c => c.id));

      // Get all seasons
      const { data: seasonsData, error: seasonsError } = await window.ezsite.apis.tablePage(
        this.SEASONS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (seasonsError) throw seasonsError;
      const seasons = seasonsData.List || [];
      const seasonIds = new Set(seasons.map(s => s.id));

      // Get all team-conference junctions
      const { data: junctionsData, error: junctionsError } = await window.ezsite.apis.tablePage(
        this.TEAM_CONFERENCES_JUNCTION_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (junctionsError) throw junctionsError;
      const junctions = junctionsData.List || [];

      // Build valid team-conference relationships
      const validTeamConferenceRelationships = new Set<string>();
      junctions.forEach(junction => {
        if (junction.is_active) {
          validTeamConferenceRelationships.add(`${junction.team_id}_${junction.conference_id}`);
        }
      });

      // Analyze team records
      const duplicateMap = new Map<string, any[]>();
      const seasonsAffected = new Set<number>();
      const conferencesAffected = new Set<number>();

      teamRecords.forEach(record => {
        const key = `${record.team_id}_${record.conference_id}_${record.season_id}`;
        
        if (!duplicateMap.has(key)) {
          duplicateMap.set(key, []);
        }
        duplicateMap.get(key)!.push(record);

        seasonsAffected.add(record.season_id);
        conferencesAffected.add(record.conference_id);

        // Check for orphaned records (references to non-existent teams/conferences/seasons)
        if (!teamIds.has(record.team_id)) {
          report.orphaned_records++;
        }
        if (!conferenceIds.has(record.conference_id)) {
          report.orphaned_records++;
        }
        if (!seasonIds.has(record.season_id)) {
          report.orphaned_records++;
        }

        // Check for invalid relationships (team not in conference)
        const relationshipKey = `${record.team_id}_${record.conference_id}`;
        if (!validTeamConferenceRelationships.has(relationshipKey)) {
          report.invalid_relationships++;
        }
      });

      // Count duplicates
      duplicateMap.forEach((records, key) => {
        if (records.length > 1) {
          report.duplicate_records += records.length - 1; // All but one are duplicates
        }
      });

      // Check for missing junction records
      const expectedJunctionCount = teams.length * conferences.length;
      const actualJunctionCount = junctions.filter(j => j.is_active).length;
      report.missing_junction_records = Math.max(0, expectedJunctionCount - actualJunctionCount);

      report.seasons_affected = Array.from(seasonsAffected);
      report.conferences_affected = Array.from(conferencesAffected);

      // Generate cleanup recommendations
      if (report.duplicate_records > 0) {
        report.cleanup_recommendations.push(`Remove ${report.duplicate_records} duplicate team records`);
      }
      if (report.orphaned_records > 0) {
        report.cleanup_recommendations.push(`Remove ${report.orphaned_records} orphaned records with invalid references`);
      }
      if (report.invalid_relationships > 0) {
        report.cleanup_recommendations.push(`Fix ${report.invalid_relationships} records with invalid team-conference relationships`);
      }
      if (report.missing_junction_records > 0) {
        report.cleanup_recommendations.push(`Create ${report.missing_junction_records} missing team-conference junction records`);
      }

      // Expected total: 12 teams × 3 conferences × seasons = 36 per season
      const expectedRecordsPerSeason = 36;
      report.seasons_affected.forEach(seasonId => {
        const seasonRecords = teamRecords.filter(r => r.season_id === seasonId);
        const expectedTotal = expectedRecordsPerSeason;
        if (seasonRecords.length !== expectedTotal) {
          report.cleanup_recommendations.push(
            `Season ${seasonId}: Expected ${expectedTotal} records, found ${seasonRecords.length}`
          );
        }
      });

      return report;
    } catch (error) {
      console.error('Error auditing data integrity:', error);
      throw error;
    }
  }

  /**
   * Clean up duplicate and orphaned records
   */
  async cleanupDataIntegrity(): Promise<CleanupResult> {
    const result: CleanupResult = {
      records_deleted: 0,
      records_updated: 0,
      records_created: 0,
      errors: [],
      success: false
    };

    try {
      // Step 1: Get all data needed for cleanup
      const [teamRecords, teams, conferences, seasons, junctions] = await Promise.all([
        this.getAllTeamRecords(),
        this.getAllTeams(),
        this.getAllConferences(),
        this.getAllSeasons(),
        this.getAllJunctions()
      ]);

      const teamIds = new Set(teams.map(t => t.id));
      const conferenceIds = new Set(conferences.map(c => c.id));
      const seasonIds = new Set(seasons.map(s => s.id));

      // Step 2: Remove orphaned records
      for (const record of teamRecords) {
        const hasValidTeam = teamIds.has(record.team_id);
        const hasValidConference = conferenceIds.has(record.conference_id);
        const hasValidSeason = seasonIds.has(record.season_id);

        if (!hasValidTeam || !hasValidConference || !hasValidSeason) {
          try {
            await window.ezsite.apis.tableDelete(this.TEAM_RECORDS_TABLE_ID, { ID: record.id });
            result.records_deleted++;
          } catch (error) {
            result.errors.push(`Failed to delete orphaned record ${record.id}: ${error}`);
          }
        }
      }

      // Step 3: Remove duplicates (keep the most recent record)
      const duplicateMap = new Map<string, any[]>();
      const remainingRecords = teamRecords.filter(record => {
        const hasValidTeam = teamIds.has(record.team_id);
        const hasValidConference = conferenceIds.has(record.conference_id);
        const hasValidSeason = seasonIds.has(record.season_id);
        return hasValidTeam && hasValidConference && hasValidSeason;
      });

      remainingRecords.forEach(record => {
        const key = `${record.team_id}_${record.conference_id}_${record.season_id}`;
        if (!duplicateMap.has(key)) {
          duplicateMap.set(key, []);
        }
        duplicateMap.get(key)!.push(record);
      });

      for (const [key, records] of duplicateMap.entries()) {
        if (records.length > 1) {
          // Sort by last_updated (most recent first) or id (highest first)
          records.sort((a, b) => {
            const aDate = new Date(a.last_updated || 0);
            const bDate = new Date(b.last_updated || 0);
            if (aDate.getTime() !== bDate.getTime()) {
              return bDate.getTime() - aDate.getTime();
            }
            return b.id - a.id;
          });

          // Keep the first (most recent) record, delete the rest
          for (let i = 1; i < records.length; i++) {
            try {
              await window.ezsite.apis.tableDelete(this.TEAM_RECORDS_TABLE_ID, { ID: records[i].id });
              result.records_deleted++;
            } catch (error) {
              result.errors.push(`Failed to delete duplicate record ${records[i].id}: ${error}`);
            }
          }
        }
      }

      // Step 4: Ensure proper team-conference junction records exist
      const validJunctions = junctions.filter(j => j.is_active);
      const existingJunctionKeys = new Set(
        validJunctions.map(j => `${j.team_id}_${j.conference_id}`)
      );

      // Create missing junction records (for now, we'll assume all teams should be in all conferences)
      // In a real scenario, you'd have business logic to determine which teams belong in which conferences
      for (const team of teams) {
        for (const conference of conferences) {
          const key = `${team.id}_${conference.id}`;
          if (!existingJunctionKeys.has(key)) {
            try {
              await window.ezsite.apis.tableCreate(this.TEAM_CONFERENCES_JUNCTION_TABLE_ID, {
                team_id: team.id,
                conference_id: conference.id,
                roster_id: `${team.id}_${conference.id}`, // placeholder
                is_active: true,
                joined_date: new Date().toISOString()
              });
              result.records_created++;
            } catch (error) {
              result.errors.push(`Failed to create junction record for team ${team.id} in conference ${conference.id}: ${error}`);
            }
          }
        }
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(`Cleanup failed: ${error}`);
      result.success = false;
      return result;
    }
  }

  /**
   * Validate and fix season-conference relationships
   */
  async validateSeasonConferenceRelationships(): Promise<CleanupResult> {
    const result: CleanupResult = {
      records_deleted: 0,
      records_updated: 0,
      records_created: 0,
      errors: [],
      success: false
    };

    try {
      // Get all conferences and ensure they have proper season relationships
      const [conferences, seasons] = await Promise.all([
        this.getAllConferences(),
        this.getAllSeasons()
      ]);

      for (const conference of conferences) {
        // Check if conference has a valid season_id
        const hasValidSeason = seasons.some(s => s.id === conference.season_id);
        
        if (!hasValidSeason) {
          // Try to find the current season or default to the first available season
          const currentSeason = seasons.find(s => s.is_current_season) || seasons[0];
          
          if (currentSeason) {
            try {
              await window.ezsite.apis.tableUpdate(this.CONFERENCES_TABLE_ID, {
                ID: conference.id,
                season_id: currentSeason.id
              });
              result.records_updated++;
            } catch (error) {
              result.errors.push(`Failed to update conference ${conference.id} season relationship: ${error}`);
            }
          }
        }
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(`Season-conference validation failed: ${error}`);
      result.success = false;
      return result;
    }
  }

  /**
   * Create missing team records for proper season-conference coverage
   */
  async createMissingTeamRecords(): Promise<CleanupResult> {
    const result: CleanupResult = {
      records_deleted: 0,
      records_updated: 0,
      records_created: 0,
      errors: [],
      success: false
    };

    try {
      const [teams, conferences, seasons, junctions] = await Promise.all([
        this.getAllTeams(),
        this.getAllConferences(),
        this.getAllSeasons(),
        this.getAllJunctions()
      ]);

      // Build a map of valid team-conference relationships
      const validRelationships = new Map<number, Set<number>>();
      junctions.forEach(junction => {
        if (junction.is_active) {
          if (!validRelationships.has(junction.team_id)) {
            validRelationships.set(junction.team_id, new Set());
          }
          validRelationships.get(junction.team_id)!.add(junction.conference_id);
        }
      });

      // Get existing team records
      const existingRecords = await this.getAllTeamRecords();
      const existingRecordKeys = new Set(
        existingRecords.map(r => `${r.team_id}_${r.conference_id}_${r.season_id}`)
      );

      // Create missing records for each valid team-conference-season combination
      for (const season of seasons) {
        for (const [teamId, conferenceIds] of validRelationships.entries()) {
          for (const conferenceId of conferenceIds) {
            const key = `${teamId}_${conferenceId}_${season.id}`;
            
            if (!existingRecordKeys.has(key)) {
              try {
                await window.ezsite.apis.tableCreate(this.TEAM_RECORDS_TABLE_ID, {
                  team_id: teamId,
                  conference_id: conferenceId,
                  season_id: season.id,
                  wins: 0,
                  losses: 0,
                  ties: 0,
                  points_for: 0,
                  points_against: 0,
                  win_percentage: 0,
                  conference_rank: 0,
                  overall_rank: 0,
                  playoff_eligible: false,
                  is_conference_champion: false,
                  last_updated: new Date().toISOString()
                });
                result.records_created++;
              } catch (error) {
                result.errors.push(`Failed to create team record for team ${teamId}, conference ${conferenceId}, season ${season.id}: ${error}`);
              }
            }
          }
        }
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(`Failed to create missing team records: ${error}`);
      result.success = false;
      return result;
    }
  }

  // Helper methods
  private async getAllTeamRecords(): Promise<any[]> {
    const { data, error } = await window.ezsite.apis.tablePage(
      this.TEAM_RECORDS_TABLE_ID,
      {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      }
    );
    if (error) throw error;
    return data.List || [];
  }

  private async getAllTeams(): Promise<any[]> {
    const { data, error } = await window.ezsite.apis.tablePage(
      this.TEAMS_TABLE_ID,
      {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      }
    );
    if (error) throw error;
    return data.List || [];
  }

  private async getAllConferences(): Promise<any[]> {
    const { data, error } = await window.ezsite.apis.tablePage(
      this.CONFERENCES_TABLE_ID,
      {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      }
    );
    if (error) throw error;
    return data.List || [];
  }

  private async getAllSeasons(): Promise<any[]> {
    const { data, error } = await window.ezsite.apis.tablePage(
      this.SEASONS_TABLE_ID,
      {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      }
    );
    if (error) throw error;
    return data.List || [];
  }

  private async getAllJunctions(): Promise<any[]> {
    const { data, error } = await window.ezsite.apis.tablePage(
      this.TEAM_CONFERENCES_JUNCTION_TABLE_ID,
      {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      }
    );
    if (error) throw error;
    return data.List || [];
  }
}

export const dataIntegrityService = new DataIntegrityService();
