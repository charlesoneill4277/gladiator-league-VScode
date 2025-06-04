interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
}

interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface TeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
}

interface SleeperRoster {
  owner_id: string;
  roster_id: number;
  players: string[];
}

export interface RosterStatusInfo {
  isRostered: boolean;
  team?: Team;
  conference?: Conference;
  rosterId?: string;
  lastUpdated?: number;
}

export interface RosterStatusMap {
  [playerId: string]: RosterStatusInfo;
}

interface RosterCacheEntry {
  data: RosterStatusMap;
  timestamp: number;
  version: string;
  conferences: string[]; // conference league_ids for cache invalidation
}

interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  apiCalls: number;
  lastApiCallTime: number;
  averageResponseTime: number;
}

export class PlayerRosterService {
  private static rosterCache = new Map<string, RosterCacheEntry>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly STALE_TIME = 2 * 60 * 1000; // 2 minutes - serve stale data while revalidating
  private static readonly LOCAL_STORAGE_KEY = 'gladiator-roster-cache';
  private static readonly CACHE_VERSION = '1.2';
  private static backgroundSyncInterval: NodeJS.Timeout | null = null;
  private static abortController: AbortController | null = null;
  private static performanceMetrics: PerformanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    lastApiCallTime: 0,
    averageResponseTime: 0
  };

  /**
   * Initialize the service with localStorage persistence
   */
  static init(): void {
    this.loadFromLocalStorage();
    this.startPerformanceMonitoring();
  }

  /**
   * Load cache from localStorage if available and valid
   */
  private static loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (!stored) return;

      const { data, timestamp, version, conferences }: RosterCacheEntry = JSON.parse(stored);
      
      // Check version compatibility and age
      if (version === this.CACHE_VERSION && Date.now() - timestamp < this.CACHE_DURATION) {
        const cacheKey = conferences.sort().join(',');
        this.rosterCache.set(cacheKey, { data, timestamp, version, conferences });
        console.log('🔄 Loaded roster cache from localStorage', { 
          entries: Object.keys(data).length, 
          age: Date.now() - timestamp 
        });
      } else {
        // Clear outdated cache
        localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load roster cache from localStorage:', error);
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    }
  }

  /**
   * Save cache to localStorage
   */
  private static saveToLocalStorage(cacheEntry: RosterCacheEntry): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn('⚠️ Failed to save roster cache to localStorage:', error);
    }
  }

  /**
   * Generate cache key from conference league IDs
   */
  private static getCacheKey(conferences: Conference[]): string {
    return conferences.map(c => c.league_id).sort().join(',');
  }

  /**
   * Check if cache entry is fresh
   */
  private static isCacheFresh(entry: RosterCacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  }

  /**
   * Check if cache entry is stale (older than stale time but not expired)
   */
  private static isCacheStale(entry: RosterCacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age > this.STALE_TIME && age < this.CACHE_DURATION;
  }

  /**
   * Batch fetch all roster data with intelligent caching
   */
  static async fetchAllRosterData(conferences: Conference[]): Promise<RosterStatusMap> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.getCacheKey(conferences);
      const cachedEntry = this.rosterCache.get(cacheKey);

      // Return fresh cache immediately
      if (cachedEntry && this.isCacheFresh(cachedEntry)) {
        this.performanceMetrics.cacheHits++;
        console.log('✅ Cache hit - returning fresh data', { 
          age: Date.now() - cachedEntry.timestamp,
          entries: Object.keys(cachedEntry.data).length 
        });
        return cachedEntry.data;
      }

      // Return stale cache while fetching fresh data in background
      if (cachedEntry && this.isCacheStale(cachedEntry)) {
        this.performanceMetrics.cacheHits++;
        console.log('🔄 Cache stale - returning stale data and fetching fresh', { 
          age: Date.now() - cachedEntry.timestamp 
        });
        
        // Start background fetch without waiting
        this.fetchFreshRosterData(conferences, cacheKey).catch(error => {
          console.error('❌ Background fetch failed:', error);
        });
        
        return cachedEntry.data;
      }

      // No cache or expired - fetch fresh data
      this.performanceMetrics.cacheMisses++;
      console.log('❌ Cache miss - fetching fresh data');
      return await this.fetchFreshRosterData(conferences, cacheKey);

    } catch (error) {
      console.error('❌ Error in fetchAllRosterData:', error);
      
      // Fallback to any available cache data
      const cacheKey = this.getCacheKey(conferences);
      const cachedEntry = this.rosterCache.get(cacheKey);
      if (cachedEntry) {
        console.log('🔄 Using expired cache as fallback');
        return cachedEntry.data;
      }
      
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime);
    }
  }

  /**
   * Fetch fresh roster data from Sleeper API
   */
  private static async fetchFreshRosterData(conferences: Conference[], cacheKey: string): Promise<RosterStatusMap> {
    console.log('🔄 Fetching fresh roster data for', conferences.length, 'conferences');
    
    // Cancel any existing request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      // Fetch additional data needed for processing
      const [teams, teamConferenceJunctions] = await Promise.all([
        this.fetchTeams(),
        this.fetchTeamConferenceJunctions()
      ]);

      const rosterStatusMap: RosterStatusMap = {};
      this.performanceMetrics.apiCalls += conferences.length;

      // Fetch roster data for all conferences with retry logic
      const rosterPromises = conferences.map(async (conference) => {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await this.delay(Math.min(1000 * Math.pow(2, attempt - 1), 5000)); // Exponential backoff

            const response = await fetch(
              `https://api.sleeper.app/v1/league/${conference.league_id}/rosters`,
              { 
                signal: this.abortController?.signal,
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Gladiator-League-App/1.0'
                }
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const rosters: SleeperRoster[] = await response.json();
            console.log(`✅ Fetched ${rosters.length} rosters for ${conference.conference_name}`);

            // Process each roster
            rosters.forEach((roster) => {
              const junction = teamConferenceJunctions.find(
                (j) => j.conference_id === conference.id && j.roster_id === roster.roster_id.toString()
              );

              if (junction) {
                const team = teams.find((t) => t.id === junction.team_id);
                if (team) {
                  roster.players?.forEach((playerId) => {
                    rosterStatusMap[playerId] = {
                      isRostered: true,
                      team,
                      conference,
                      rosterId: roster.roster_id.toString(),
                      lastUpdated: Date.now()
                    };
                  });
                }
              }
            });

            return; // Success, exit retry loop

          } catch (error) {
            lastError = error as Error;
            console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${conference.conference_name}:`, error);
            
            if (attempt === maxRetries) {
              console.error(`❌ All attempts failed for ${conference.conference_name}:`, lastError);
            }
          }
        }
      });

      await Promise.allSettled(rosterPromises);

      // Cache the results
      const cacheEntry: RosterCacheEntry = {
        data: rosterStatusMap,
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
        conferences: conferences.map(c => c.league_id)
      };

      this.rosterCache.set(cacheKey, cacheEntry);
      this.saveToLocalStorage(cacheEntry);

      console.log('✅ Roster data cached successfully', { 
        entries: Object.keys(rosterStatusMap).length,
        conferences: conferences.length 
      });

      return rosterStatusMap;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🔄 Request aborted');
        throw new Error('Request cancelled');
      }
      throw error;
    }
  }

  /**
   * Get cached roster status with fallback to fresh data
   */
  static async getPlayerRosterStatus(playerId: string, conferences: Conference[]): Promise<RosterStatusInfo> {
    try {
      const allRosterData = await this.fetchAllRosterData(conferences);
      return allRosterData[playerId] || { isRostered: false };
    } catch (error) {
      console.error('❌ Error getting player roster status:', error);
      return { isRostered: false };
    }
  }

  /**
   * Start background sync to keep data fresh
   */
  static startBackgroundSync(conferences: Conference[]): void {
    // Clear existing interval
    this.stopBackgroundSync();

    // Start new interval every 5 minutes
    this.backgroundSyncInterval = setInterval(async () => {
      try {
        console.log('🔄 Background sync - refreshing roster data');
        const cacheKey = this.getCacheKey(conferences);
        await this.fetchFreshRosterData(conferences, cacheKey);
      } catch (error) {
        console.error('❌ Background sync failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    console.log('✅ Background sync started');
  }

  /**
   * Stop background sync
   */
  static stopBackgroundSync(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = null;
      console.log('🔄 Background sync stopped');
    }
  }

  /**
   * Invalidate cache for specific conferences
   */
  static invalidateCache(conferences?: Conference[]): void {
    if (conferences) {
      const cacheKey = this.getCacheKey(conferences);
      this.rosterCache.delete(cacheKey);
      console.log('🔄 Cache invalidated for specific conferences');
    } else {
      this.rosterCache.clear();
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      console.log('🔄 All cache invalidated');
    }
  }

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics(): PerformanceMetrics & { cacheSize: number } {
    return {
      ...this.performanceMetrics,
      cacheSize: this.rosterCache.size
    };
  }

  /**
   * Start performance monitoring
   */
  private static startPerformanceMonitoring(): void {
    // Log performance metrics every 2 minutes
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      const hitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100;
      
      console.log('📊 Roster Service Performance:', {
        cacheHitRate: `${hitRate.toFixed(1)}%`,
        apiCalls: metrics.apiCalls,
        avgResponseTime: `${metrics.averageResponseTime}ms`,
        cacheSize: metrics.cacheSize
      });
    }, 2 * 60 * 1000);
  }

  /**
   * Update performance metrics
   */
  private static updatePerformanceMetrics(responseTime: number): void {
    this.performanceMetrics.lastApiCallTime = Date.now();
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime + responseTime) / 2;
  }

  /**
   * Utility function for delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch teams from database
   */
  private static async fetchTeams(): Promise<Team[]> {
    const response = await window.ezsite.apis.tablePage(12852, {
      PageNo: 1,
      PageSize: 1000,
      OrderByField: 'team_name',
      IsAsc: true,
      Filters: []
    });

    if (response.error) throw new Error(response.error);
    return response.data.List;
  }

  /**
   * Fetch team-conference junctions from database
   */
  private static async fetchTeamConferenceJunctions(): Promise<TeamConferenceJunction[]> {
    const response = await window.ezsite.apis.tablePage(12853, {
      PageNo: 1,
      PageSize: 1000,
      OrderByField: 'id',
      IsAsc: true,
      Filters: [{
        name: 'is_active',
        op: 'Equal',
        value: true
      }]
    });

    if (response.error) throw new Error(response.error);
    return response.data.List;
  }

  /**
   * Clean up resources
   */
  static cleanup(): void {
    this.stopBackgroundSync();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

// Initialize the service
PlayerRosterService.init();