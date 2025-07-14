
import { SleeperApiService, SleeperPlayer } from './sleeperApi';

// Types for player data management
export interface PlayerData {
  id: number;
  sleeper_player_id: string;
  player_name: string;
  position: string;
  nfl_team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
  age: number;
  height: string;
  weight: number;
  years_experience: number;
  depth_chart_position: number;
  college: string;
  is_current_data: boolean;
  last_updated: string;
  created_at: string;
  data_version: number;
}

export interface PlayerAvailability {
  player_id: number;
  season_id: number;
  week: number;
  is_available: boolean;
  owned_by_team_id: number | null;
  owned_by_conference_id: number | null;
  roster_status: 'active' | 'bench' | 'ir' | 'taxi' | 'waiver' | 'free_agent';
  waiver_priority: number;
  last_transaction_date: string | null;
  cache_updated_at: string;
}

export interface PlayerRoster {
  team_id: number;
  player_id: number;
  season_id: number;
  week: number;
  current_week: number;
  is_current: boolean;
  added_date: string;
  removed_date: string | null;
  roster_status: 'active' | 'bench' | 'ir' | 'taxi';
  last_updated: string;
}

export interface BatchOperation<T> {
  type: 'create' | 'update' | 'delete';
  tableId: number;
  data: T;
  id?: number;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  duration: number;
  apiCalls: number;
}

export interface ConflictResolution {
  strategy: 'latest_wins' | 'api_priority' | 'manual_review';
  resolveConflict: (local: any, remote: any) => any;
}

/**
 * Centralized PlayerDataService for all player-related operations
 * Handles CRUD operations, caching, and data synchronization
 */
export class PlayerDataService {
  private static instance: PlayerDataService;
  private cache = new Map<string, any>();
  private rateLimiter = new Map<string, number>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 60;

  // Table IDs - should match your database configuration
  private readonly TABLE_IDS = {
    PLAYERS: 12870,
    TEAM_ROSTERS: 27886,
    PLAYER_AVAILABILITY_CACHE: 27937,
    PLAYER_ROSTER_HISTORY: 27936,
    SYNC_STATUS: 27938,
    CURRENT_ROSTERS_VIEW: 27939,
    AVAILABLE_PLAYERS_VIEW: 27940
  };

  private constructor() {}

  public static getInstance(): PlayerDataService {
    if (!PlayerDataService.instance) {
      PlayerDataService.instance = new PlayerDataService();
    }
    return PlayerDataService.instance;
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / this.RATE_LIMIT_WINDOW) * this.RATE_LIMIT_WINDOW;
    const key = `${endpoint}_${windowStart}`;
    
    const currentCount = this.rateLimiter.get(key) || 0;
    if (currentCount >= this.MAX_REQUESTS_PER_WINDOW) {
      console.warn(`Rate limit exceeded for ${endpoint}`);
      return false;
    }
    
