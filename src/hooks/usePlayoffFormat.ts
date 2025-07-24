import { useState, useEffect } from 'react';
import { DatabaseService, DbPlayoffFormat } from '@/services/databaseService';
import { useApp } from '@/contexts/AppContext';

// Default playoff format as fallback
const DEFAULT_PLAYOFF_FORMAT: DbPlayoffFormat = {
  id: 0,
  season_id: 0,
  playoff_teams: 10,
  week_14_byes: 6,
  reseed: true,
  playoff_start_week: 14,
  championship_week: 17,
  is_active: true
};

export const usePlayoffFormat = () => {
  const { selectedSeason } = useApp();
  const [playoffFormat, setPlayoffFormat] = useState<DbPlayoffFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayoffFormat = async () => {
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
        setPlayoffFormat(DEFAULT_PLAYOFF_FORMAT);
        setLoading(false);
        return;
      }

      const season = seasons[0];

      // Get playoff format for this season
      const { data: playoffFormats } = await DatabaseService.getPlayoffFormats({
        filters: [
          { column: 'season_id', operator: 'eq', value: season.id },
          { column: 'is_active', operator: 'eq', value: true }
        ]
      });

      if (playoffFormats && playoffFormats.length > 0) {
        setPlayoffFormat(playoffFormats[0]);
      } else {
        console.warn('No playoff format found for season, using defaults');
        setPlayoffFormat(DEFAULT_PLAYOFF_FORMAT);
      }
    } catch (err) {
      console.error('Error fetching playoff format:', err);
      setError('Failed to load playoff format');
      setPlayoffFormat(DEFAULT_PLAYOFF_FORMAT); // Fallback to defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayoffFormat();
  }, [selectedSeason]);

  return {
    playoffFormat,
    loading,
    error,
    refetch: fetchPlayoffFormat
  };
};