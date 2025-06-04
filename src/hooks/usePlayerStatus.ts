import { useMemo, useCallback } from 'react';
import { usePlayerRosterCache, usePlayerRosterStatus } from './usePlayerRosterCache';

export interface PlayerStatusData {
  playerId: string;
  isRostered: boolean;
  teamName?: string;
  rosterPosition?: string;
  lastUpdated: Date;
  isStale: boolean;
  freshness: 'live' | 'recent' | 'cached';
}

export interface UsePlayerStatusOptions {
  enableAutoRefresh?: boolean;
  staleTolerance?: number; // minutes
}

export const usePlayerStatus = (
  playerId: string,
  options: UsePlayerStatusOptions = {}
) => {
  const {
    enableAutoRefresh = true,
    staleTolerance = 5
  } = options;

  // Use existing player roster cache functionality
  const rosterQuery = usePlayerRosterStatus(playerId);
  const { data: rosterData, isLoading, error, refetch } = rosterQuery;

  // Calculate data freshness
  const statusData = useMemo<PlayerStatusData | null>(() => {
    if (!rosterData) return null;

    const now = new Date();
    const lastUpdated = new Date(); // In real implementation, this would come from cache metadata
    const ageInMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));

    let freshness: 'live' | 'recent' | 'cached' = 'live';
    if (ageInMinutes > 5) freshness = 'cached';
    else if (ageInMinutes > 2) freshness = 'recent';

    return {
      playerId,
      isRostered: !!rosterData.teamId,
      teamName: rosterData.teamName || undefined,
      rosterPosition: rosterData.position || undefined,
      lastUpdated,
      isStale: ageInMinutes > staleTolerance,
      freshness
    };
  }, [rosterData, playerId, staleTolerance]);

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
    error,
    refreshStatus,
    shouldAutoRefresh,
    isStale: statusData?.isStale || false,
    freshness: statusData?.freshness || 'cached'
  };
};

// Hook for batch player status queries
export const useBatchPlayerStatus = (playerIds: string[]) => {
  const individualQueries = playerIds.map(id => usePlayerStatus(id));

  const combinedData = useMemo(() => {
    return individualQueries.map(query => query.data).filter(Boolean);
  }, [individualQueries]);

  const isLoading = individualQueries.some(query => query.isLoading);
  const hasError = individualQueries.some(query => query.error);

  const refreshAll = useCallback(async () => {
    await Promise.all(
      individualQueries.map(query => query.refreshStatus())
    );
  }, [individualQueries]);

  return {
    data: combinedData,
    isLoading,
    hasError,
    refreshAll,
    queries: individualQueries
  };
};

// Performance monitoring hook
export const usePlayerStatusMetrics = () => {
  const cache = usePlayerRosterCache();

  return useMemo(() => {
    // In a real implementation, this would calculate cache hit rates,
    // average response times, etc.
    return {
      cacheHitRate: 0.85,
      averageResponseTime: 150,
      totalQueries: 0,
      lastUpdated: new Date()
    };
  }, [cache]);
};