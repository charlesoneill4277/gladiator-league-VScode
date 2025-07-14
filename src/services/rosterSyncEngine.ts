
import { SleeperApiService, SleeperRoster, SleeperPlayer } from './sleeperApi';
import PlayerDataService, { BatchOperation, SyncResult, ConflictResolution } from './playerDataService';

export interface SyncProgress {
  stage: string;
  progress: number;
  total: number;
  currentItem?: string;
  errors?: string[];
}

export interface SyncConfiguration {
  conferences: Array<{
    id: number;
    leagueId: string;
    name: string;
  }>;
  seasonId: number;
  week: number;
  conflictResolution: ConflictResolution;
  batchSize: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface RosterSyncState {
  isRunning: boolean;
  progress: SyncProgress;
  lastSync: Date | null;
  nextSync: Date | null;
  errors: string[];
}

/**
 * RosterSyncEngine for automated data synchronization from Sleeper API
 * Handles background sync, conflict resolution, and retry mechanisms
 */
export class RosterSyncEngine {
  private static instance: RosterSyncEngine;
  private playerService: PlayerDataService;
  private syncState: RosterSyncState;
  private syncTimer: NodeJS.Timeout | null = null;
  private progressCallbacks: Array<(progress: SyncProgress) => void> = [];

  // Table IDs
  private readonly TABLE_IDS = {
    SYNC_STATUS: 27938,
    TEAM_ROSTERS: 27886,
    PLAYER_AVAILABILITY_CACHE: 27937,
    PLAYER_ROSTER_HISTORY: 27936,
    TEAMS: 12852,
    CONFERENCES: 12820,
    PLAYERS: 12870
  };

  private constructor() {
    this.playerService = PlayerDataService.getInstance();
    this.syncState = {
      isRunning: false,
      progress: { stage: 'idle', progress: 0, total: 0 },
      lastSync: null,
      nextSync: null,
      errors: []
    };
  }

  public static getInstance(): RosterSyncEngine {
    if (!RosterSyncEngine.instance) {
      RosterSyncEngine.instance = new RosterSyncEngine();
    }
    return RosterSyncEngine.instance;
  }

  /**
   * Subscribe to sync progress updates
   */
  onProgress(callback: (progress: SyncProgress) => void): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit progress update to all subscribers
   */
  private emitProgress(progress: SyncProgress): void {
    this.syncState.progress = progress;
    this.progressCallbacks.forEach((callback) => callback(progress));
  }

  /**
   * Record sync status in database
   */
  private async recordSyncStatus(
  syncType: string,
  conferenceId: number,
  seasonId: number,
  week: number,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  result?: SyncResult)
  : Promise<void> {
    try {
      const syncData = {
        sync_type: syncType,
        conference_id: conferenceId,
        season_id: seasonId,
        week: week,
        sync_status: status,
        last_sync_started: status === 'in_progress' ? new Date().toISOString() : undefined,
        last_sync_completed: status === 'completed' ? new Date().toISOString() : undefined,
        sync_duration_seconds: result?.duration ? Math.floor(result.duration / 1000) : 0,
        records_processed: result?.recordsProcessed || 0,
        errors_encountered: result?.errors?.length || 0,
        error_message: result?.errors?.join('; ') || '',
        sleeper_api_calls: result?.apiCalls || 0,
        next_sync_due: this.calculateNextSyncTime().toISOString()
      };

      const { error } = await window.ezsite.apis.tableCreate(this.TABLE_IDS.SYNC_STATUS, syncData);
      if (error) {
        console.error('Failed to record sync status:', error);
      }
    } catch (error) {
      console.error('Error recording sync status:', error);
    }
  }

  /**
   * Calculate next sync time based on current time and sync frequency
   */
  private calculateNextSyncTime(): Date {
    const now = new Date();
    return new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
  }

