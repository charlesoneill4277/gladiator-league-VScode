
/**
 * Database Service for handling temporal tracking and optimized queries
 * Supports enhanced database schema with temporal fields and composite indexes
 */

// Database table IDs
export const TABLE_IDS = {
  TEAMS: 12852,
  CONFERENCES: 12820,
  SEASONS: 12818,
  PLAYERS: 12870,
  TEAM_ROSTERS: 27886,
  PLAYER_ROSTER_HISTORY: 27936,
  PLAYER_AVAILABILITY_CACHE: 27937,
  SYNC_STATUS: 27938,
  CURRENT_ROSTERS_VIEW: 27939,
  AVAILABLE_PLAYERS_VIEW: 27940,
  MULTI_TEAM_OWNERSHIP_VIEW: 27941,
  MATCHUPS: 13329,
  TEAM_RECORDS: 13768,
  MATCHUP_OVERRIDES: 27780,
  DRAFT_RESULTS: 27845,
  TEAM_CONFERENCES_JUNCTION: 12853
};

// Type definitions for enhanced database operations
export interface TemporalQuery {
  seasonId: number;
  week?: number;
  isCurrent?: boolean;
  conferenceId?: number;
}

export interface RosterHistoryEntry {
  teamId: number;
  playerId: number;
  seasonId: number;
  week: number;
  actionType: 'add' | 'drop' | 'trade' | 'waiver_claim' | 'free_agent_pickup';
  transactionId?: string;
  fromTeamId?: number;
  toTeamId?: number;
  transactionDate: Date;
  faabCost?: number;
  notes?: string;
}

export interface PlayerAvailabilityCache {
  playerId: number;
  seasonId: number;
  week: number;
  isAvailable: boolean;
  ownedByTeamId?: number;
  ownedByConferenceId?: number;
  rosterStatus: 'active' | 'bench' | 'ir' | 'taxi' | 'waiver' | 'free_agent';
  waiverPriority?: number;
  lastTransactionDate?: Date;
}

export interface SyncStatus {
  syncType: 'rosters' | 'matchups' | 'players' | 'standings' | 'transactions';
  conferenceId: number;
  seasonId: number;
  week: number;
  syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  lastSyncStarted?: Date;
  lastSyncCompleted?: Date;
  syncDurationSeconds?: number;
  recordsProcessed?: number;
  errorsEncountered?: number;
  errorMessage?: string;
  sleeperApiCalls?: number;
  nextSyncDue?: Date;
}

