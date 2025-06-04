import { useMemo, useCallback } from 'react';
import { usePlayerRosterCache, usePlayerRosterStatus, useBatchPlayerRosterStatus } from './usePlayerRosterCache';
import { TeamAssociation } from '@/services/playerRosterService';
import { useApp } from '@/contexts/AppContext';

export interface PlayerStatusData {
  playerId: string;
  isRostered: boolean;
  teams: TeamAssociation[];
  primaryTeam?: TeamAssociation;
  isMultiTeam: boolean;
  lastUpdated: Date;
  isStale: boolean;
  freshness: 'live' | 'recent' | 'cached';
  // Legacy fields for backward compatibility
  teamName?: string;
  rosterPosition?: string;
}

export interface UsePlayerStatusOptions {
  enableAutoRefresh?: boolean;
  staleTolerance?: number; // minutes
  overrideConferences?: Conference[]; // Optional override for conferences
}

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
}

// Utility function to convert AppContext conference format to service format
const mapAppConferencesToServiceFormat = (appConferences: import('@/contexts/AppContext').Conference[]): Conference[] => {
  return appConferences.map(conf => ({
    id: parseInt(conf.id) || 0, // Convert string id to number, fallback to 0
    conference_name: conf.name,
    league_id: conf.leagueId
  }));
};

// Utility function to get conferences based on user selection
const getActiveConferences = (
  currentSeasonConfig: import('@/contexts/AppContext').SeasonConfig,
  selectedConference: string | null
): Conference[] => {
  try {
    if (!currentSeasonConfig || !currentSeasonConfig.conferences) {
      console.warn('⚠️ No current season config or conferences available');
      return [];
    }

    // If no specific conference selected, return all conferences
    if (!selectedConference) {
      return mapAppConferencesToServiceFormat(currentSeasonConfig.conferences);
    }

    // Find the specific conference
    const selectedConf = currentSeasonConfig.conferences.find(conf => conf.id === selectedConference);
    if (!selectedConf) {
      console.warn(`⚠️ Selected conference '${selectedConference}' not found, falling back to all conferences`);
      return mapAppConferencesToServiceFormat(currentSeasonConfig.conferences);
    }

    return mapAppConferencesToServiceFormat([selectedConf]);
  } catch (error) {
    console.error('❌ Error getting active conferences:', error);
    return [];
  }
};

export const usePlayerStatus = (
playerId: string,
options: UsePlayerStatusOptions = {}) =>
{
  const {
    enableAutoRefresh = true,
    staleTolerance = 5,
    overrideConferences
  } = options;

  // Get conference context
  const { currentSeasonConfig, selectedConference } = useApp();

  // Determine which conferences to use
  const conferences = useMemo(() => {
    try {
      if (overrideConferences) {
        console.log('🔄 Using override conferences for player status');
        return overrideConferences;
      }

      const activeConferences = getActiveConferences(currentSeasonConfig, selectedConference);
      console.log('🔄 Using active conferences from context:', {
        total: activeConferences.length,
        selectedConference,
        season: currentSeasonConfig.year
      });

      return activeConferences;
    } catch (error) {
      console.error('❌ Error determining conferences for player status:', error);
      return [];
    }
  }, [currentSeasonConfig, selectedConference, overrideConferences]);

  // Use existing player roster cache functionality
  const rosterStatus = usePlayerRosterStatus(playerId, conferences);
  const { data: allRosterData, isLoading, isError, refetch } = usePlayerRosterCache(conferences);

  // Calculate data freshness and process multi-team data
  const statusData = useMemo<PlayerStatusData | null>(() => {
    try {
      if (!rosterStatus || conferences.length === 0) {
        console.warn(`⚠️ No roster status available for player ${playerId}`, {
          hasRosterStatus: !!rosterStatus,
          conferenceCount: conferences.length
        });
        return null;
      }

      const now = new Date();
      const lastUpdated = rosterStatus.lastUpdated ? new Date(rosterStatus.lastUpdated) : now;
      const ageInMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));

      let freshness: 'live' | 'recent' | 'cached' = 'live';
      if (ageInMinutes > 5) freshness = 'cached';
      else if (ageInMinutes > 2) freshness = 'recent';

      const teams = rosterStatus.teams || [];
      const primaryTeam = teams[0]; // Use first team as primary
      const isMultiTeam = teams.length > 1;

      const result = {
        playerId,
        isRostered: rosterStatus.isRostered,
        teams,
        primaryTeam,
        isMultiTeam,
        lastUpdated,
        isStale: ageInMinutes > staleTolerance,
        freshness,
        // Legacy compatibility
        teamName: primaryTeam?.team.team_name,
        rosterPosition: undefined // This would need to come from additional data
      };

      console.log(`📄 Player status processed for ${playerId}:`, {
        isRostered: result.isRostered,
        teamCount: teams.length,
        freshness: result.freshness,
        isStale: result.isStale
      });

      return result;
    } catch (error) {
      console.error(`❌ Error processing player status for ${playerId}:`, error);
      return null;
    }
  }, [rosterStatus, playerId, staleTolerance, conferences.length]);

  // Optimized refresh function with enhanced error handling
  const refreshStatus = useCallback(async () => {
    try {
      if (conferences.length === 0) {
        console.warn('⚠️ Cannot refresh player status: no conferences available');
        return;
      }
      
      console.log(`🔄 Refreshing player status for ${playerId}`);
      await refetch();
      console.log(`✅ Player status refreshed successfully for ${playerId}`);
    } catch (error) {
      console.error(`❌ Failed to refresh player status for ${playerId}:`, error);
      throw error; // Re-throw for caller to handle
    }
  }, [refetch, playerId, conferences.length]);

  // Auto-refresh logic for stale data
  const shouldAutoRefresh = useMemo(() => {
    return enableAutoRefresh && statusData?.isStale;
  }, [enableAutoRefresh, statusData?.isStale]);

  // Enhanced return object with additional context
  return {
    data: statusData,
    isLoading: isLoading || conferences.length === 0,
    isError: isError || (conferences.length === 0 && !overrideConferences),
    refreshStatus,
    shouldAutoRefresh,
    isStale: statusData?.isStale || false,
    freshness: statusData?.freshness || 'cached',
    // Additional context for debugging
    context: {
      conferenceCount: conferences.length,
      selectedConference,
      season: currentSeasonConfig.year,
      usingOverride: !!overrideConferences
    }
  };
};

