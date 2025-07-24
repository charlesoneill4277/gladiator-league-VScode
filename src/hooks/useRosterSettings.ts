import { useState, useEffect } from 'react';
import { DatabaseService } from '@/services/databaseService';
import { useApp } from '@/contexts/AppContext';

export interface RosterSettings {
  positions: Record<string, number>;
  totalRosterSize: number;
  startingLineupSize: number;
  benchSize: number;
}

// Default roster configuration as fallback
const DEFAULT_ROSTER_SETTINGS: RosterSettings = {
  positions: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1, // RB/WR/TE
    SUPER_FLEX: 1, // QB/RB/WR/TE
    DEF: 1,
    BENCH: 6
  },
  totalRosterSize: 15,
  startingLineupSize: 9,
  benchSize: 6
};

export const useRosterSettings = () => {
  const { selectedSeason } = useApp();
  const [rosterSettings, setRosterSettings] = useState<RosterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const convertSleeperRosterToUI = (sleeperRoster: string[]): RosterSettings => {
    const positionCounts: Record<string, number> = {};
    
    // Count each position type
    sleeperRoster.forEach(position => {
      positionCounts[position] = (positionCounts[position] || 0) + 1;
    });

    // Calculate bench size (total roster - starting lineup)
    const startingLineupSize = sleeperRoster.length;
    const totalRosterSize = 15; // Default, could be fetched from league settings
    const benchSize = totalRosterSize - startingLineupSize;

    // Add bench to position counts
    if (benchSize > 0) {
      positionCounts.BENCH = benchSize;
    }

    return {
      positions: positionCounts,
      totalRosterSize,
      startingLineupSize,
      benchSize
    };
  };

  const fetchRosterSettings = async () => {
    if (!selectedSeason) {
      setError('No season selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the season data
      const { data: seasons } = await DatabaseService.getSeasons({
        filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
      });

      if (!seasons || seasons.length === 0) {
        setError('Season not found');
        setLoading(false);
        return;
      }

      const season = seasons[0];

      // If roster positions don't exist, try to fetch and update them
      if (!season.roster_positions) {
        console.log('Roster positions not found, fetching from Sleeper API...');
        const updateResult = await DatabaseService.updateSeasonRosterPositions(season.id);
        
        if (!updateResult.success) {
          console.warn('Failed to fetch roster positions from Sleeper API, using defaults');
          setRosterSettings(DEFAULT_ROSTER_SETTINGS);
          setLoading(false);
          return;
        }

        // Refetch the season data
        const { data: updatedSeasons } = await DatabaseService.getSeasons({
          filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
        });

        if (updatedSeasons && updatedSeasons.length > 0 && updatedSeasons[0].roster_positions) {
          const convertedSettings = convertSleeperRosterToUI(updatedSeasons[0].roster_positions);
          setRosterSettings(convertedSettings);
        } else {
          setRosterSettings(DEFAULT_ROSTER_SETTINGS);
        }
      } else {
        // Convert existing roster positions
        const convertedSettings = convertSleeperRosterToUI(season.roster_positions);
        setRosterSettings(convertedSettings);
      }
    } catch (err) {
      console.error('Error fetching roster settings:', err);
      setError('Failed to load roster settings');
      setRosterSettings(DEFAULT_ROSTER_SETTINGS); // Fallback to defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRosterSettings();
  }, [selectedSeason]);

  return {
    rosterSettings,
    loading,
    error,
    refetch: fetchRosterSettings
  };
};