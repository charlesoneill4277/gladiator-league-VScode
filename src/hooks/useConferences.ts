import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { conferenceService, ConferenceMapping, useConferenceService } from '@/services/conferenceService';

export interface UseConferencesOptions {
  seasonYear?: number;
  enabled?: boolean;
}

export interface UseConferencesResult {
  conferences: ConferenceMapping[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  getConferenceById: (id: string) => ConferenceMapping | undefined;
  getLeagueIdByConference: (conferenceId: string) => string | undefined;
}

/**
 * Hook to fetch and manage conference data with React Query
 */
export const useConferences = (options: UseConferencesOptions = {}): UseConferencesResult => {
  const { seasonYear, enabled = true } = options;
  const { showError } = useConferenceService();

  const queryKey = ['conferences', seasonYear || 'current'];

  const query: UseQueryResult<ConferenceMapping[], Error> = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await conferenceService.getConferencesForSeason(seasonYear);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    onError: (error: Error) => {
      console.error('Error fetching conferences:', error);
      showError(error.message || 'Failed to load conferences');
    }
  });

  const getConferenceById = (id: string): ConferenceMapping | undefined => {
    return query.data?.find(conf => conf.id === id);
  };

  const getLeagueIdByConference = (conferenceId: string): string | undefined => {
    const conference = getConferenceById(conferenceId);
    return conference?.leagueId;
  };

  return {
    conferences: query.data || [],
    loading: query.isLoading || query.isFetching,
    error: query.error?.message || null,
    refetch: query.refetch,
    getConferenceById,
    getLeagueIdByConference
  };
};

/**
 * Hook to get a specific conference by ID
 */
export const useConference = (conferenceId: string, seasonYear?: number) => {
  const { showError } = useConferenceService();

  const queryKey = ['conference', conferenceId, seasonYear || 'current'];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const result = await conferenceService.getConferenceById(conferenceId, seasonYear);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    enabled: !!conferenceId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 2,
    onError: (error: Error) => {
      console.error(`Error fetching conference ${conferenceId}:`, error);
      showError(error.message || 'Failed to load conference');
    }
  });
};

/**
 * Hook to get league ID for a conference with validation
 */
export const useLeagueId = (conferenceId: string | null, seasonYear?: number) => {
  const { showError } = useConferenceService();

  const queryKey = ['leagueId', conferenceId, seasonYear || 'current'];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!conferenceId) return null;
      
      const result = await conferenceService.getLeagueIdForConference(conferenceId, seasonYear);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    enabled: !!conferenceId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 2,
    onError: (error: Error) => {
      console.error(`Error fetching league ID for conference ${conferenceId}:`, error);
      showError(error.message || 'Failed to get league ID');
    }
  });
};