// Hook for batch player status queries with multi-team support
export const useBatchPlayerStatus = (
playerIds: string[],
optionsOrConferences?: UsePlayerStatusOptions | Conference[]) =>
{
  // Support legacy usage with conferences array as second parameter
  const isLegacyUsage = Array.isArray(optionsOrConferences);
  const options = isLegacyUsage ? {} : (optionsOrConferences || {});
  const legacyConferences = isLegacyUsage ? optionsOrConferences as Conference[] : undefined;

  // Get conference context
  const { currentSeasonConfig, selectedConference } = useApp();

  // Determine which conferences to use
  const conferences = useMemo(() => {
    try {
      if (legacyConferences) {
        console.log('🔄 Using legacy conferences for batch player status');
        return legacyConferences;
      }

      if (options.overrideConferences) {
        console.log('🔄 Using override conferences for batch player status');
        return options.overrideConferences;
      }

      const activeConferences = getActiveConferences(currentSeasonConfig, selectedConference);
      console.log('🔄 Using active conferences from context for batch:', {
        total: activeConferences.length,
        playerCount: playerIds.length,
        selectedConference,
        season: currentSeasonConfig.year
      });

      return activeConferences;
    } catch (error) {
      console.error('❌ Error determining conferences for batch player status:', error);
      return [];
    }
  }, [currentSeasonConfig, selectedConference, options.overrideConferences, legacyConferences, playerIds.length]);
  const {
    data: batchData,
    isLoading,
    isError,
    freeAgents,
    rosteredPlayers,
    multiTeamPlayers,
    teamDistribution
  } = useBatchPlayerRosterStatus(playerIds, conferences);

  const combinedData = useMemo(() => {
    try {
      if (conferences.length === 0) {
        console.warn('⚠️ No conferences available for batch player status');
        return [];
      }

      const results = playerIds.map((playerId) => {
        try {
          const rosterStatus = batchData[playerId];
          if (!rosterStatus) {
            console.debug(`🔍 No roster status found for player ${playerId}`);
            return null;
          }

          const now = new Date();
          const lastUpdated = rosterStatus.lastUpdated ? new Date(rosterStatus.lastUpdated) : now;
          const ageInMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));

          let freshness: 'live' | 'recent' | 'cached' = 'live';
          if (ageInMinutes > 5) freshness = 'cached';
          else if (ageInMinutes > 2) freshness = 'recent';

          const teams = rosterStatus.teams || [];
          const primaryTeam = teams[0];
          const isMultiTeam = teams.length > 1;

          return {
            playerId,
            isRostered: rosterStatus.isRostered,
            teams,
            primaryTeam,
            isMultiTeam,
            lastUpdated,
            isStale: ageInMinutes > 5,
            freshness,
            teamName: primaryTeam?.team.team_name,
            rosterPosition: undefined
          } as PlayerStatusData;
        } catch (error) {
          console.error(`❌ Error processing player ${playerId} in batch:`, error);
          return null;
        }
      }).filter(Boolean);

      console.log(`📄 Batch player status processed:`, {
        requested: playerIds.length,
        processed: results.length,
        conferenceCount: conferences.length
      });

      return results;
    } catch (error) {
      console.error('❌ Error in batch player status processing:', error);
      return [];
    }
  }, [batchData, playerIds, conferences.length]);

  const { refetch } = usePlayerRosterCache(conferences);

  const refreshAll = useCallback(async () => {
    try {
      if (conferences.length === 0) {
        console.warn('⚠️ Cannot refresh batch player status: no conferences available');
        return;
      }
      
      console.log(`🔄 Refreshing batch player status for ${playerIds.length} players`);
      await refetch();
      console.log('✅ Batch player status refreshed successfully');
    } catch (error) {
      console.error('❌ Failed to refresh batch player status:', error);
      throw error; // Re-throw for caller to handle
    }
  }, [refetch, playerIds.length, conferences.length]);

  return {
    data: combinedData,
    isLoading: isLoading || conferences.length === 0,
    hasError: isError || (conferences.length === 0 && !legacyConferences && !options.overrideConferences),
    refreshAll,
    freeAgents,
    rosteredPlayers,
    multiTeamPlayers,
    teamDistribution,
    // Additional context for debugging
    context: {
      conferenceCount: conferences.length,
      playerCount: playerIds.length,
      selectedConference,
      season: currentSeasonConfig.year,
      usingLegacy: !!legacyConferences,
      usingOverride: !!options.overrideConferences
    }
  };
};

