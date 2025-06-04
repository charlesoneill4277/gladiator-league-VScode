import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { PlayerRosterService, RosterStatusMap, RosterStatusInfo } from '@/services/playerRosterService';

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
}

interface UsePlayerRosterCacheOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: number;
  retryDelay?: (attemptIndex: number) => number;
}

interface UsePlayerRosterCacheResult {
  data: RosterStatusMap | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  isFetching: boolean;
  refetch: () => void;
  invalidate: () => void;
  getRosterStatus: (playerId: string) => RosterStatusInfo;
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    apiCalls: number;
    cacheSize: number;
    lastUpdated?: number;
  };
}

/**
 * React Query hook for managing player roster cache with advanced performance optimizations
 */
export const usePlayerRosterCache = (
conferences: Conference[],
options: UsePlayerRosterCacheOptions = {})
: UsePlayerRosterCacheResult => {
  const queryClient = useQueryClient();
  const backgroundSyncRef = useRef<boolean>(false);

  const {
    enabled = true,
    refetchInterval = 5 * 60 * 1000, // 5 minutes
    staleTime = 2 * 60 * 1000, // 2 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus = true,
    retry = 3,
    retryDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000)
  } = options;

  // Generate stable query key
  const queryKey = ['player-rosters', conferences.map((c) => c.league_id).sort()];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<RosterStatusMap> => {
      console.log('🔄 React Query: Fetching roster data for', conferences.length, 'conferences');
      const startTime = Date.now();

      try {
        const result = await PlayerRosterService.fetchAllRosterData(conferences);
        const duration = Date.now() - startTime;

        console.log('✅ React Query: Roster data fetched successfully', {
          duration: `${duration}ms`,
          entries: Object.keys(result).length
        });

        return result;
      } catch (error) {
        console.error('❌ React Query: Failed to fetch roster data:', error);
        throw error;
      }
    },
    enabled: enabled && conferences.length > 0,
    staleTime,
    cacheTime,
    refetchInterval: refetchInterval,
    refetchOnWindowFocus,
    retry,
    retryDelay,
    // Keep previous data while fetching new data
    keepPreviousData: true,
    // Background refetch without showing loading state
    refetchIntervalInBackground: true,
    // Network mode for better offline handling
    networkMode: 'online',
    // Custom error handler
    onError: (error) => {
      console.error('🚨 React Query: Roster cache error:', error);
    },
    // Success handler
    onSuccess: (data) => {
      console.log('✅ React Query: Roster cache updated successfully', {
        entries: Object.keys(data).length,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Start background sync when component mounts
  useEffect(() => {
    if (conferences.length > 0 && !backgroundSyncRef.current) {
      console.log('🔄 Starting background sync for roster data');
      PlayerRosterService.startBackgroundSync(conferences);
      backgroundSyncRef.current = true;
    }

    // Cleanup on unmount
    return () => {
      if (backgroundSyncRef.current) {
        console.log('🔄 Stopping background sync for roster data');
        PlayerRosterService.stopBackgroundSync();
        backgroundSyncRef.current = false;
      }
    };
  }, [conferences]);

  // Invalidate cache when conferences change
  useEffect(() => {
    if (conferences.length > 0) {
      // Optionally invalidate React Query cache when conferences change
      queryClient.invalidateQueries({ queryKey: ['player-rosters'] });
    }
  }, [conferences.map((c) => c.league_id).join(','), queryClient]);

  // Enhanced refetch function with loading state management
  const refetch = async () => {
    console.log('🔄 Manual refetch triggered');
    try {
      await query.refetch();
    } catch (error) {
      console.error('❌ Manual refetch failed:', error);
    }
  };

  // Invalidate cache function
  const invalidate = () => {
    console.log('🔄 Invalidating roster cache');
    PlayerRosterService.invalidateCache(conferences);
    queryClient.invalidateQueries({ queryKey });
  };

  // Get roster status for specific player with fallback
  const getRosterStatus = (playerId: string): RosterStatusInfo => {
    if (!query.data) {
      return { isRostered: false };
    }

    return query.data[playerId] || { isRostered: false };
  };

  // Get performance metrics
  const metrics = {
    ...PlayerRosterService.getPerformanceMetrics(),
    lastUpdated: query.dataUpdatedAt
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isStale: query.isStale,
    isFetching: query.isFetching,
    refetch,
    invalidate,
    getRosterStatus,
    metrics
  };
};

/**
 * Hook for individual player roster status with optimized caching
 */
export const usePlayerRosterStatus = (
playerId: string,
conferences: Conference[])
: RosterStatusInfo & {isLoading: boolean;isError: boolean;} => {
  const { data, isLoading, isError, getRosterStatus } = usePlayerRosterCache(conferences);

  const rosterStatus = getRosterStatus(playerId);

  return {
    ...rosterStatus,
    isLoading,
    isError
  };
};

/**
 * Hook for batch player roster status queries
 */
export const useBatchPlayerRosterStatus = (
playerIds: string[],
conferences: Conference[])
: {
  data: Record<string, RosterStatusInfo>;
  isLoading: boolean;
  isError: boolean;
  freeAgents: string[];
  rosteredPlayers: string[];
} => {
  const { data, isLoading, isError, getRosterStatus } = usePlayerRosterCache(conferences);

  const batchData: Record<string, RosterStatusInfo> = {};
  const freeAgents: string[] = [];
  const rosteredPlayers: string[] = [];

  playerIds.forEach((playerId) => {
    const status = getRosterStatus(playerId);
    batchData[playerId] = status;

    if (status.isRostered) {
      rosteredPlayers.push(playerId);
    } else {
      freeAgents.push(playerId);
    }
  });

  return {
    data: batchData,
    isLoading,
    isError,
    freeAgents,
    rosteredPlayers
  };
};

/**
 * Hook for performance monitoring and debugging
 */
export const useRosterCacheMetrics = () => {
  const queryClient = useQueryClient();

  const getDetailedMetrics = () => {
    const baseMetrics = PlayerRosterService.getPerformanceMetrics();
    const queryCache = queryClient.getQueryCache();
    const rosterQueries = queryCache.findAll({ queryKey: ['player-rosters'] });

    return {
      ...baseMetrics,
      reactQueryCacheSize: rosterQueries.length,
      reactQueryStates: rosterQueries.map((query) => ({
        key: JSON.stringify(query.queryKey),
        state: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        errorUpdatedAt: query.state.errorUpdatedAt
      }))
    };
  };

  return {
    metrics: getDetailedMetrics(),
    clearAllCaches: () => {
      PlayerRosterService.invalidateCache();
      queryClient.invalidateQueries({ queryKey: ['player-rosters'] });
    }
  };
};