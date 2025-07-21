import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DatabaseService } from '@/services/databaseService';

// Types for league configuration
export interface Conference {
  id: string;
  name: string;
  leagueId: string;
  status?: string;
  seasonId?: string | number;
  dbConferenceId?: number; // Add the actual database conference ID
}

export interface SeasonConfig {
  year: number;
  conferences: Conference[];
  seasonId?: string | number;
  isCurrent?: boolean;
}

// App context type
interface AppContextType {
  selectedSeason: number;
  selectedConference: string | null; // null means "All Conferences"
  theme: 'light' | 'dark';
  setSelectedSeason: (season: number) => void;
  setSelectedConference: (conference: string | null) => void;
  toggleTheme: () => void;
  seasonConfigs: SeasonConfig[];
  currentSeasonConfig: SeasonConfig;
  loading: boolean;
  error: string | null;
  refreshSeasonData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(2025); // Default to current season
  const [selectedConference, setSelectedConference] = useState<string | null>(null); // Default to all conferences
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default to light theme
  const [seasonConfigs, setSeasonConfigs] = useState<SeasonConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load seasons and conferences from Supabase
  const loadSeasonData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all seasons
      const seasonsResult = await DatabaseService.getSeasons({ 
        orderBy: { column: 'season_year', ascending: false }
      });

      if (seasonsResult.error) {
        throw new Error(seasonsResult.error);
      }

      const seasons = seasonsResult.data || [];
      
      // Get all conferences
      const conferencesResult = await DatabaseService.getConferences();
      if (conferencesResult.error) {
        throw new Error(conferencesResult.error);
      }

      const conferences = conferencesResult.data || [];

      // Build season configs by grouping conferences by season
      const configs: SeasonConfig[] = seasons.map(season => {
        const seasonConferences = conferences
          .filter(conf => conf.season_id === season.id)
          .map(conf => ({
            id: conf.conference_name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: conf.conference_name,
            leagueId: conf.league_id,
            status: conf.status,
            seasonId: conf.season_id,
            dbConferenceId: conf.id // Add the actual database conference ID
          }));

        return {
          year: parseInt(season.season_year),
          conferences: seasonConferences,
          seasonId: season.id,
          isCurrent: season.is_current
        };
      });

      setSeasonConfigs(configs);

      // Set default to current season
      const currentSeason = configs.find(config => config.isCurrent);
      if (currentSeason && selectedSeason !== currentSeason.year) {
        setSelectedSeason(currentSeason.year);
      }

    } catch (err) {
      console.error('Failed to load season data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load season data');
      
      // Fallback to hardcoded data if Supabase fails
      setSeasonConfigs([
        {
          year: 2024,
          conferences: [
            { id: 'mars', name: 'The Legions of Mars', leagueId: '1072580179844857856' },
            { id: 'jupiter', name: 'The Guardians of Jupiter', leagueId: '1072593839715667968' },
            { id: 'vulcan', name: "Vulcan's Oathsworn", leagueId: '1072593416955015168' }
          ]
        },
        {
          year: 2025,
          conferences: [
            { id: 'mars', name: 'The Legions of Mars', leagueId: '1204854057169072128' },
            { id: 'jupiter', name: 'The Guardians of Jupiter', leagueId: '1204857692007440384' },
            { id: 'vulcan', name: "Vulcan's Oathsworn", leagueId: '1204857608989577216' }
          ]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadSeasonData();
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => prev === 'light' ? 'dark' : 'light');
  };

  const currentSeasonConfig = seasonConfigs.find((config) => config.year === selectedSeason) || 
    seasonConfigs.find(config => config.isCurrent) || 
    seasonConfigs[0] || 
    { year: selectedSeason, conferences: [] };

  const value: AppContextType = {
    selectedSeason,
    selectedConference,
    theme,
    setSelectedSeason,
    setSelectedConference,
    toggleTheme,
    seasonConfigs,
    currentSeasonConfig,
    loading,
    error,
    refreshSeasonData: loadSeasonData
  };

  return (
    <AppContext.Provider value={value}>
      <div className={theme}>
        {children}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};