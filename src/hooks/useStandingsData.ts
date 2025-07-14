import { useState, useEffect } from 'react';
import { StandingsService, StandingsData } from '@/services/standingsService';

interface UseStandingsDataOptions {
  seasonYear: number;
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
    try {
      setLoading(true);
      setError(null);

      let data: StandingsData[];

      if (limit) {
        data = await StandingsService.getTopStandings(seasonYear, limit);
      } else {
        data = await StandingsService.getStandingsData(seasonYear, conferenceId);
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
    }
  }, [seasonYear, conferenceId, limit]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
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