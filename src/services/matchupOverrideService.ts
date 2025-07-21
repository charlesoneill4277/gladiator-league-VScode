import { DatabaseService } from './databaseService';
import { DbMatchupAdminOverride, DbTeam, DbConference } from '@/types/database';

export interface MatchupOverrideRequest {
  season_id: number;
  week: number;
  conference_id: number;
  override_team1_id: number;
  override_team2_id: number;
  override_reason?: string;
  admin_notes?: string;
  original_team1_id?: number;
  original_team2_id?: number;
  sleeper_matchup_id?: string;
}

export interface MatchupOverrideWithTeams extends DbMatchupAdminOverride {
  override_team1?: DbTeam;
  override_team2?: DbTeam;
  original_team1?: DbTeam;
  original_team2?: DbTeam;
  conference?: DbConference;
}

export class MatchupOverrideService {
  /**
   * Create a new matchup override
   */
  static async createOverride(request: MatchupOverrideRequest): Promise<DbMatchupAdminOverride | null> {
    try {
      console.log('🔄 Creating matchup override:', request);

      // Deactivate any existing overrides for the same week/conference/teams
      await this.deactivateExistingOverrides(request.season_id, request.week, request.conference_id);

      const override: Partial<DbMatchupAdminOverride> = {
        season_id: request.season_id,
        week: request.week,
        conference_id: request.conference_id,
        override_team1_id: request.override_team1_id,
        override_team2_id: request.override_team2_id,
        override_reason: request.override_reason || 'Manual Admin Override',
        admin_notes: request.admin_notes,
        original_team1_id: request.original_team1_id,
        original_team2_id: request.original_team2_id,
        sleeper_matchup_id: request.sleeper_matchup_id,
        is_active: true,
        overridden_by_admin_id: 'admin', // TODO: Get from auth context
        date_overridden: new Date().toISOString()
      };

      const result = await DatabaseService.createMatchupAdminOverride(override);
      
      if (result.error) {
        throw new Error(result.error);
      }

      console.log('✅ Matchup override created:', result.data);
      return result.data;

    } catch (error) {
      console.error('❌ Error creating matchup override:', error);
      return null;
    }
  }

  /**
   * Get all active overrides for a season/week/conference
   */
  static async getActiveOverrides(
    season_id: number, 
    week?: number, 
    conference_id?: number
  ): Promise<MatchupOverrideWithTeams[]> {
    try {
      console.log('🔍 Getting active overrides:', { season_id, week, conference_id });

      const filters = [
        { column: 'season_id', operator: 'eq' as const, value: season_id },
        { column: 'is_active', operator: 'eq' as const, value: true }
      ];

      if (week !== undefined) {
        filters.push({ column: 'week', operator: 'eq' as const, value: week });
      }

      if (conference_id !== undefined) {
        filters.push({ column: 'conference_id', operator: 'eq' as const, value: conference_id });
      }

      const overridesResult = await DatabaseService.getMatchupAdminOverrides({
        filters,
        orderBy: { column: 'week', ascending: true },
        limit: 100
      });

      if (overridesResult.error) {
        throw new Error(overridesResult.error);
      }

      const overrides = overridesResult.data || [];

      // Enhance with team and conference data
      const teamsResult = await DatabaseService.getTeams({});
      const conferencesResult = await DatabaseService.getConferences({});

      const teams = teamsResult.data || [];
      const conferences = conferencesResult.data || [];

      const enhancedOverrides: MatchupOverrideWithTeams[] = overrides.map(override => ({
        ...override,
        override_team1: teams.find(t => t.id === override.override_team1_id),
        override_team2: teams.find(t => t.id === override.override_team2_id),
        original_team1: override.original_team1_id ? teams.find(t => t.id === override.original_team1_id) : undefined,
        original_team2: override.original_team2_id ? teams.find(t => t.id === override.original_team2_id) : undefined,
        conference: conferences.find(c => c.id === override.conference_id)
      }));

      console.log(`✅ Found ${enhancedOverrides.length} active overrides`);
      return enhancedOverrides;

    } catch (error) {
      console.error('❌ Error getting active overrides:', error);
      return [];
    }
  }

  /**
   * Deactivate an override
   */
  static async deactivateOverride(overrideId: number): Promise<boolean> {
    try {
      console.log('🔄 Deactivating override:', overrideId);

      const result = await DatabaseService.updateMatchupAdminOverride(overrideId, {
        is_active: false,
        updated_at: new Date().toISOString()
      });

      if (result.error) {
        throw new Error(result.error);
      }

      console.log('✅ Override deactivated');
      return true;

    } catch (error) {
      console.error('❌ Error deactivating override:', error);
      return false;
    }
  }

  /**
   * Permanently delete an override
   */
  static async deleteOverride(overrideId: number): Promise<boolean> {
    try {
      console.log('🗑️ Deleting override:', overrideId);

      const result = await DatabaseService.deleteMatchupAdminOverride(overrideId);

      if (result.error) {
        throw new Error(result.error);
      }

      console.log('✅ Override deleted');
      return true;

    } catch (error) {
      console.error('❌ Error deleting override:', error);
      return false;
    }
  }

  /**
   * Deactivate existing overrides for the same matchup context
   */
  private static async deactivateExistingOverrides(
    season_id: number, 
    week: number, 
    conference_id: number
  ): Promise<void> {
    try {
      const existingOverrides = await this.getActiveOverrides(season_id, week, conference_id);
      
      for (const override of existingOverrides) {
        await this.deactivateOverride(override.id);
      }

    } catch (error) {
      console.error('Error deactivating existing overrides:', error);
    }
  }

  /**
   * Get override history for auditing
   */
  static async getOverrideHistory(season_id: number): Promise<MatchupOverrideWithTeams[]> {
    try {
      console.log('📚 Getting override history for season:', season_id);

      const filters = [
        { column: 'season_id', operator: 'eq' as const, value: season_id }
      ];

      const overridesResult = await DatabaseService.getMatchupAdminOverrides({
        filters,
        orderBy: { column: 'date_overridden', ascending: false },
        limit: 200
      });

      if (overridesResult.error) {
        throw new Error(overridesResult.error);
      }

      const overrides = overridesResult.data || [];

      // Enhance with team and conference data
      const teamsResult = await DatabaseService.getTeams({});
      const conferencesResult = await DatabaseService.getConferences({});

      const teams = teamsResult.data || [];
      const conferences = conferencesResult.data || [];

      const enhancedOverrides: MatchupOverrideWithTeams[] = overrides.map(override => ({
        ...override,
        override_team1: teams.find(t => t.id === override.override_team1_id),
        override_team2: teams.find(t => t.id === override.override_team2_id),
        original_team1: override.original_team1_id ? teams.find(t => t.id === override.original_team1_id) : undefined,
        original_team2: override.original_team2_id ? teams.find(t => t.id === override.original_team2_id) : undefined,
        conference: conferences.find(c => c.id === override.conference_id)
      }));

      console.log(`✅ Found ${enhancedOverrides.length} override history records`);
      return enhancedOverrides;

    } catch (error) {
      console.error('❌ Error getting override history:', error);
      return [];
    }
  }
}
