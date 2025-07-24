import { useState, useEffect } from 'react';
import { CharterService, CharterInfo } from '@/services/charterService';
import { DatabaseService } from '@/services/databaseService';
import { useApp } from '@/contexts/AppContext';

export const useCharter = () => {
  const { selectedSeason } = useApp();
  const [charterInfo, setCharterInfo] = useState<CharterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharterInfo = async () => {
    if (!selectedSeason) {
      setError('No season selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the season data first
      const { data: seasons } = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
      });

      if (!seasons || seasons.length === 0) {
        setError('Season not found');
        setLoading(false);
        return;
      }

      const season = seasons[0];

      // Get charter info for this season
      const charter = await CharterService.getCharterInfo(season.id);
      setCharterInfo(charter);

    } catch (err) {
      console.error('Error fetching charter info:', err);
      setError('Failed to load charter information');
      setCharterInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharterInfo();
  }, [selectedSeason]);

  return {
    charterInfo,
    loading,
    error,
    refetch: fetchCharterInfo,
    hasCharter: !!charterInfo
  };
};