  /**
   * Retry mechanism with exponential backoff
   */
  private async retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000)
  : Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt === maxAttempts) {
          throw lastError;
        }

        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms:`, error);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  /**
   * Sync players data from Sleeper API
   */
  private async syncPlayersData(): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    const errors: string[] = [];
    let apiCalls = 0;

    this.emitProgress({
      stage: 'Syncing Player Data',
      progress: 0,
      total: 1,
      currentItem: 'Fetching all NFL players...'
    });

    try {
      // Fetch all players from Sleeper API
      const allSleeperPlayers = await this.retryOperation(async () => {
        apiCalls++;
        return await SleeperApiService.fetchAllPlayers();
      });

      const playerIds = Object.keys(allSleeperPlayers);
      const totalPlayers = playerIds.length;

      this.emitProgress({
        stage: 'Syncing Player Data',
        progress: 0,
        total: totalPlayers,
        currentItem: `Processing ${totalPlayers} players...`
      });

      // Process players in batches
      const batchSize = 50;
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);

        const batchOperations = await Promise.all(
          batch.map(async (playerId) => {
            try {
              const sleeperPlayer = allSleeperPlayers[playerId];
              await this.playerService.syncPlayerFromSleeper(playerId, sleeperPlayer);
              recordsProcessed++;
              return null;
            } catch (error) {
              errors.push(`Failed to sync player ${playerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              return null;
            }
          })
        );

        this.emitProgress({
          stage: 'Syncing Player Data',
          progress: Math.min(i + batchSize, totalPlayers),
          total: totalPlayers,
          currentItem: `Processed ${Math.min(i + batchSize, totalPlayers)} of ${totalPlayers} players`
        });

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const duration = Date.now() - startTime;
      return {
        success: errors.length === 0,
        recordsProcessed,
        errors,
        duration,
        apiCalls
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        recordsProcessed,
        errors,
        duration,
        apiCalls
      };
    }
  }

  /**
   * Sync roster data for a specific conference
   */
  private async syncConferenceRosters(
  conferenceId: number,
  leagueId: string,
  seasonId: number,
  week: number)
  : Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    const errors: string[] = [];
    let apiCalls = 0;

    try {
      this.emitProgress({
        stage: `Syncing Conference ${conferenceId}`,
        progress: 0,
        total: 1,
        currentItem: 'Fetching roster data...'
      });

      // Fetch rosters from Sleeper API
      const rosters = await this.retryOperation(async () => {
        apiCalls++;
        return await SleeperApiService.fetchLeagueRosters(leagueId);
      });

      this.emitProgress({
        stage: `Syncing Conference ${conferenceId}`,
        progress: 0,
        total: rosters.length,
        currentItem: `Processing ${rosters.length} team rosters...`
      });

      // Get teams mapping for this conference
      const { data: teamsData, error: teamsError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.TEAMS, {
        PageNo: 1,
        PageSize: 100,
        Filters: []
      });

      if (teamsError) throw new Error(teamsError);
      const teams = teamsData?.List || [];

      // Process each roster
      for (let i = 0; i < rosters.length; i++) {
        const roster = rosters[i];

        try {
          // Find corresponding team
          const team = teams.find((t) =>
          // You might need to adjust this mapping logic based on your data structure
          t.owner_id === roster.owner_id
          );

          if (!team) {
            errors.push(`No team found for roster ${roster.roster_id} with owner ${roster.owner_id}`);
            continue;
          }

          // Clear current roster for this team and week
          const { error: clearError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.TEAM_ROSTERS, {
            PageNo: 1,
            PageSize: 1000,
            Filters: [
            { name: 'team_id', op: 'Equal', value: team.id },
            { name: 'season_id', op: 'Equal', value: seasonId },
            { name: 'week', op: 'Equal', value: week }]

          });

          // Mark previous roster entries as not current
          if (!clearError) {
            // Update existing entries to not current
            const updateOperations: BatchOperation<any>[] = [];
            // Implementation for marking old roster entries as not current
          }

          // Add new roster entries
          const rosterOperations: BatchOperation<any>[] = [];

          for (const sleeperPlayerId of roster.players) {
            const player = await this.playerService.getPlayerBySleeperID(sleeperPlayerId);
            if (!player) {
              errors.push(`Player not found: ${sleeperPlayerId}`);
              continue;
            }

            const isStarter = roster.starters.includes(sleeperPlayerId);
            const isIR = roster.reserve.includes(sleeperPlayerId);

            let rosterStatus: 'active' | 'bench' | 'ir' | 'taxi' = 'bench';
            if (isStarter) rosterStatus = 'active';else
            if (isIR) rosterStatus = 'ir';

            rosterOperations.push({
              type: 'create',
              tableId: this.TABLE_IDS.TEAM_ROSTERS,
              data: {
                team_id: team.id,
                player_id: player.id,
                season_id: seasonId,
                week: week,
                current_week: week,
                is_current: true,
                added_date: new Date().toISOString(),
                roster_status: rosterStatus,
                last_updated: new Date().toISOString()
              }
            });
          }

          // Execute roster operations
          if (rosterOperations.length > 0) {
            await this.playerService.batchUpdatePlayers(rosterOperations);
            recordsProcessed += rosterOperations.length;
          }

          this.emitProgress({
            stage: `Syncing Conference ${conferenceId}`,
            progress: i + 1,
            total: rosters.length,
            currentItem: `Processed team ${i + 1} of ${rosters.length}`
          });

        } catch (error) {
          errors.push(`Failed to sync roster ${roster.roster_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const duration = Date.now() - startTime;
      return {
        success: errors.length === 0,
        recordsProcessed,
        errors,
        duration,
        apiCalls
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        recordsProcessed,
        errors,
        duration,
        apiCalls
      };
    }
  }

  /**
   * Full synchronization process
   */
  async fullSync(config: SyncConfiguration): Promise<SyncResult> {
    if (this.syncState.isRunning) {
      throw new Error('Sync already in progress');
    }

    this.syncState.isRunning = true;
    this.syncState.errors = [];

    const overallStartTime = Date.now();
    let totalRecordsProcessed = 0;
    const allErrors: string[] = [];
    let totalApiCalls = 0;

    try {
      // Stage 1: Sync players data
      const playersResult = await this.syncPlayersData();
      totalRecordsProcessed += playersResult.recordsProcessed;
      allErrors.push(...playersResult.errors);
      totalApiCalls += playersResult.apiCalls;

      // Record players sync status
      await this.recordSyncStatus('players', 0, config.seasonId, config.week,
      playersResult.success ? 'completed' : 'failed', playersResult);

      // Stage 2: Sync rosters for each conference
      for (let i = 0; i < config.conferences.length; i++) {
        const conference = config.conferences[i];

        const rosterResult = await this.syncConferenceRosters(
          conference.id,
          conference.leagueId,
          config.seasonId,
          config.week
        );

        totalRecordsProcessed += rosterResult.recordsProcessed;
        allErrors.push(...rosterResult.errors);
        totalApiCalls += rosterResult.apiCalls;

        // Record conference sync status
        await this.recordSyncStatus('rosters', conference.id, config.seasonId, config.week,
        rosterResult.success ? 'completed' : 'failed', rosterResult);
      }

      const duration = Date.now() - overallStartTime;
      this.syncState.lastSync = new Date();
      this.syncState.nextSync = this.calculateNextSyncTime();

      const result: SyncResult = {
        success: allErrors.length === 0,
        recordsProcessed: totalRecordsProcessed,
        errors: allErrors,
        duration,
        apiCalls: totalApiCalls
      };

      this.emitProgress({
        stage: 'Sync Complete',
        progress: 1,
        total: 1,
        currentItem: `Processed ${totalRecordsProcessed} records with ${allErrors.length} errors`,
        errors: allErrors
      });

      return result;
    } catch (error) {
      const duration = Date.now() - overallStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      allErrors.push(errorMessage);

      this.emitProgress({
        stage: 'Sync Failed',
        progress: 0,
        total: 1,
        currentItem: errorMessage,
        errors: allErrors
      });

      return {
        success: false,
        recordsProcessed: totalRecordsProcessed,
        errors: allErrors,
        duration,
        apiCalls: totalApiCalls
      };
    } finally {
      this.syncState.isRunning = false;
      this.syncState.errors = allErrors;
    }
  }

  /**
   * Start automated sync with specified interval
   */
  startAutomaticSync(config: SyncConfiguration, intervalMs: number = 30 * 60 * 1000): void {
    this.stopAutomaticSync();

    const runSync = async () => {
      try {
        await this.fullSync(config);
      } catch (error) {
        console.error('Automated sync failed:', error);
        this.syncState.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Run initial sync
    runSync();

    // Schedule recurring sync
    this.syncTimer = setInterval(runSync, intervalMs);
    console.log(`Automatic sync started with ${intervalMs / 1000}s interval`);
  }

  /**
   * Stop automated sync
   */
  stopAutomaticSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('Automatic sync stopped');
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): RosterSyncState {
    return { ...this.syncState };
  }

  /**
   * Force stop current sync (if running)
   */
  forceStop(): void {
    this.syncState.isRunning = false;
    this.emitProgress({
      stage: 'Stopped',
      progress: 0,
      total: 0,
      currentItem: 'Sync forcibly stopped'
    });
  }
}

export default RosterSyncEngine;