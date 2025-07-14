
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import PlayerDataService, { PlayerData, PlayerAvailability } from '../services/playerDataService';
import RosterSyncEngine, { SyncConfiguration, SyncProgress, RosterSyncState } from '../services/rosterSyncEngine';
import PlayerAvailabilityCalculator, { AvailabilityStats, AvailabilityFilter } from '../services/playerAvailabilityCalculator';

/**
 * React Query hook for real-time player data with optimistic updates
 * Provides caching, background sync, and conflict resolution
 */

// Query keys
export const QUERY_KEYS = {
  players: 'players',
  playerAvailability: 'playerAvailability',
  availabilityStats: 'availabilityStats',
  teamRoster: 'teamRoster',
  syncStatus: 'syncStatus'
};

// Hook for fetching all players with real-time updates
export function usePlayersData(forceRefresh = false) {
  const playerService = PlayerDataService.getInstance();
  
  return useQuery({
    queryKey: [QUERY_KEYS.players, 'all'],
    queryFn: () => playerService.getAllPlayers(forceRefresh),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
}

// Hook for searching players with filters
export function usePlayerSearch(filters: {
  name?: string;
  position?: string;
  team?: string;
  status?: string;
  availability?: 'available' | 'owned';
  seasonId?: number;
  week?: number;
}) {
  const playerService = PlayerDataService.getInstance();
  
  return useQuery({
    queryKey: [QUERY_KEYS.players, 'search', filters],
    queryFn: () => playerService.searchPlayers(filters),
    enabled: !!(filters.name || filters.position || filters.team || filters.status),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000 // 5 minutes
  });
}

// Hook for player availability data
export function usePlayerAvailability(playerId: number, seasonId: number, week: number) {
  const availabilityCalculator = PlayerAvailabilityCalculator.getInstance();
  
  return useQuery({
    queryKey: [QUERY_KEYS.playerAvailability, playerId, seasonId, week],
    queryFn: () => availabilityCalculator.calculatePlayerAvailability(playerId, seasonId, week),
    enabled: playerId > 0,
    staleTime: 30 * 1000, // 30 seconds for real-time feel
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60 * 1000 // Refetch every minute
  });
}

// Hook for availability statistics
export function useAvailabilityStats(seasonId: number, week: number, filter?: AvailabilityFilter) {
  const availabilityCalculator = PlayerAvailabilityCalculator.getInstance();
  
  return useQuery({
    queryKey: [QUERY_KEYS.availabilityStats, seasonId, week, filter],
    queryFn: () => availabilityCalculator.getAvailabilityStats(seasonId, week, filter),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });
}

// Hook for team roster data
export function useTeamRoster(teamId: number, seasonId: number) {
  const playerService = PlayerDataService.getInstance();
  
  return useQuery({
    queryKey: [QUERY_KEYS.teamRoster, teamId, seasonId],
    queryFn: () => playerService.getTeamCurrentRoster(teamId, seasonId),
    enabled: teamId > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000 // 5 minutes
  });
}

// Hook for roster synchronization with progress tracking
export function useRosterSync() {
  const queryClient = useQueryClient();
  const syncEngine = RosterSyncEngine.getInstance();
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncState, setSyncState] = useState<RosterSyncState | null>(null);

  // Subscribe to sync progress updates
  useEffect(() => {
    const unsubscribe = syncEngine.onProgress((progress) => {
      setSyncProgress(progress);
    });

    // Get initial sync state
    setSyncState(syncEngine.getSyncState());

    return unsubscribe;
  }, [syncEngine]);

  // Mutation for manual sync
  const syncMutation = useMutation({
    mutationFn: async (config: SyncConfiguration) => {
      const result = await syncEngine.fullSync(config);
      
      // Invalidate relevant queries after sync
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.players] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.playerAvailability] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.teamRoster] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.availabilityStats] })
      ]);
      
      return result;
    },
    onSuccess: (result) => {
      console.log('Sync completed:', result);
      setSyncState(syncEngine.getSyncState());
    },
    onError: (error) => {
      console.error('Sync failed:', error);
      setSyncState(syncEngine.getSyncState());
    }
  });

  return {
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending || syncState?.isRunning,
    syncProgress,
    syncState,
    syncResult: syncMutation.data,
    syncError: syncMutation.error,
    forceStop: () => syncEngine.forceStop(),
    startAutoSync: (config: SyncConfiguration, interval?: number) => 
      syncEngine.startAutomaticSync(config, interval),
    stopAutoSync: () => syncEngine.stopAutomaticSync()
  };
}

