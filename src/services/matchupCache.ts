// Smart caching service for matchup data
import { SleeperPlayer } from './sleeperApi';
import { DatabaseService } from './databaseService';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface ConferenceSleeperData {
  matchups: any[];
  rosters: any[];
  users: any[];
}

export class MatchupCache {
  private static playerCache: CacheEntry<Record<string, SleeperPlayer>> | null = null;
  private static conferenceCache: Map<string, CacheEntry<ConferenceSleeperData>> = new Map();
  private static matchupDetailsCache: Map<string, CacheEntry<any>> = new Map();
  
  // Cache durations in milliseconds
  private static readonly PLAYER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly CONFERENCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly DETAILS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  /**
   * Get cached players or fetch from database
   */
  static async getPlayers(): Promise<Record<string, SleeperPlayer>> {
    const now = Date.now();
    
    // Check if cache is valid
    if (this.playerCache && (now - this.playerCache.timestamp) < this.playerCache.ttl) {
      console.log(`📋 Using cached player data (${Object.keys(this.playerCache.data).length} players)`);
      // Track cache hit
      if (typeof window !== 'undefined') {
        const current = (window as any).__cacheStats || { hits: 0, total: 0 };
        current.total += 1;
        current.hits += 1;
        (window as any).__cacheStats = current;
        (window as any).__cacheHitRate = current.hits / current.total;
      }
      return this.playerCache.data;
    }

    console.log('🔄 Refreshing player cache...');
    const startTime = performance.now();
    
    // Track cache miss
    if (typeof window !== 'undefined') {
      const current = (window as any).__cacheStats || { hits: 0, total: 0 };
      current.total += 1;
      (window as any).__cacheStats = current;
      (window as any).__cacheHitRate = current.total > 0 ? current.hits / current.total : 0;
    }
    
    try {
      // Use the robust player fetching method
      const allPlayersArray = await DatabaseService.getAllPlayersForMapping([
        { column: 'playing_status', operator: 'eq', value: 'Active' },
        { column: 'position', operator: 'in', value: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] }
      ]);

      // Convert to Sleeper format for compatibility
      const playersRecord: Record<string, SleeperPlayer> = {};
      allPlayersArray.forEach(player => {
        if (player.sleeper_id) {
          const nameParts = player.player_name.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          playersRecord[player.sleeper_id] = {
            player_id: player.sleeper_id,
            first_name: firstName,
            last_name: lastName,
            position: player.position || '',
            team: player.nfl_team || '',
            jersey_number: player.number || 0,
            status: player.playing_status || '',
            injury_status: player.injury_status || '',
            age: player.age || 0,
            height: player.height?.toString() || '',
            weight: player.weight || 0,
            years_exp: 0,
            college: player.college || ''
          };
        }
      });

      // Cache the result
      this.playerCache = {
        data: playersRecord,
        timestamp: now,
        ttl: this.PLAYER_CACHE_TTL
      };

      console.log(`✅ Player cache refreshed with ${Object.keys(playersRecord).length} players in ${(performance.now() - startTime).toFixed(2)}ms`);
      return playersRecord;
      
    } catch (error) {
      console.error('Error fetching players:', error);
      // Return empty object as fallback
      return {};
    }
  }

  /**
   * Get cached conference Sleeper data
   */
  static getCachedConferenceData(leagueId: string, week: number): ConferenceSleeperData | null {
    const key = `${leagueId}_${week}`;
    const cached = this.conferenceCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      console.log(`📋 Using cached Sleeper data for league ${leagueId}, week ${week}`);
      // Track cache hit
      if (typeof window !== 'undefined') {
        const current = (window as any).__cacheStats || { hits: 0, total: 0 };
        current.total += 1;
        current.hits += 1;
        (window as any).__cacheStats = current;
        (window as any).__cacheHitRate = current.hits / current.total;
      }
      return cached.data;
    }
    
    return null;
  }

  /**
   * Cache conference Sleeper data
   */
  static setCachedConferenceData(leagueId: string, week: number, data: ConferenceSleeperData): void {
    const key = `${leagueId}_${week}`;
    this.conferenceCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.CONFERENCE_CACHE_TTL
    });
  }

  /**
   * Get cached matchup details
   */
  static getCachedMatchupDetails(matchupId: number, week: number): any | null {
    const key = `details_${matchupId}_${week}`;
    const cached = this.matchupDetailsCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      console.log(`📋 Using cached details for matchup ${matchupId}`);
      return cached.data;
    }
    
    return null;
  }

  /**
   * Cache matchup details
   */
  static setCachedMatchupDetails(matchupId: number, week: number, data: any): void {
    const key = `details_${matchupId}_${week}`;
    this.matchupDetailsCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.DETAILS_CACHE_TTL
    });
  }

  /**
   * Clear all caches
   */
  static clearAll(): void {
    console.log('🗑️ Clearing all caches');
    this.playerCache = null;
    this.conferenceCache.clear();
    this.matchupDetailsCache.clear();
  }

  /**
   * Clear expired entries
   */
  static cleanupExpired(): void {
    const now = Date.now();
    
    // Clean player cache
    if (this.playerCache && (now - this.playerCache.timestamp) >= this.playerCache.ttl) {
      this.playerCache = null;
    }
    
    // Clean conference cache
    for (const [key, entry] of this.conferenceCache.entries()) {
      if ((now - entry.timestamp) >= entry.ttl) {
        this.conferenceCache.delete(key);
      }
    }
    
    // Clean details cache
    for (const [key, entry] of this.matchupDetailsCache.entries()) {
      if ((now - entry.timestamp) >= entry.ttl) {
        this.matchupDetailsCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    const now = Date.now();
    
    return {
      players: {
        cached: !!this.playerCache,
        count: this.playerCache ? Object.keys(this.playerCache.data).length : 0,
        age: this.playerCache ? now - this.playerCache.timestamp : 0,
        ttl: this.PLAYER_CACHE_TTL
      },
      conferences: {
        count: this.conferenceCache.size,
        entries: Array.from(this.conferenceCache.keys())
      },
      details: {
        count: this.matchupDetailsCache.size,
        entries: Array.from(this.matchupDetailsCache.keys())
      }
    };
  }
}

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  MatchupCache.cleanupExpired();
}, 5 * 60 * 1000);

export default MatchupCache;