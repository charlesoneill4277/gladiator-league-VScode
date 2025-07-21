import { useState, useEffect } from 'react';
import { StandingsService, StandingsData } from '@/services/standingsService';

interface UseStandingsDataOptions {
  seasonYear?: number; // Made optional to handle undefined values
  conferenceId?: string | number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseStandingsDataResult {
  standings: StandingsData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useStandingsData = (options: UseStandingsDataOptions): UseStandingsDataResult => {
  const { seasonYear, conferenceId, limit, autoRefresh = false, refreshInterval = 30000 } = options;
  const [standings, setStandings] = useState<StandingsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStandings = async () => {
    // Don't fetch if seasonYear is not available
    if (!seasonYear) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all standings data
      let data: StandingsData[] = await StandingsService.getStandingsData(seasonYear, conferenceId);
      
      // Apply limit if specified
      if (limit && limit > 0) {
        data = data.slice(0, limit);
      }

      setStandings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching standings';
      setError(errorMessage);
      console.error('Error fetching standings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (seasonYear) {
      fetchStandings();
    } else {
      // Set loading to false if no seasonYear
      setLoading(false);
    }
  }, [seasonYear, conferenceId, limit]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && seasonYear) {
      const interval = setInterval(fetchStandings, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, seasonYear, conferenceId, limit]);

  return {
    standings,
    loading,
    error,
    refetch: fetchStandings
  };
};

export default useStandingsData;