// Hook for optimistic roster updates
export function useOptimisticRosterUpdate() {
  const queryClient = useQueryClient();
  const playerService = PlayerDataService.getInstance();

  const addPlayerToRoster = useMutation({
    mutationFn: async ({ 
      teamId, 
      playerId, 
      seasonId, 
      week, 
      rosterStatus 
    }: {
      teamId: number;
      playerId: number;
      seasonId: number;
      week: number;
      rosterStatus: 'active' | 'bench' | 'ir' | 'taxi';
    }) => {
      const rosterData = {
        team_id: teamId,
        player_id: playerId,
        season_id: seasonId,
        week: week,
        current_week: week,
        is_current: true,
        added_date: new Date().toISOString(),
        roster_status: rosterStatus,
        last_updated: new Date().toISOString()
      };

      const operations = [{
        type: 'create' as const,
        tableId: 27886, // TEAM_ROSTERS table ID
        data: rosterData
      }];

      return await playerService.batchUpdatePlayers(operations);
    },
    
    // Optimistic update
    onMutate: async ({ teamId, playerId, seasonId, rosterStatus }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: [QUERY_KEYS.teamRoster, teamId, seasonId] 
      });

      // Snapshot the previous value
      const previousRoster = queryClient.getQueryData([QUERY_KEYS.teamRoster, teamId, seasonId]);

      // Optimistically update roster
      queryClient.setQueryData([QUERY_KEYS.teamRoster, teamId, seasonId], (old: any) => {
        if (!old) return old;
        
        const newRosterEntry = {
          team_id: teamId,
          player_id: playerId,
          season_id: seasonId,
          week: 1,
          current_week: 1,
          is_current: true,
          added_date: new Date().toISOString(),
          roster_status: rosterStatus,
          last_updated: new Date().toISOString()
        };

        return [...old, newRosterEntry];
      });

      // Also optimistically update player availability
      queryClient.setQueryData([QUERY_KEYS.playerAvailability, playerId, seasonId, 1], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          is_available: false,
          owned_by_team_id: teamId,
          roster_status: rosterStatus,
          cache_updated_at: new Date().toISOString()
        };
      });

      return { previousRoster };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousRoster) {
        queryClient.setQueryData(
          [QUERY_KEYS.teamRoster, variables.teamId, variables.seasonId], 
          context.previousRoster
        );
      }
      console.error('Failed to add player to roster:', err);
    },

    // Refetch on success or error
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [QUERY_KEYS.teamRoster, variables.teamId, variables.seasonId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [QUERY_KEYS.playerAvailability, variables.playerId, variables.seasonId] 
      });
    }
  });

  const removePlayerFromRoster = useMutation({
    mutationFn: async ({ 
      teamId, 
      playerId, 
      seasonId 
    }: {
      teamId: number;
      playerId: number;
      seasonId: number;
    }) => {
      // First find the roster entry to update
      const currentRoster = await playerService.getTeamCurrentRoster(teamId, seasonId);
      const rosterEntry = currentRoster.find(r => r.player_id === playerId);
      
      if (!rosterEntry) {
        throw new Error('Player not found on roster');
      }

      const operations = [{
        type: 'update' as const,
        tableId: 27886, // TEAM_ROSTERS table ID
        id: rosterEntry.team_id, // This might need to be the actual roster entry ID
        data: {
          is_current: false,
          removed_date: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }
      }];

      return await playerService.batchUpdatePlayers(operations);
    },

    // Optimistic update (similar pattern to add)
    onMutate: async ({ teamId, playerId, seasonId }) => {
      await queryClient.cancelQueries({ 
        queryKey: [QUERY_KEYS.teamRoster, teamId, seasonId] 
      });

      const previousRoster = queryClient.getQueryData([QUERY_KEYS.teamRoster, teamId, seasonId]);

      queryClient.setQueryData([QUERY_KEYS.teamRoster, teamId, seasonId], (old: any) => {
        if (!old) return old;
        return old.filter((entry: any) => entry.player_id !== playerId);
      });

      queryClient.setQueryData([QUERY_KEYS.playerAvailability, playerId, seasonId, 1], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          is_available: true,
          owned_by_team_id: null,
          roster_status: 'free_agent',
          cache_updated_at: new Date().toISOString()
        };
      });

      return { previousRoster };
    },

    onError: (err, variables, context) => {
      if (context?.previousRoster) {
        queryClient.setQueryData(
          [QUERY_KEYS.teamRoster, variables.teamId, variables.seasonId], 
          context.previousRoster
        );
      }
      console.error('Failed to remove player from roster:', err);
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [QUERY_KEYS.teamRoster, variables.teamId, variables.seasonId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [QUERY_KEYS.playerAvailability, variables.playerId, variables.seasonId] 
      });
    }
  });

  return {
    addPlayer: addPlayerToRoster.mutate,
    removePlayer: removePlayerFromRoster.mutate,
    isAddingPlayer: addPlayerToRoster.isPending,
    isRemovingPlayer: removePlayerFromRoster.isPending,
    addError: addPlayerToRoster.error,
    removeError: removePlayerFromRoster.error
  };
}

