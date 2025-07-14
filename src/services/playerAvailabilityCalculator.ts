
import PlayerDataService, { PlayerAvailability, PlayerData } from './playerDataService';

export interface AvailabilityFilter {
  positions?: string[];
  nflTeams?: string[];
  injuryStatus?: string[];
  minAge?: number;
  maxAge?: number;
  minExperience?: number;
  maxExperience?: number;
}

export interface AvailabilityStats {
  totalPlayers: number;
  availablePlayers: number;
  ownedPlayers: number;
  byPosition: Record<string, {
    total: number;
    available: number;
    owned: number;
  }>;
  byTeam: Record<string, {
    total: number;
    available: number;
    owned: number;
  }>;
  waiversCount: number;
  freeAgentsCount: number;
}

export interface TeamAvailability {
  teamId: number;
  teamName: string;
  conferenceId: number;
  conferenceName: string;
  rosterCount: number;
  maxRosterSize: number;
  rosterSpots: {
    available: number;
    bench: number;
    ir: number;
    taxi: number;
  };
}

export interface ConflictingOwnership {
  playerId: number;
  playerName: string;
  conflictingTeams: Array<{
    teamId: number;
    teamName: string;
    conferenceId: number;
    conferenceName: string;
    lastUpdated: string;
  }>;
}

/**
 * PlayerAvailabilityCalculator for real-time availability status computation
 * Handles multi-conference ownership conflicts and availability caching
 */
export class PlayerAvailabilityCalculator {
  private static instance: PlayerAvailabilityCalculator;
  private playerService: PlayerDataService;
  private cache = new Map<string, any>();
  private readonly CACHE_TTL = 60000; // 1 minute

  // Table IDs
  private readonly TABLE_IDS = {
    PLAYERS: 12870,
    TEAM_ROSTERS: 27886,
    PLAYER_AVAILABILITY_CACHE: 27937,
    TEAMS: 12852,
    CONFERENCES: 12820,
    MULTI_TEAM_OWNERSHIP_VIEW: 27941,
    AVAILABLE_PLAYERS_VIEW: 27940
  };

  private constructor() {
    this.playerService = PlayerDataService.getInstance();
  }

  public static getInstance(): PlayerAvailabilityCalculator {
    if (!PlayerAvailabilityCalculator.instance) {
      PlayerAvailabilityCalculator.instance = new PlayerAvailabilityCalculator();
    }
    return PlayerAvailabilityCalculator.instance;
  }