// Performance monitoring hook with real metrics
export const usePlayerStatusMetrics = (optionsOrConferences?: UsePlayerStatusOptions | Conference[]) => {
  // Support legacy usage with conferences array as parameter
  const isLegacyUsage = Array.isArray(optionsOrConferences);
  const options = isLegacyUsage ? {} : (optionsOrConferences || {});
  const legacyConferences = isLegacyUsage ? optionsOrConferences as Conference[] : undefined;

  // Get conference context
  const { currentSeasonConfig, selectedConference } = useApp();

  // Determine which conferences to use
  const conferences = useMemo(() => {
    try {
      if (legacyConferences) {
        console.log('🔄 Using legacy conferences for player status metrics');
        return legacyConferences;
      }

      if (options.overrideConferences) {
        console.log('🔄 Using override conferences for player status metrics');
        return options.overrideConferences;
      }

      const activeConferences = getActiveConferences(currentSeasonConfig, selectedConference);
      console.log('🔄 Using active conferences from context for metrics:', {
        total: activeConferences.length,
        selectedConference,
        season: currentSeasonConfig.year
      });

      return activeConferences;
    } catch (error) {
      console.error('❌ Error determining conferences for player status metrics:', error);
      return [];
    }
  }, [currentSeasonConfig, selectedConference, options.overrideConferences, legacyConferences]);

  const { metrics } = usePlayerRosterCache(conferences);

  return useMemo(() => {
    try {
      const hitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100;

      const result = {
        cacheHitRate: isNaN(hitRate) ? 0 : hitRate / 100,
        averageResponseTime: metrics.averageResponseTime,
        totalQueries: metrics.apiCalls,
        cacheSize: metrics.cacheSize,
        lastUpdated: metrics.lastUpdated ? new Date(metrics.lastUpdated) : new Date(),
        detailed: metrics,
        // Additional context
        context: {
          conferenceCount: conferences.length,
          selectedConference,
          season: currentSeasonConfig.year,
          usingLegacy: !!legacyConferences,
          usingOverride: !!options.overrideConferences
        }
      };

      console.log('📊 Player status metrics:', {
        hitRate: `${(result.cacheHitRate * 100).toFixed(1)}%`,
        avgResponseTime: `${result.averageResponseTime}ms`,
        cacheSize: result.cacheSize,
        conferenceCount: conferences.length
      });

      return result;
    } catch (error) {
      console.error('❌ Error calculating player status metrics:', error);
      return {
        cacheHitRate: 0,
        averageResponseTime: 0,
        totalQueries: 0,
        cacheSize: 0,
        lastUpdated: new Date(),
        detailed: metrics,
        context: {
          conferenceCount: 0,
          selectedConference: null,
          season: 0,
          usingLegacy: false,
          usingOverride: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }, [metrics, conferences.length, selectedConference, currentSeasonConfig.year, legacyConferences, options.overrideConferences]);
};

// Utility hook for easy conference status checking
export const useConferenceStatus = () => {
  const { currentSeasonConfig, selectedConference } = useApp();
  
  return useMemo(() => {
    try {
      const activeConferences = getActiveConferences(currentSeasonConfig, selectedConference);
      
      return {
        hasActiveConferences: activeConferences.length > 0,
        conferenceCount: activeConferences.length,
        selectedConference,
        isAllConferences: !selectedConference,
        season: currentSeasonConfig.year,
        conferences: activeConferences,
        isReady: activeConferences.length > 0 && currentSeasonConfig.year > 0
      };
    } catch (error) {
      console.error('❌ Error checking conference status:', error);
      return {
        hasActiveConferences: false,
        conferenceCount: 0,
        selectedConference: null,
        isAllConferences: true,
        season: 0,
        conferences: [],
        isReady: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [currentSeasonConfig, selectedConference]);
};

// Export utility functions for use in other components
export { mapAppConferencesToServiceFormat, getActiveConferences };