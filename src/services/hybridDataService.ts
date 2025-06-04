/**
 * Hybrid Data Service - Intelligent layer between database and Sleeper API
 * 
 * This service provides:
 * - Team-roster validation pipeline
 * - Intelligent data source routing
 * - Roster ownership verification
 * - Data consistency checks
 * - Manual override handling with validation
 * - Caching and performance optimization
 */

import { SleeperApiService } from './sleeperApi';

// Types and Interfaces
interface TeamAssignment {
  teamId: number;
  conferenceId: number;
  rosterId: string;
  sleeperLeagueId: string;
  isActive: boolean;
  joinedDate: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: DataConflict[];
}

interface DataConflict {
  type: 'ROSTER_MISMATCH' | 'TEAM_ASSIGNMENT' | 'CONFERENCE_CONFLICT' | 'OWNERSHIP_CONFLICT';
  description: string;
  dbValue: any;
  apiValue: any;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedAction: string;
}

interface CachedData {
  data: any;
  timestamp: number;
  ttl: number;
  key: string;
}

interface DataSourcePreference {
  useDatabase: boolean;
  useApi: boolean;
  preferDatabase: boolean;
  requireValidation: boolean;
}

interface TeamRosterMapping {
  teamId: number;
  rosterId: string;
  conferenceId: number;
  sleeperLeagueId: string;
  lastValidated: Date;
  validationStatus: 'VALID' | 'INVALID' | 'PENDING' | 'CONFLICT';
}

interface OverrideRecord {
  id: string;
  type: 'TEAM_ASSIGNMENT' | 'ROSTER_MAPPING' | 'CONFERENCE_ASSIGNMENT';
  originalValue: any;
  overrideValue: any;
  reason: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

/**
 * Singleton Hybrid Data Service
 * Manages intelligent routing between database and Sleeper API data
 */
class HybridDataService {
  private static instance: HybridDataService;
  private cache = new Map&lt;string, CachedData&gt;();
  private validationCache = new Map&lt;string, ValidationResult&gt;();
  private teamRosterMappings = new Map&lt;number, TeamRosterMapping&gt;();
  private overrides = new Map&lt;string, OverrideRecord&gt;();
  private isInitialized = false;
  private mutex = false;

  // Configuration
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly VALIDATION_TTL = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly BATCH_SIZE = 50;

  private constructor() {
    console.log('HybridDataService: Initializing singleton instance');
    this.initializeService();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): HybridDataService {
    if (!HybridDataService.instance) {
      HybridDataService.instance = new HybridDataService();
    }
    return HybridDataService.instance;
  }

  /**
   * Initialize the service with data loading and validation
   */
  private async initializeService(): Promise&lt;void&gt; {
    if (this.isInitialized) return;

    try {
      console.log('HybridDataService: Starting initialization...');
      
      // Load team-conference assignments from database
      await this.loadTeamAssignments();
      
      // Load existing overrides
      await this.loadOverrides();
      
      // Run initial validation
      await this.runInitialValidation();
      
      this.isInitialized = true;
      console.log('HybridDataService: Initialization complete');
      
      // Start periodic consistency checks
      this.startPeriodicChecks();
      
    } catch (error) {
      console.error('HybridDataService: Initialization failed:', error);
      throw new Error(`Failed to initialize HybridDataService: ${error}`);
    }
  }

  /**
   * Ensure service is initialized before operations
   */
  private async ensureInitialized(): Promise&lt;void&gt; {
    while (this.mutex) {
      await new Promise(resolve =&gt; setTimeout(resolve, 10));
    }
    
    if (!this.isInitialized) {
      this.mutex = true;
      try {
        await this.initializeService();
      } finally {
        this.mutex = false;
      }
    }
  }

  /**
   * Load team assignments from database
   */
  private async loadTeamAssignments(): Promise&lt;void&gt; {
    try {
      console.log('HybridDataService: Loading team assignments...');
      
      const { data, error } = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
          { name: 'is_active', op: 'Equal', value: true }
        ]
      });

      if (error) throw new Error(error);

      if (data?.List) {
        data.List.forEach((assignment: any) =&gt; {
          const mapping: TeamRosterMapping = {
            teamId: assignment.team_id,
            rosterId: assignment.roster_id,
            conferenceId: assignment.conference_id,
            sleeperLeagueId: '', // Will be loaded from conferences
            lastValidated: new Date(0),
            validationStatus: 'PENDING'
          };
          
          this.teamRosterMappings.set(assignment.team_id, mapping);
        });
      }

