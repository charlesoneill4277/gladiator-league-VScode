import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';

// Filter state interface
export interface PlayerFilterState {
  search: string;
  position: string;
  nflTeam: string;
  conference: string;
  availabilityStatus: string;
  injuryStatus: string;
  rosterStatus: string;
  ownedByMultipleTeams: boolean;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

// Filter options
export interface FilterOptions {
  positions: string[];
  nflTeams: string[];
  conferences: string[];
  availabilityStatuses: string[];
  injuryStatuses: string[];
  rosterStatuses: string[];
  sortOptions: {value: string;label: string;}[];
}

// Context interface
interface PlayerFilterContextType {
  filters: PlayerFilterState;
  debouncedSearch: string;
  updateFilter: (key: keyof PlayerFilterState, value: any) => void;
  updateFilters: (updates: Partial<PlayerFilterState>) => void;
  clearFilters: () => void;
  resetPagination: () => void;
  exportFilters: () => string;
  importFilters: (filterString: string) => void;
  getFilterCount: () => number;
}

// Default filter state
const defaultFilters: PlayerFilterState = {
  search: '',
  position: 'all',
  nflTeam: 'all',
  conference: 'all',
  availabilityStatus: 'all',
  injuryStatus: 'all',
  rosterStatus: 'all',
  ownedByMultipleTeams: false,
  sortBy: 'points',
  sortDirection: 'desc',
  page: 1,
  pageSize: 50
};

// Filter options data
export const filterOptions: FilterOptions = {
  positions: ['all', 'QB', 'RB', 'WR', 'TE'],
  nflTeams: [
  'all', 'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAC', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN',
  'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'],

  conferences: ['all', 'mars', 'jupiter', 'vulcan'],
  availabilityStatuses: ['all', 'available', 'owned', 'waivers'],
  injuryStatuses: ['all', 'healthy', 'Q', 'D', 'IR', 'O', 'PUP'],
  rosterStatuses: ['all', 'active', 'bench', 'ir', 'taxi', 'free_agent'],
  sortOptions: [
  { value: 'points', label: 'Total Points' },
  { value: 'avgPoints', label: 'Average Points' },
  { value: 'name', label: 'Player Name' },
  { value: 'position', label: 'Position' },
  { value: 'nflTeam', label: 'NFL Team' },
  { value: 'projectedPoints', label: 'Projected Points' },
  { value: 'draftPosition', label: 'Draft Position' },
  { value: 'age', label: 'Age' },
  { value: 'experience', label: 'Experience' }]

};

const PlayerFilterContext = createContext<PlayerFilterContextType | null>(null);

export const usePlayerFilters = () => {
  const context = useContext(PlayerFilterContext);
  if (!context) {
    throw new Error('usePlayerFilters must be used within a PlayerFilterProvider');
  }
  return context;
};

// URL parameter mapping
const urlParamMap: Record<keyof PlayerFilterState, string> = {
  search: 'q',
  position: 'pos',
  nflTeam: 'team',
  conference: 'conf',
  availabilityStatus: 'avail',
  injuryStatus: 'inj',
  rosterStatus: 'roster',
  ownedByMultipleTeams: 'multi',
  sortBy: 'sort',
  sortDirection: 'dir',
  page: 'page',
  pageSize: 'size'
};

export const PlayerFilterProvider: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<PlayerFilterState>(defaultFilters);

  // Debounced search for performance
  const debouncedSearch = useDebounce(filters.search, 300);

  // Initialize filters from URL on mount
  useEffect(() => {
    const initialFilters = { ...defaultFilters };

    // Parse URL parameters
    Object.entries(urlParamMap).forEach(([key, param]) => {
      const value = searchParams.get(param);
      if (value !== null) {
        if (key === 'ownedByMultipleTeams') {
          initialFilters[key] = value === 'true';
        } else if (key === 'page' || key === 'pageSize') {
          initialFilters[key] = parseInt(value, 10) || defaultFilters[key];
        } else {
          (initialFilters as any)[key] = value;
        }
      }
    });

    setFilters(initialFilters);
  }, [searchParams]);

  // Update URL when filters change
  useEffect(() => {
    const newSearchParams = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      const param = urlParamMap[key as keyof PlayerFilterState];
      const defaultValue = defaultFilters[key as keyof PlayerFilterState];

      // Only add to URL if different from default
      if (value !== defaultValue) {
        newSearchParams.set(param, String(value));
      }
    });

    setSearchParams(newSearchParams, { replace: true });
  }, [filters, setSearchParams]);

  const updateFilter = useCallback((key: keyof PlayerFilterState, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      // Reset page when changing filters (except page itself)
      ...(key !== 'page' && key !== 'pageSize' ? { page: 1 } : {})
    }));
  }, []);

  const updateFilters = useCallback((updates: Partial<PlayerFilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...updates,
      // Reset page when changing filters
      ...(!updates.page && !updates.pageSize ? { page: 1 } : {})
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const resetPagination = useCallback(() => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, []);

  const exportFilters = useCallback(() => {
    return JSON.stringify(filters);
  }, [filters]);

  const importFilters = useCallback((filterString: string) => {
    try {
      const importedFilters = JSON.parse(filterString);
      setFilters({ ...defaultFilters, ...importedFilters });
    } catch (error) {
      console.error('Failed to import filters:', error);
    }
  }, []);

  const getFilterCount = useCallback(() => {
    return Object.entries(filters).filter(([key, value]) => {
      const defaultValue = defaultFilters[key as keyof PlayerFilterState];
      return value !== defaultValue;
    }).length;
  }, [filters]);

  const value: PlayerFilterContextType = {
    filters,
    debouncedSearch,
    updateFilter,
    updateFilters,
    clearFilters,
    resetPagination,
    exportFilters,
    importFilters,
    getFilterCount
  };

  return (
    <PlayerFilterContext.Provider value={value}>
      {children}
    </PlayerFilterContext.Provider>);

};