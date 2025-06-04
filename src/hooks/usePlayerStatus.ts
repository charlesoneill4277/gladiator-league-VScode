import { useMemo, useCallback } from 'react';
import { usePlayerRosterCache, usePlayerRosterStatus, useBatchPlayerRosterStatus } from './usePlayerRosterCache';
import { TeamAssociation } from '@/services/playerRosterService';

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
  conferences: { id: number; conference_name: string; league_id: string; }[];
}

export const usePlayerStatus = (
playerId: string,
options: UsePlayerStatusOptions) =>
{
  const {
    enableAutoRefresh = true,
    staleTolerance = 5,
    conferences
  } = options;

  // Use existing player roster cache functionality
  const rosterStatus = usePlayerRosterStatus(playerId, conferences);
  const { data: allRosterData, isLoading, isError, refetch } = usePlayerRosterCache(conferences);

  // Calculate data freshness and process multi-team data
  const statusData = useMemo<PlayerStatusData | null>(() => {
    if (!rosterStatus) return null;

    const now = new Date();
    const lastUpdated = rosterStatus.lastUpdated ? new Date(rosterStatus.lastUpdated) : now;
    const ageInMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));

    let freshness: 'live' | 'recent' | 'cached' = 'live';
    if (ageInMinutes > 5) freshness = 'cached';
    else if (ageInMinutes > 2) freshness = 'recent';

    const teams = rosterStatus.teams || [];
    const primaryTeam = teams[0]; // Use first team as primary
    const isMultiTeam = teams.length > 1;

    return {
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
  }, [rosterStatus, playerId, staleTolerance]);

  // Optimized refresh function
  const refreshStatus = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Failed to refresh player status:', error);
    }
  }, [refetch]);

  // Auto-refresh logic for stale data
  const shouldAutoRefresh = useMemo(() => {
    return enableAutoRefresh && statusData?.isStale;
  }, [enableAutoRefresh, statusData?.isStale]);

  return {
    data: statusData,
    isLoading,
    isError,
    refreshStatus,
    shouldAutoRefresh,
    isStale: statusData?.isStale || false,
    freshness: statusData?.freshness || 'cached'
  };
};

// Hook for batch player status queries with multi-team support
export const useBatchPlayerStatus = (
  playerIds: string[], 
  conferences: { id: number; conference_name: string; league_id: string; }[]
) => {
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
    return playerIds.map((playerId) => {
      const rosterStatus = batchData[playerId];
      if (!rosterStatus) return null;

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
    }).filter(Boolean);
  }, [batchData, playerIds]);

  const { refetch } = usePlayerRosterCache(conferences);
  
  const refreshAll = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Failed to refresh batch player status:', error);
    }
  }, [refetch]);

  return {
    data: combinedData,
    isLoading,
    hasError: isError,
    refreshAll,
    freeAgents,
    rosteredPlayers,
    multiTeamPlayers,
    teamDistribution
  };
};

// Performance monitoring hook with real metrics
export const usePlayerStatusMetrics = (conferences: { id: number; conference_name: string; league_id: string; }[]) => {
  const { metrics } = usePlayerRosterCache(conferences);

  return useMemo(() => {
    const hitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100;
    
    return {
      cacheHitRate: isNaN(hitRate) ? 0 : hitRate / 100,
      averageResponseTime: metrics.averageResponseTime,
      totalQueries: metrics.apiCalls,
      cacheSize: metrics.cacheSize,
      lastUpdated: metrics.lastUpdated ? new Date(metrics.lastUpdated) : new Date(),
      detailed: metrics
    };
  }, [metrics]);
};