  /**
   * Calculate real-time availability for a specific player
   */
  async calculatePlayerAvailability(
  playerId: number,
  seasonId: number,
  week: number,
  refreshCache = false)
  : Promise<PlayerAvailability> {
    const cacheKey = `availability_${playerId}_${seasonId}_${week}`;

    if (!refreshCache) {
      const cached = this.getCachedData<PlayerAvailability>(cacheKey);
      if (cached) return cached;
    }

    try {
      // Check if player is currently owned by any team
      const { data: rosterData, error: rosterError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.TEAM_ROSTERS, {
        PageNo: 1,
        PageSize: 10,
        Filters: [
        { name: 'player_id', op: 'Equal', value: playerId },
        { name: 'season_id', op: 'Equal', value: seasonId },
        { name: 'week', op: 'LessThanOrEqual', value: week },
        { name: 'is_current', op: 'Equal', value: true }],

        OrderByField: 'week',
        IsAsc: false
      });

      if (rosterError) throw new Error(rosterError);

      const currentRoster = rosterData?.List?.[0];
      let isAvailable = !currentRoster;
      let ownedByTeamId = currentRoster?.team_id || null;
      let ownedByConferenceId = null;
      let rosterStatus: 'active' | 'bench' | 'ir' | 'taxi' | 'waiver' | 'free_agent' = 'free_agent';

      if (currentRoster) {
        rosterStatus = currentRoster.roster_status;
        isAvailable = false;

        // Get conference information for the owning team
        const { data: teamData, error: teamError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.TEAMS, {
          PageNo: 1,
          PageSize: 1,
          Filters: [
          { name: 'id', op: 'Equal', value: currentRoster.team_id }]

        });

        if (!teamError && teamData?.List?.[0]) {






























          // You might need to adjust this based on your team-conference relationship structure
          // For now, assuming there's a conference_id field or junction table
        }} // Check waiver status if applicable
      let waiverPriority = 0;if (rosterStatus === 'waiver') {




        // Calculate waiver priority based on team standings or waiver order
        // This would require additional logic based on your waiver system
      } // Get last transaction date
      const { data: historyData, error: historyError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYER_ROSTER_HISTORY, { PageNo: 1, PageSize: 1, Filters: [{ name: 'player_id', op: 'Equal', value: playerId }, { name: 'season_id', op: 'Equal', value: seasonId }], OrderByField: 'transaction_date', IsAsc: false });const lastTransactionDate = historyData?.List?.[0]?.transaction_date || null;const availability: PlayerAvailability = { player_id: playerId, season_id: seasonId, week: week, is_available: isAvailable, owned_by_team_id: ownedByTeamId, owned_by_conference_id: ownedByConferenceId, roster_status: rosterStatus, waiver_priority: waiverPriority, last_transaction_date: lastTransactionDate, cache_updated_at: new Date().toISOString() }; // Cache the result
      this.setCachedData(cacheKey, availability); // Update database cache
      await this.updateAvailabilityCache(availability);

      return availability;
    } catch (error) {
      console.error(`Error calculating availability for player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Get availability statistics for a season/week
   */
  async getAvailabilityStats(
  seasonId: number,
  week: number,
  filter?: AvailabilityFilter)
  : Promise<AvailabilityStats> {
    const cacheKey = `stats_${seasonId}_${week}_${JSON.stringify(filter)}`;
    const cached = this.getCachedData<AvailabilityStats>(cacheKey);
    if (cached) return cached;

    try {
      // Build filters for player query
      const playerFilters = [
      { name: 'is_current_data', op: 'Equal', value: true },
      { name: 'status', op: 'Equal', value: 'Active' }];

      if (filter?.positions?.length) {
        playerFilters.push({ name: 'position', op: 'Equal', value: filter.positions[0] }); // Simplified
      }
      if (filter?.nflTeams?.length) {
        playerFilters.push({ name: 'nfl_team', op: 'Equal', value: filter.nflTeams[0] }); // Simplified
      }
      if (filter?.injuryStatus?.length) {
        playerFilters.push({ name: 'injury_status', op: 'Equal', value: filter.injuryStatus[0] }); // Simplified
      }
      if (filter?.minAge) {
        playerFilters.push({ name: 'age', op: 'GreaterThanOrEqual', value: filter.minAge });
      }
      if (filter?.maxAge) {
        playerFilters.push({ name: 'age', op: 'LessThanOrEqual', value: filter.maxAge });
      }

      // Get all players matching filter
      const { data: playersData, error: playersError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYERS, {
        PageNo: 1,
        PageSize: 10000,
        Filters: playerFilters
      });

      if (playersError) throw new Error(playersError);

      const players = playersData?.List || [];

      // Filter to only include relevant positions
      const validPositions = ['QB', 'RB', 'WR', 'TE'];
      const filteredPlayers = players.filter((player) =>
      validPositions.includes(player.position)
      );

      // Get availability data for all players
      const availabilityPromises = filteredPlayers.map((player) =>
      this.calculatePlayerAvailability(player.id, seasonId, week)
      );

      const availabilityData = await Promise.all(availabilityPromises);

      // Calculate statistics
      const stats: AvailabilityStats = {
        totalPlayers: filteredPlayers.length,
        availablePlayers: availabilityData.filter((a) => a.is_available).length,
        ownedPlayers: availabilityData.filter((a) => !a.is_available).length,
        byPosition: {},
        byTeam: {},
        waiversCount: availabilityData.filter((a) => a.roster_status === 'waiver').length,
        freeAgentsCount: availabilityData.filter((a) => a.roster_status === 'free_agent').length
      };

      // Group by position
      filteredPlayers.forEach((player, index) => {
        const position = player.position;
        const availability = availabilityData[index];

        if (!stats.byPosition[position]) {
          stats.byPosition[position] = { total: 0, available: 0, owned: 0 };
        }

        stats.byPosition[position].total++;
        if (availability.is_available) {
          stats.byPosition[position].available++;
        } else {
          stats.byPosition[position].owned++;
        }
      });

      // Group by NFL team
      filteredPlayers.forEach((player, index) => {
        const nflTeam = player.nfl_team;
        const availability = availabilityData[index];

        if (!stats.byTeam[nflTeam]) {
          stats.byTeam[nflTeam] = { total: 0, available: 0, owned: 0 };
        }

        stats.byTeam[nflTeam].total++;
        if (availability.is_available) {
          stats.byTeam[nflTeam].available++;
        } else {
          stats.byTeam[nflTeam].owned++;
        }
      });

      this.setCachedData(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Error calculating availability stats:', error);
      throw error;
    }
  }

  /**
   * Find players with conflicting ownership across conferences
   */
  async findConflictingOwnership(seasonId: number, week: number): Promise<ConflictingOwnership[]> {
    const cacheKey = `conflicts_${seasonId}_${week}`;
    const cached = this.getCachedData<ConflictingOwnership[]>(cacheKey);
    if (cached) return cached;

    try {
      // Query multi-team ownership view
      const { data: conflictsData, error: conflictsError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.MULTI_TEAM_OWNERSHIP_VIEW, {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
        { name: 'season_id', op: 'Equal', value: seasonId },
        { name: 'week', op: 'Equal', value: week },
        { name: 'ownership_count', op: 'GreaterThan', value: 1 }]

      });

      if (conflictsError) throw new Error(conflictsError);

      const conflicts = conflictsData?.List || [];

      const result: ConflictingOwnership[] = conflicts.map((conflict) => ({
        playerId: conflict.player_id,
        playerName: conflict.player_name,
        conflictingTeams: JSON.parse(conflict.teams_json || '[]')
      }));

      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error finding conflicting ownership:', error);
      throw error;
    }
  }

  /**
   * Get team roster availability summary
   */
  async getTeamAvailability(teamId: number, seasonId: number, week: number): Promise<TeamAvailability> {
    const cacheKey = `team_availability_${teamId}_${seasonId}_${week}`;
    const cached = this.getCachedData<TeamAvailability>(cacheKey);
    if (cached) return cached;

    try {
      // Get team information
      const { data: teamData, error: teamError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.TEAMS, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'id', op: 'Equal', value: teamId }]

      });

      if (teamError) throw new Error(teamError);
      const team = teamData?.List?.[0];
      if (!team) throw new Error(`Team ${teamId} not found`);

      // Get current roster
      const currentRoster = await this.playerService.getTeamCurrentRoster(teamId, seasonId);

      // Count roster spots by status
      const rosterSpots = {
        available: 22 - currentRoster.length, // Assuming 22 max roster size
        bench: currentRoster.filter((p) => p.roster_status === 'bench').length,
        ir: currentRoster.filter((p) => p.roster_status === 'ir').length,
        taxi: currentRoster.filter((p) => p.roster_status === 'taxi').length
      };

      const availability: TeamAvailability = {
        teamId: teamId,
        teamName: team.team_name,
        conferenceId: 0, // You'll need to implement team-conference mapping
        conferenceName: '', // You'll need to implement team-conference mapping
        rosterCount: currentRoster.length,
        maxRosterSize: 22,
        rosterSpots
      };

      this.setCachedData(cacheKey, availability);
      return availability;
    } catch (error) {
      console.error(`Error getting team availability for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk refresh availability cache for multiple players
   */
  async bulkRefreshAvailability(
  playerIds: number[],
  seasonId: number,
  week: number)
  : Promise<{success: number;failed: number;errors: string[];}> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const batchSize = 10;
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batch = playerIds.slice(i, i + batchSize);

      const promises = batch.map(async (playerId) => {
        try {
          await this.calculatePlayerAvailability(playerId, seasonId, week, true);
          success++;
        } catch (error) {
          failed++;
          errors.push(`Player ${playerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await Promise.all(promises);

      // Small delay between batches
      if (i + batchSize < playerIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return { success, failed, errors };
  }

  /**
   * Update availability cache in database
   */
  private async updateAvailabilityCache(availability: PlayerAvailability): Promise<void> {
    try {
      // Check if cache entry exists
      const { data: existingData, error: queryError } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYER_AVAILABILITY_CACHE, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'player_id', op: 'Equal', value: availability.player_id },
        { name: 'season_id', op: 'Equal', value: availability.season_id },
        { name: 'week', op: 'Equal', value: availability.week }]

      });

      if (queryError) throw new Error(queryError);

      const existing = existingData?.List?.[0];

      if (existing) {
        // Update existing entry
        const { error } = await window.ezsite.apis.tableUpdate(this.TABLE_IDS.PLAYER_AVAILABILITY_CACHE, {
          ID: existing.id,
          ...availability
        });
        if (error) throw new Error(error);
      } else {
        // Create new entry
        const { error } = await window.ezsite.apis.tableCreate(this.TABLE_IDS.PLAYER_AVAILABILITY_CACHE, availability);
        if (error) throw new Error(error);
      }
    } catch (error) {
      console.error('Error updating availability cache:', error);
      // Don't throw here to avoid breaking the main calculation flow
    }
  }

  /**
   * Get cached data with TTL check
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data with timestamp
   */
  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Player availability cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {size: number;keys: string[];} {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default PlayerAvailabilityCalculator;