// Hook for bulk availability refresh
export function useBulkAvailabilityRefresh() {
  const queryClient = useQueryClient();
  const availabilityCalculator = PlayerAvailabilityCalculator.getInstance();

  return useMutation({
    mutationFn: async ({ 
      playerIds, 
      seasonId, 
      week 
    }: {
      playerIds: number[];
      seasonId: number;
      week: number;
    }) => {
      return await availabilityCalculator.bulkRefreshAvailability(playerIds, seasonId, week);
    },
    onSuccess: (result, variables) => {
      // Invalidate availability queries for refreshed players
      variables.playerIds.forEach(playerId => {
        queryClient.invalidateQueries({ 
          queryKey: [QUERY_KEYS.playerAvailability, playerId, variables.seasonId, variables.week] 
        });
      });
      
      // Also invalidate stats
      queryClient.invalidateQueries({ 
        queryKey: [QUERY_KEYS.availabilityStats] 
      });

      console.log('Bulk availability refresh completed:', result);
    },
    onError: (error) => {
      console.error('Bulk availability refresh failed:', error);
    }
  });
}

// Hook for cache management
export function useCacheManagement() {
  const playerService = PlayerDataService.getInstance();
  const availabilityCalculator = PlayerAvailabilityCalculator.getInstance();
  const queryClient = useQueryClient();

  const clearAllCaches = useCallback(() => {
    // Clear service caches
    playerService.clearCache();
    availabilityCalculator.clearCache();
    
    // Clear React Query cache
    queryClient.clear();
    
    console.log('All caches cleared');
  }, [playerService, availabilityCalculator, queryClient]);

  const getCacheStats = useCallback(() => {
    return {
      playerService: playerService.getCacheStats(),
      availabilityCalculator: availabilityCalculator.getCacheStats(),
      reactQuery: {
        size: queryClient.getQueryCache().getAll().length,
        queries: queryClient.getQueryCache().getAll().map(query => query.queryKey)
      }
    };
  }, [playerService, availabilityCalculator, queryClient]);

  return {
    clearAllCaches,
    getCacheStats
  };
}
