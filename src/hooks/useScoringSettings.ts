import { useState, useEffect } from 'react';
import { DatabaseService } from '@/services/databaseService';
import { useApp } from '@/contexts/AppContext';

export interface ScoringRule {
  points: number;
  per: number;
  description: string;
}

export interface ScoringSettings {
  passing: {
    [key: string]: ScoringRule;
  };
  rushing: {
    [key: string]: ScoringRule;
  };
  receiving: {
    [key: string]: ScoringRule;
  };
}

// Mapping from Sleeper API scoring keys to our UI structure
const SLEEPER_SCORING_MAP: Record<string, { category: keyof ScoringSettings; key: string; description: string; per: number }> = {
  'pass_yd': { category: 'passing', key: 'passingYards', description: 'passing yards', per: 25 },
  'pass_td': { category: 'passing', key: 'passingTDs', description: 'passing touchdown', per: 1 },
  'pass_int': { category: 'passing', key: 'interceptions', description: 'interception', per: 1 },
  'pass_2pt': { category: 'passing', key: 'passing2pt', description: '2-point conversion', per: 1 },
  'rush_yd': { category: 'rushing', key: 'rushingYards', description: 'rushing yards', per: 10 },
  'rush_td': { category: 'rushing', key: 'rushingTDs', description: 'rushing touchdown', per: 1 },
  'rush_2pt': { category: 'rushing', key: 'rushing2pt', description: '2-point conversion', per: 1 },
  'rec_yd': { category: 'receiving', key: 'receivingYards', description: 'receiving yards', per: 10 },
  'rec': { category: 'receiving', key: 'receptions', description: 'reception (PPR)', per: 1 },
  'rec_td': { category: 'receiving', key: 'receivingTDs', description: 'receiving touchdown', per: 1 },
  'rec_2pt': { category: 'receiving', key: 'receiving2pt', description: '2-point conversion', per: 1 }
};

export const useScoringSettings = () => {
  const { selectedSeason } = useApp();
  const [scoringSettings, setScoringSettings] = useState<ScoringSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const convertSleeperScoringToUI = (sleeperScoring: Record<string, number>): ScoringSettings => {
    const settings: ScoringSettings = {
      passing: {},
      rushing: {},
      receiving: {}
    };

    Object.entries(sleeperScoring).forEach(([sleeperKey, points]) => {
      const mapping = SLEEPER_SCORING_MAP[sleeperKey];
      if (mapping) {
        settings[mapping.category][mapping.key] = {
          points,
          per: mapping.per,
          description: `${points > 0 ? '+' : ''}${points} point${Math.abs(points) !== 1 ? 's' : ''} per ${mapping.description}`
        };
      }
    });

    return settings;
  };

  const fetchScoringSettings = async () => {
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

      // If scoring settings don't exist, try to fetch and update them
      if (!season.scoring_settings) {
        console.log('Scoring settings not found, fetching from Sleeper API...');
        const updateResult = await DatabaseService.updateSeasonScoringSettings(season.id);
        
        if (!updateResult.success) {
          setError('Failed to fetch scoring settings from Sleeper API');
          setLoading(false);
          return;
        }

        // Refetch the season data
        const { data: updatedSeasons } = await DatabaseService.getSeasons({
          filters: [{ column: 'season_year', operator: 'eq', value: selectedSeason }]
        });

        if (updatedSeasons && updatedSeasons.length > 0 && updatedSeasons[0].scoring_settings) {
          const convertedSettings = convertSleeperScoringToUI(updatedSeasons[0].scoring_settings);
          setScoringSettings(convertedSettings);
        } else {
          setError('Failed to update scoring settings');
        }
      } else {
        // Convert existing scoring settings
        const convertedSettings = convertSleeperScoringToUI(season.scoring_settings);
        setScoringSettings(convertedSettings);
      }
    } catch (err) {
      console.error('Error fetching scoring settings:', err);
      setError('Failed to load scoring settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScoringSettings();
  }, [selectedSeason]);

  return {
    scoringSettings,
    loading,
    error,
    refetch: fetchScoringSettings
  };
};