    this.rateLimiter.set(key, currentCount + 1);
    return true;
  }

  /**
   * Get cached data with TTL
   */
  private getCachedData<T>(key: string, ttlMs: number = 300000): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set cached data
   */
  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Fetch all players with caching
   */
  async getAllPlayers(forceRefresh = false): Promise<PlayerData[]> {
    const cacheKey = 'all_players';
    
    if (!forceRefresh) {
      const cached = this.getCachedData<PlayerData[]>(cacheKey, 600000); // 10 min cache
      if (cached) return cached;
    }

    try {
      const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYERS, {
        PageNo: 1,
        PageSize: 10000,
        OrderByField: 'player_name',
        IsAsc: true,
        Filters: [
          { name: 'is_current_data', op: 'Equal', value: true }
        ]
      });

      if (error) throw new Error(error);

      const players = data?.List || [];
      this.setCachedData(cacheKey, players);
      return players;
    } catch (error) {
      console.error('Error fetching all players:', error);
      throw error;
    }
  }

  /**
   * Get player by Sleeper ID
   */
  async getPlayerBySleeperID(sleeperPlayerId: string): Promise<PlayerData | null> {
    const cacheKey = `player_sleeper_${sleeperPlayerId}`;
    const cached = this.getCachedData<PlayerData>(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYERS, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
          { name: 'sleeper_player_id', op: 'Equal', value: sleeperPlayerId },
          { name: 'is_current_data', op: 'Equal', value: true }
        ]
      });

      if (error) throw new Error(error);

      const player = data?.List?.[0] || null;
      if (player) {
        this.setCachedData(cacheKey, player);
      }
      return player;
    } catch (error) {
      console.error(`Error fetching player by Sleeper ID ${sleeperPlayerId}:`, error);
      throw error;
    }
  }

  /**
   * Update or create player from Sleeper API data
   */
  async syncPlayerFromSleeper(sleeperPlayerId: string, sleeperPlayer: SleeperPlayer): Promise<PlayerData> {
    try {
      const existingPlayer = await this.getPlayerBySleeperID(sleeperPlayerId);
      
      const playerData = {
        sleeper_player_id: sleeperPlayerId,
        player_name: SleeperApiService.getPlayerName(sleeperPlayer),
        position: sleeperPlayer.position || 'UNK',
        nfl_team: sleeperPlayer.team || 'FA',
        jersey_number: sleeperPlayer.jersey_number || 0,
        status: sleeperPlayer.status || 'Active',
        injury_status: sleeperPlayer.injury_status || 'Healthy',
        age: sleeperPlayer.age || 0,
        height: sleeperPlayer.height || '',
        weight: sleeperPlayer.weight || 0,
        years_experience: sleeperPlayer.years_exp || 0,
        depth_chart_position: 1,
        college: sleeperPlayer.college || '',
        is_current_data: true,
        last_updated: new Date().toISOString(),
        data_version: (existingPlayer?.data_version || 0) + 1
      };

      if (existingPlayer) {
        const { error } = await window.ezsite.apis.tableUpdate(this.TABLE_IDS.PLAYERS, {
          ID: existingPlayer.id,
          ...playerData
        });
        if (error) throw new Error(error);
        
        const updatedPlayer = { ...existingPlayer, ...playerData };
        this.setCachedData(`player_sleeper_${sleeperPlayerId}`, updatedPlayer);
        return updatedPlayer;
      } else {
        const { error } = await window.ezsite.apis.tableCreate(this.TABLE_IDS.PLAYERS, {
          ...playerData,
          created_at: new Date().toISOString()
        });
        if (error) throw new Error(error);
        
        // Fetch the newly created player to get the ID
        const newPlayer = await this.getPlayerBySleeperID(sleeperPlayerId);
        if (!newPlayer) throw new Error('Failed to create player');
        
        return newPlayer;
      }
    } catch (error) {
      console.error(`Error syncing player ${sleeperPlayerId}:`, error);
      throw error;
    }
  }

  /**
   * Get current roster for a team
   */
  async getTeamCurrentRoster(teamId: number, seasonId: number): Promise<PlayerRoster[]> {
    const cacheKey = `team_roster_${teamId}_${seasonId}`;
    const cached = this.getCachedData<PlayerRoster[]>(cacheKey, 60000); // 1 min cache
    if (cached) return cached;

    try {
      const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.TEAM_ROSTERS, {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
          { name: 'team_id', op: 'Equal', value: teamId },
          { name: 'season_id', op: 'Equal', value: seasonId },
          { name: 'is_current', op: 'Equal', value: true }
        ]
      });

      if (error) throw new Error(error);

      const roster = data?.List || [];
      this.setCachedData(cacheKey, roster);
      return roster;
    } catch (error) {
      console.error(`Error fetching team roster for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get player availability status
   */
  async getPlayerAvailability(playerId: number, seasonId: number, week: number): Promise<PlayerAvailability | null> {
    const cacheKey = `availability_${playerId}_${seasonId}_${week}`;
    const cached = this.getCachedData<PlayerAvailability>(cacheKey, 30000); // 30 sec cache
    if (cached) return cached;

    try {
      const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYER_AVAILABILITY_CACHE, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
          { name: 'player_id', op: 'Equal', value: playerId },
          { name: 'season_id', op: 'Equal', value: seasonId },
          { name: 'week', op: 'Equal', value: week }
        ]
      });

      if (error) throw new Error(error);

      const availability = data?.List?.[0] || null;
      if (availability) {
        this.setCachedData(cacheKey, availability);
      }
      return availability;
    } catch (error) {
      console.error(`Error fetching player availability for player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Batch update player data
   */
  async batchUpdatePlayers(operations: BatchOperation<any>[]): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    const errors: string[] = [];
    let apiCalls = 0;

    try {
      // Group operations by type and table
      const groupedOps = operations.reduce((acc, op) => {
        const key = `${op.type}_${op.tableId}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(op);
        return acc;
      }, {} as Record<string, BatchOperation<any>[]>);

      // Process each group
      for (const [key, ops] of Object.entries(groupedOps)) {
        for (const op of ops) {
          try {
            apiCalls++;
            
            switch (op.type) {
              case 'create':
                const { error: createError } = await window.ezsite.apis.tableCreate(op.tableId, op.data);
                if (createError) throw new Error(createError);
                break;
                
              case 'update':
                const { error: updateError } = await window.ezsite.apis.tableUpdate(op.tableId, {
                  ID: op.id,
                  ...op.data
                });
                if (updateError) throw new Error(updateError);
                break;
                
              case 'delete':
                const { error: deleteError } = await window.ezsite.apis.tableDelete(op.tableId, { ID: op.id });
                if (deleteError) throw new Error(deleteError);
                break;
            }
            
            recordsProcessed++;
            
            // Add small delay between operations to avoid overwhelming the API
            if (recordsProcessed % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            errors.push(`Operation ${op.type} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
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
      return {
        success: false,
        recordsProcessed,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration,
        apiCalls
      };
    }
  }

  /**
   * Search players with filters
   */
  async searchPlayers(filters: {
    name?: string;
    position?: string;
    team?: string;
    status?: string;
    availability?: 'available' | 'owned';
    seasonId?: number;
    week?: number;
  }): Promise<PlayerData[]> {
    const cacheKey = `search_${JSON.stringify(filters)}`;
    const cached = this.getCachedData<PlayerData[]>(cacheKey, 60000);
    if (cached) return cached;

    try {
      const searchFilters = [
        { name: 'is_current_data', op: 'Equal', value: true }
      ];

      if (filters.name) {
        searchFilters.push({ name: 'player_name', op: 'StringContains', value: filters.name });
      }
      if (filters.position) {
        searchFilters.push({ name: 'position', op: 'Equal', value: filters.position });
      }
      if (filters.team) {
        searchFilters.push({ name: 'nfl_team', op: 'Equal', value: filters.team });
      }
      if (filters.status) {
        searchFilters.push({ name: 'status', op: 'Equal', value: filters.status });
      }

      const { data, error } = await window.ezsite.apis.tablePage(this.TABLE_IDS.PLAYERS, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'player_name',
        IsAsc: true,
        Filters: searchFilters
      });

      if (error) throw new Error(error);

      let players = data?.List || [];

      // If availability filter is specified, cross-reference with availability data
      if (filters.availability && filters.seasonId && filters.week) {
        const availabilityPromises = players.map(player => 
          this.getPlayerAvailability(player.id, filters.seasonId!, filters.week!)
        );
        
        const availabilityData = await Promise.all(availabilityPromises);
        
        players = players.filter((player, index) => {
          const availability = availabilityData[index];
          if (filters.availability === 'available') {
            return availability?.is_available !== false;
          } else {
            return availability?.is_available === false;
          }
        });
      }

      this.setCachedData(cacheKey, players);
      return players;
    } catch (error) {
      console.error('Error searching players:', error);
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Player data cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default PlayerDataService;
