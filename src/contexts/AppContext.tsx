import React, { createContext, useContext, useState, ReactNode } from 'react';

// Types for league configuration
export interface Conference {
  id: string;
  name: string;
  leagueId: string;
}

export interface SeasonConfig {
  year: number;
  conferences: Conference[];
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
}

// League configurations
const SEASON_CONFIGS: SeasonConfig[] = [
  {
    year: 2024,
    conferences: [
      { id: 'mars', name: 'Legions of Mars', leagueId: '1072580179844857856' },
      { id: 'jupiter', name: 'Guardians of Jupiter', leagueId: '1072593839715667968' },
      { id: 'vulcan', name: "Vulcan's Oathsworn", leagueId: '1072593416955015168' }
    ]
  },
  {
    year: 2025,
    conferences: [
      { id: 'mars', name: 'Legions of Mars', leagueId: '1204854057169072128' },
      { id: 'jupiter', name: 'Guardians of Jupiter', leagueId: '1204857692007440384' },
      { id: 'vulcan', name: "Vulcan's Oathsworn", leagueId: '1204857608989577216' }
    ]
  }
];

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(2025); // Default to current season
  const [selectedConference, setSelectedConference] = useState<string | null>(null); // Default to all conferences
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Default to dark theme

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const currentSeasonConfig = SEASON_CONFIGS.find(config => config.year === selectedSeason) || SEASON_CONFIGS[1];

  const value: AppContextType = {
    selectedSeason,
    selectedConference,
    theme,
    setSelectedSeason,
    setSelectedConference,
    toggleTheme,
    seasonConfigs: SEASON_CONFIGS,
    currentSeasonConfig
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