export class DatabaseService {
  /**
   * Query current roster state with temporal optimization
   */
  static async getCurrentRosters(params: {
    seasonId: number;
    week?: number;
    teamId?: number;
    conferenceId?: number;
  }) {
    const filters = [
    { name: 'season_id', op: 'Equal', value: params.seasonId },
    { name: 'is_current', op: 'Equal', value: true }];


    if (params.week) {
      filters.push({ name: 'current_week', op: 'Equal', value: params.week });
    }

    if (params.teamId) {
      filters.push({ name: 'team_id', op: 'Equal', value: params.teamId });
    }

    if (params.conferenceId) {
      filters.push({ name: 'conference_id', op: 'Equal', value: params.conferenceId });
    }

    try {
      const response = await window.ezsite.apis.tablePage(TABLE_IDS.CURRENT_ROSTERS_VIEW, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'team_id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (error) {
      console.error('Error fetching current rosters:', error);
      throw error;
    }
  }

  /**
   * Query available players with optimization cache
   */
  static async getAvailablePlayers(params: {
    seasonId: number;
    week?: number;
    position?: string;
    conferenceId?: number;
    isAvailable?: boolean;
  }) {
    const filters = [
    { name: 'season_id', op: 'Equal', value: params.seasonId }];


    if (params.week) {
      filters.push({ name: 'week', op: 'Equal', value: params.week });
    }

    if (params.position) {
      filters.push({ name: 'position', op: 'Equal', value: params.position });
    }

    if (params.isAvailable !== undefined) {
      filters.push({ name: 'roster_status', op: 'Equal', value: params.isAvailable ? 'free_agent' : 'active' });
    }

    try {
      const response = await window.ezsite.apis.tablePage(TABLE_IDS.AVAILABLE_PLAYERS_VIEW, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'player_name',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (error) {
      console.error('Error fetching available players:', error);
      throw error;
    }
  }

  /**
   * Add roster history entry
   */
  static async addRosterHistoryEntry(entry: RosterHistoryEntry) {
    try {
      const response = await window.ezsite.apis.tableCreate(TABLE_IDS.PLAYER_ROSTER_HISTORY, {
        team_id: entry.teamId,
        player_id: entry.playerId,
        season_id: entry.seasonId,
        week: entry.week,
        action_type: entry.actionType,
        transaction_id: entry.transactionId || '',
        from_team_id: entry.fromTeamId || 0,
        to_team_id: entry.toTeamId || 0,
        transaction_date: entry.transactionDate.toISOString(),
        faab_cost: entry.faabCost || 0,
        notes: entry.notes || '',
        created_at: new Date().toISOString()
      });

      if (response.error) throw new Error(response.error);
      return response;
    } catch (error) {
      console.error('Error adding roster history entry:', error);
      throw error;
    }
  }

  /**
   * Update player availability cache
   */
  static async updatePlayerAvailabilityCache(cache: PlayerAvailabilityCache) {
    try {
      // First, try to find existing cache entry
      const existingResponse = await window.ezsite.apis.tablePage(TABLE_IDS.PLAYER_AVAILABILITY_CACHE, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'player_id', op: 'Equal', value: cache.playerId },
        { name: 'season_id', op: 'Equal', value: cache.seasonId },
        { name: 'week', op: 'Equal', value: cache.week }]

      });

      if (existingResponse.error) throw new Error(existingResponse.error);

      const cacheData = {
        player_id: cache.playerId,
        season_id: cache.seasonId,
        week: cache.week,
        is_available: cache.isAvailable,
        owned_by_team_id: cache.ownedByTeamId || 0,
        owned_by_conference_id: cache.ownedByConferenceId || 0,
        roster_status: cache.rosterStatus,
        waiver_priority: cache.waiverPriority || 0,
        last_transaction_date: cache.lastTransactionDate?.toISOString() || '',
        cache_updated_at: new Date().toISOString()
      };

      let response;
      if (existingResponse.data.List.length > 0) {
        // Update existing entry
        response = await window.ezsite.apis.tableUpdate(TABLE_IDS.PLAYER_AVAILABILITY_CACHE, {
          ID: existingResponse.data.List[0].id,
          ...cacheData
        });
      } else {
        // Create new entry
        response = await window.ezsite.apis.tableCreate(TABLE_IDS.PLAYER_AVAILABILITY_CACHE, cacheData);
      }

      if (response.error) throw new Error(response.error);
      return response;
    } catch (error) {
      console.error('Error updating player availability cache:', error);
      throw error;
    }
  }