      console.log(`HybridDataService: Loaded ${this.teamRosterMappings.size} team assignments`);
      
    } catch (error) {
      console.error('HybridDataService: Failed to load team assignments:', error);
      throw error;
    }
  }

  /**
   * Load conference information to complete team mappings
   */
  private async loadConferenceInfo(): Promise&lt;void&gt; {
    try {
      const { data, error } = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      });

      if (error) throw new Error(error);

      const conferenceMap = new Map&lt;number, string&gt;();
      if (data?.List) {
        data.List.forEach((conf: any) =&gt; {
          conferenceMap.set(conf.id, conf.league_id);
        });
      }

      // Update team mappings with league IDs
      this.teamRosterMappings.forEach((mapping, teamId) =&gt; {
        const leagueId = conferenceMap.get(mapping.conferenceId);
        if (leagueId) {
          mapping.sleeperLeagueId = leagueId;
        }
      });

    } catch (error) {
      console.error('HybridDataService: Failed to load conference info:', error);
      throw error;
    }
  }

  /**
   * Load existing overrides from storage or database
   */
  private async loadOverrides(): Promise&lt;void&gt; {
    try {
      // For now, overrides could be stored in localStorage or a dedicated table
      // This is a placeholder implementation
      const storedOverrides = localStorage.getItem('hybridDataService_overrides');
      if (storedOverrides) {
        const overrideData = JSON.parse(storedOverrides);
        Object.entries(overrideData).forEach(([key, value]) =&gt; {
          this.overrides.set(key, value as OverrideRecord);
        });
      }
      
      console.log(`HybridDataService: Loaded ${this.overrides.size} overrides`);
      
    } catch (error) {
      console.error('HybridDataService: Failed to load overrides:', error);
    }
  }

  /**
   * Run initial validation of all team-roster assignments
   */
  private async runInitialValidation(): Promise&lt;void&gt; {
    try {
      console.log('HybridDataService: Running initial validation...');
      
      await this.loadConferenceInfo();
      
      const validationPromises: Promise&lt;ValidationResult&gt;[] = [];
      
      this.teamRosterMappings.forEach((mapping, teamId) =&gt; {
        validationPromises.push(this.validateTeamRosterAssignment(teamId));
      });
      
      const results = await Promise.allSettled(validationPromises);
      
      let validCount = 0;
      let invalidCount = 0;
      
      results.forEach((result, index) =&gt; {
        if (result.status === 'fulfilled') {
          if (result.value.isValid) {
            validCount++;
          } else {
            invalidCount++;
            console.warn(`HybridDataService: Validation failed for team ${Array.from(this.teamRosterMappings.keys())[index]}:`, result.value.errors);
          }
        } else {
          invalidCount++;
          console.error(`HybridDataService: Validation error:`, result.reason);
        }
      });
      
      console.log(`HybridDataService: Initial validation complete - ${validCount} valid, ${invalidCount} invalid`);
      
    } catch (error) {
      console.error('HybridDataService: Initial validation failed:', error);
    }
  }

  /**
   * Validate team-roster assignment against Sleeper API
   */
  public async validateTeamRosterAssignment(teamId: number): Promise&lt;ValidationResult&gt; {
    await this.ensureInitialized();
    
    const cacheKey = `validation_${teamId}`;
    const cached = this.validationCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) &lt; this.VALIDATION_TTL) {
      return cached.data;
    }

    try {
      const mapping = this.teamRosterMappings.get(teamId);
      if (!mapping) {
        const result: ValidationResult = {
          isValid: false,
          errors: [`No mapping found for team ${teamId}`],
          warnings: [],
          conflicts: []
        };
        
        this.cacheValidationResult(cacheKey, result);
        return result;
      }

      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        conflicts: []
      };

      // Validate against Sleeper API
      try {
        const leagueUsers = await SleeperApiService.getLeagueUsers(mapping.sleeperLeagueId);
        const leagueRosters = await SleeperApiService.getLeagueRosters(mapping.sleeperLeagueId);
        
        // Check if roster exists in the league
        const rosterExists = leagueRosters.some(roster =&gt; roster.roster_id.toString() === mapping.rosterId);
        if (!rosterExists) {
          result.isValid = false;
          result.errors.push(`Roster ${mapping.rosterId} not found in league ${mapping.sleeperLeagueId}`);
          
          result.conflicts.push({
            type: 'ROSTER_MISMATCH',
            description: `Database references roster ${mapping.rosterId} but it doesn't exist in Sleeper league`,
            dbValue: mapping.rosterId,
            apiValue: null,
            severity: 'HIGH',
            suggestedAction: 'Update database with correct roster ID or remove invalid assignment'
          });
        }

        // Update validation status
        mapping.lastValidated = new Date();
        mapping.validationStatus = result.isValid ? 'VALID' : 'INVALID';
        
      } catch (apiError) {
        result.warnings.push(`Could not validate against Sleeper API: ${apiError}`);
        mapping.validationStatus = 'PENDING';
      }

      this.cacheValidationResult(cacheKey, result);
      return result;
      
    } catch (error) {
      console.error(`HybridDataService: Validation failed for team ${teamId}:`, error);
      
      const result: ValidationResult = {
        isValid: false,
        errors: [`Validation error: ${error}`],
        warnings: [],
        conflicts: []
      };
      
      this.cacheValidationResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Cache validation result
   */
  private cacheValidationResult(key: string, result: ValidationResult): void {
    this.validationCache.set(key, {
      data: result,
      timestamp: Date.now()
    });
    
    // Clean up old validation cache entries
    if (this.validationCache.size &gt; this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.validationCache.keys())[0];
      this.validationCache.delete(oldestKey);
    }
  }

  /**
   * Intelligent data source routing
   */
  public async getTeamData(teamId: number, preferences: DataSourcePreference = {
    useDatabase: true,
    useApi: true,
    preferDatabase: true,
    requireValidation: true
  }): Promise&lt;any&gt; {
    await this.ensureInitialized();
    
    const cacheKey = `team_data_${teamId}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      console.log(`HybridDataService: Returning cached data for team ${teamId}`);
      return cached;
    }

    try {
      let teamData: any = null;
      
      // Check for overrides first
      const override = this.getActiveOverride(`team_${teamId}`);
      if (override) {
        console.log(`HybridDataService: Using override data for team ${teamId}`);
        teamData = override.overrideValue;
      }
      
      // If validation is required, check team assignment validity
      if (preferences.requireValidation) {
        const validation = await this.validateTeamRosterAssignment(teamId);
        if (!validation.isValid && validation.errors.length &gt; 0) {
          throw new Error(`Team ${teamId} failed validation: ${validation.errors.join(', ')}`);
        }
      }
      
      // Try database first if preferred
      if (preferences.preferDatabase &amp;&amp; preferences.useDatabase) {
        teamData = await this.getTeamDataFromDatabase(teamId);
      }
      
      // Fall back to API if database data is not available
      if (!teamData &amp;&amp; preferences.useApi) {
        const mapping = this.teamRosterMappings.get(teamId);
        if (mapping) {
          teamData = await this.getTeamDataFromApi(mapping);
        }
      }
      
      // Try database as fallback if API preferred initially
      if (!teamData &amp;&amp; !preferences.preferDatabase &amp;&amp; preferences.useDatabase) {
        teamData = await this.getTeamDataFromDatabase(teamId);
      }
      
      if (teamData) {
        this.setCachedData(cacheKey, teamData);
      }
      
      return teamData;
      
    } catch (error) {
      console.error(`HybridDataService: Failed to get team data for ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get team data from database
   */
  private async getTeamDataFromDatabase(teamId: number): Promise&lt;any&gt; {
    try {
      const { data, error } = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 1,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
          { name: 'id', op: 'Equal', value: teamId }
        ]
      });

      if (error) throw new Error(error);
      
      return data?.List?.[0] || null;
      
    } catch (error) {
      console.error(`HybridDataService: Failed to get team ${teamId} from database:`, error);
      return null;
    }
  }

  /**
   * Get team data from Sleeper API
   */
  private async getTeamDataFromApi(mapping: TeamRosterMapping): Promise&lt;any&gt; {
    try {
      const [users, rosters] = await Promise.all([
        SleeperApiService.getLeagueUsers(mapping.sleeperLeagueId),
        SleeperApiService.getLeagueRosters(mapping.sleeperLeagueId)
      ]);
      
      const roster = rosters.find(r =&gt; r.roster_id.toString() === mapping.rosterId);
      const user = users.find(u =&gt; u.user_id === roster?.owner_id);
      
      if (!roster || !user) return null;
      
      return {
        team_name: user.display_name || user.username,
        owner_name: user.display_name || user.username,
        owner_id: user.user_id,
        team_logo_url: user.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : '',
        sleeper_roster_id: roster.roster_id,
        // Add additional fields as needed
      };
      
    } catch (error) {
      console.error('HybridDataService: Failed to get team data from API:', error);
      return null;
    }
  }

  /**
   * Create manual override with validation
   */
  public async createOverride(
    type: OverrideRecord['type'],
    targetId: string,
    originalValue: any,
    overrideValue: any,
    reason: string,
    createdBy: string
  ): Promise&lt;string&gt; {
    await this.ensureInitialized();
    
    try {
      // Validate the override won't break team-roster relationships
      const validationResult = await this.validateOverride(type, targetId, overrideValue);
      if (!validationResult.isValid) {
        throw new Error(`Override validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      const overrideId = `${type}_${targetId}_${Date.now()}`;
      const override: OverrideRecord = {
        id: overrideId,
        type,
        originalValue,
        overrideValue,
        reason,
        createdBy,
        createdAt: new Date(),
        isActive: true
      };
      
      this.overrides.set(overrideId, override);
      await this.persistOverrides();
      
      // Invalidate related cache entries
      this.invalidateRelatedCache(targetId);
      
      console.log(`HybridDataService: Created override ${overrideId}`);
      return overrideId;
      
    } catch (error) {
      console.error('HybridDataService: Failed to create override:', error);
      throw error;
    }
  }

  /**
   * Validate override won't break system integrity
   */
  private async validateOverride(
    type: OverrideRecord['type'],
    targetId: string,
    overrideValue: any
  ): Promise&lt;ValidationResult&gt; {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      conflicts: []
    };

    try {
      switch (type) {
        case 'TEAM_ASSIGNMENT':
          // Validate team assignment override
          if (overrideValue.rosterId) {
            const teamId = parseInt(targetId.replace('team_', ''));
            const existingMapping = this.teamRosterMappings.get(teamId);
            
            if (existingMapping) {
              // Check if new roster ID conflicts with existing assignments
              const conflictingTeam = Array.from(this.teamRosterMappings.entries())
                .find(([id, mapping]) =&gt; 
                  id !== teamId &amp;&amp; 
                  mapping.rosterId === overrideValue.rosterId &amp;&amp;
                  mapping.conferenceId === existingMapping.conferenceId
                );
              
              if (conflictingTeam) {
                result.isValid = false;
                result.errors.push(`Roster ${overrideValue.rosterId} is already assigned to team ${conflictingTeam[0]}`);
              }
            }
          }
          break;
          
        case 'ROSTER_MAPPING':
          // Additional roster mapping validation
          break;
          
        case 'CONFERENCE_ASSIGNMENT':
          // Conference assignment validation
          break;
      }
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Override validation error: ${error}`);
    }

    return result;
  }

  /**
   * Get active override for a target
   */
  private getActiveOverride(targetId: string): OverrideRecord | null {
    return Array.from(this.overrides.values())
      .find(override =&gt; 
        override.isActive &amp;&amp; 
        (override.id.includes(targetId) || targetId.includes(override.type.toLowerCase()))
      ) || null;
  }

  /**
   * Run comprehensive data consistency checks
   */
  public async runConsistencyCheck(): Promise&lt;ValidationResult&gt; {
    await this.ensureInitialized();
    
    console.log('HybridDataService: Running comprehensive consistency check...');
    
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      conflicts: []
    };

    try {
      // Check all team assignments
      for (const [teamId, mapping] of this.teamRosterMappings) {
        const validation = await this.validateTeamRosterAssignment(teamId);
        
        if (!validation.isValid) {
          result.isValid = false;
          result.errors.push(...validation.errors);
          result.conflicts.push(...validation.conflicts);
        }
        
        result.warnings.push(...validation.warnings);
      }
      
      // Check for duplicate roster assignments
      const rosterMap = new Map&lt;string, number[]&gt;();
      this.teamRosterMappings.forEach((mapping, teamId) =&gt; {
        const key = `${mapping.conferenceId}_${mapping.rosterId}`;
        if (!rosterMap.has(key)) {
          rosterMap.set(key, []);
        }
        rosterMap.get(key)!.push(teamId);
      });
      
      rosterMap.forEach((teamIds, key) =&gt; {
        if (teamIds.length &gt; 1) {
          result.isValid = false;
          result.errors.push(`Duplicate roster assignment: ${key} assigned to teams ${teamIds.join(', ')}`);
          
          result.conflicts.push({
            type: 'ROSTER_MISMATCH',
            description: `Multiple teams assigned to same roster`,
            dbValue: teamIds,
            apiValue: key,
            severity: 'HIGH',
            suggestedAction: 'Remove duplicate assignments or create override'
          });
        }
      });
      
      console.log(`HybridDataService: Consistency check complete - ${result.isValid ? 'PASSED' : 'FAILED'}`);
      console.log(`HybridDataService: Found ${result.errors.length} errors, ${result.warnings.length} warnings, ${result.conflicts.length} conflicts`);
      
      return result;
      
    } catch (error) {
      console.error('HybridDataService: Consistency check failed:', error);
      result.isValid = false;
      result.errors.push(`Consistency check error: ${error}`);
      return result;
    }
  }

  /**
   * Cache management methods
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached &amp;&amp; (Date.now() - cached.timestamp) &lt; cached.ttl) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    // Clean up cache if it's getting too large
    if (this.cache.size &gt;= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key
    });
  }

  private invalidateRelatedCache(targetId: string): void {
    const keysToDelete: string[] = [];
    
    this.cache.forEach((cached, key) =&gt; {
      if (key.includes(targetId)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key =&gt; this.cache.delete(key));
    
    // Also clear validation cache
    this.validationCache.forEach((cached, key) =&gt; {
      if (key.includes(targetId)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key =&gt; this.validationCache.delete(key));
  }

  /**
   * Persist overrides to storage
   */
  private async persistOverrides(): Promise&lt;void&gt; {
    try {
      const overrideData: {[key: string]: OverrideRecord} = {};
      this.overrides.forEach((override, key) =&gt; {
        overrideData[key] = override;
      });
      
      localStorage.setItem('hybridDataService_overrides', JSON.stringify(overrideData));
      
    } catch (error) {
      console.error('HybridDataService: Failed to persist overrides:', error);
    }
  }

  /**
   * Start periodic consistency checks
   */
  private startPeriodicChecks(): void {
    // Run consistency check every 30 minutes
    setInterval(async () =&gt; {
      try {
        console.log('HybridDataService: Running periodic consistency check...');
        const result = await this.runConsistencyCheck();
        
        if (!result.isValid) {
          console.warn('HybridDataService: Periodic consistency check found issues:', result);
          // Could trigger notifications or alerts here
        }
        
      } catch (error) {
        console.error('HybridDataService: Periodic consistency check failed:', error);
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Get service status and statistics
   */
  public getServiceStatus(): {
    isInitialized: boolean;
    cacheSize: number;
    validationCacheSize: number;
    teamMappingsCount: number;
    overridesCount: number;
    lastConsistencyCheck: Date | null;
  } {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      validationCacheSize: this.validationCache.size,
      teamMappingsCount: this.teamRosterMappings.size,
      overridesCount: this.overrides.size,
      lastConsistencyCheck: null // Could track this
    };
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.cache.clear();
    this.validationCache.clear();
    console.log('HybridDataService: All caches cleared');
  }

  /**
   * Refresh team assignments from database
   */
  public async refreshTeamAssignments(): Promise&lt;void&gt; {
    await this.ensureInitialized();
    
    console.log('HybridDataService: Refreshing team assignments...');
    
    this.teamRosterMappings.clear();
    await this.loadTeamAssignments();
    await this.loadConferenceInfo();
    
    // Clear related caches
    this.clearCaches();
    
    console.log('HybridDataService: Team assignments refreshed');
  }

  /**
   * Export configuration and overrides for backup
   */
  public exportConfiguration(): string {
    const config = {
      teamRosterMappings: Array.from(this.teamRosterMappings.entries()),
      overrides: Array.from(this.overrides.entries()),
      timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(config, null, 2);
  }
}

// Export singleton instance
export const hybridDataService = HybridDataService.getInstance();
export default hybridDataService;

// Export types for use in other components
export type {
  TeamAssignment,
  ValidationResult,
  DataConflict,
  DataSourcePreference,
  TeamRosterMapping,
  OverrideRecord
};