  /**
   * Update sync status
   */
  static async updateSyncStatus(syncStatus: SyncStatus) {
    try {
      // First, try to find existing sync status
      const existingResponse = await window.ezsite.apis.tablePage(TABLE_IDS.SYNC_STATUS, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'sync_type', op: 'Equal', value: syncStatus.syncType },
        { name: 'conference_id', op: 'Equal', value: syncStatus.conferenceId },
        { name: 'season_id', op: 'Equal', value: syncStatus.seasonId },
        { name: 'week', op: 'Equal', value: syncStatus.week }]

      });

      if (existingResponse.error) throw new Error(existingResponse.error);

      const statusData = {
        sync_type: syncStatus.syncType,
        conference_id: syncStatus.conferenceId,
        season_id: syncStatus.seasonId,
        week: syncStatus.week,
        sync_status: syncStatus.syncStatus,
        last_sync_started: syncStatus.lastSyncStarted?.toISOString() || '',
        last_sync_completed: syncStatus.lastSyncCompleted?.toISOString() || '',
        sync_duration_seconds: syncStatus.syncDurationSeconds || 0,
        records_processed: syncStatus.recordsProcessed || 0,
        errors_encountered: syncStatus.errorsEncountered || 0,
        error_message: syncStatus.errorMessage || '',
        sleeper_api_calls: syncStatus.sleeperApiCalls || 0,
        next_sync_due: syncStatus.nextSyncDue?.toISOString() || ''
      };

      let response;
      if (existingResponse.data.List.length > 0) {
        // Update existing entry
        response = await window.ezsite.apis.tableUpdate(TABLE_IDS.SYNC_STATUS, {
          ID: existingResponse.data.List[0].id,
          ...statusData
        });
      } else {
        // Create new entry
        response = await window.ezsite.apis.tableCreate(TABLE_IDS.SYNC_STATUS, statusData);
      }

      if (response.error) throw new Error(response.error);
      return response;
    } catch (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }
  }

  /**
   * Get roster history for a player
   */
  static async getPlayerRosterHistory(playerId: number, seasonId?: number) {
    const filters = [
    { name: 'player_id', op: 'Equal', value: playerId }];


    if (seasonId) {
      filters.push({ name: 'season_id', op: 'Equal', value: seasonId });
    }

    try {
      const response = await window.ezsite.apis.tablePage(TABLE_IDS.PLAYER_ROSTER_HISTORY, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'transaction_date',
        IsAsc: false,
        Filters: filters
      });

      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (error) {
      console.error('Error fetching player roster history:', error);
      throw error;
    }
  }

  /**
   * Get multi-team ownership view
   */
  static async getMultiTeamOwnership(params: {
    seasonId: number;
    week?: number;
    minOwnershipCount?: number;
  }) {
    const filters = [
    { name: 'season_id', op: 'Equal', value: params.seasonId }];


    if (params.week) {
      filters.push({ name: 'week', op: 'Equal', value: params.week });
    }

    if (params.minOwnershipCount) {
      filters.push({ name: 'ownership_count', op: 'GreaterThanOrEqual', value: params.minOwnershipCount });
    }

    try {
      const response = await window.ezsite.apis.tablePage(TABLE_IDS.MULTI_TEAM_OWNERSHIP_VIEW, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'ownership_count',
        IsAsc: false,
        Filters: filters
      });

      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (error) {
      console.error('Error fetching multi-team ownership:', error);
      throw error;
    }
  }

  /**
   * Get sync status for monitoring
   */
  static async getSyncStatus(conferenceId?: number, syncType?: string) {
    const filters = [];

    if (conferenceId) {
      filters.push({ name: 'conference_id', op: 'Equal', value: conferenceId });
    }

    if (syncType) {
      filters.push({ name: 'sync_type', op: 'Equal', value: syncType });
    }

    try {
      const response = await window.ezsite.apis.tablePage(TABLE_IDS.SYNC_STATUS, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'last_sync_started',
        IsAsc: false,
        Filters: filters
      });

      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (error) {
      console.error('Error fetching sync status:', error);
      throw error;
    }
  }

  /**
   * Update team roster with temporal tracking
   */
  static async updateTeamRoster(params: {
    teamId: number;
    playerId: number;
    seasonId: number;
    week: number;
    rosterStatus: string;
    isAdd: boolean;
  }) {
    try {
      // First, update the current roster
      const currentRosterData = {
        team_id: params.teamId,
        player_id: params.playerId,
        season_id: params.seasonId,
        week: params.week,
        current_week: params.week,
        is_current: true,
        roster_status: params.rosterStatus,
        added_date: params.isAdd ? new Date().toISOString() : undefined,
        removed_date: !params.isAdd ? new Date().toISOString() : undefined,
        last_updated: new Date().toISOString()
      };

      // Check if roster entry already exists
      const existingRosterResponse = await window.ezsite.apis.tablePage(TABLE_IDS.TEAM_ROSTERS, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'team_id', op: 'Equal', value: params.teamId },
        { name: 'player_id', op: 'Equal', value: params.playerId },
        { name: 'season_id', op: 'Equal', value: params.seasonId },
        { name: 'is_current', op: 'Equal', value: true }]

      });

      if (existingRosterResponse.error) throw new Error(existingRosterResponse.error);

      let rosterResponse;
      if (existingRosterResponse.data.List.length > 0) {
        // Update existing roster entry
        rosterResponse = await window.ezsite.apis.tableUpdate(TABLE_IDS.TEAM_ROSTERS, {
          ID: existingRosterResponse.data.List[0].id,
          ...currentRosterData
        });
      } else {
        // Create new roster entry
        rosterResponse = await window.ezsite.apis.tableCreate(TABLE_IDS.TEAM_ROSTERS, currentRosterData);
      }

      if (rosterResponse.error) throw new Error(rosterResponse.error);

      // Add to roster history
      await this.addRosterHistoryEntry({
        teamId: params.teamId,
        playerId: params.playerId,
        seasonId: params.seasonId,
        week: params.week,
        actionType: params.isAdd ? 'add' : 'drop',
        transactionDate: new Date(),
        notes: `${params.isAdd ? 'Added to' : 'Removed from'} roster`
      });

      return rosterResponse;
    } catch (error) {
      console.error('Error updating team roster:', error);
      throw error;
    }
  }
}

export default DatabaseService;