import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserCheck, Filter, Search, Download, RefreshCw, Keyboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';
import { PlayerFilterProvider, usePlayerFilters } from '@/contexts/PlayerFilterContext';
import { useKeyboardShortcuts, playerPageShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePlayersData, usePlayerSearch } from '@/hooks/useRealTimePlayerData';
import PlayerSearchBar from '@/components/players/PlayerSearchBar';
import PlayerFilters from '@/components/players/PlayerFilters';
import PlayerTable from '@/components/players/PlayerTable';
import PlayerExport from '@/components/players/PlayerExport';
import PlayerStatsCards from '@/components/players/PlayerStatsCards';

// Mock data for demonstration - will be replaced with real API data
const mockPlayersData = [
  {
    id: 'player1',
    name: 'Josh Allen',
    position: 'QB',
    nflTeam: 'BUF',
    points: 287.5,
    avgPoints: 22.1,
    projectedPoints: 24.8,
    status: 'rostered',
    rosteredBy: 'Galactic Gladiators',
    rosteredByOwner: 'John Doe',
    injuryStatus: null,
    gamesPlayed: 13,
    age: 28,
    draftPosition: 12,
    experience: 6,
    conference: 'mars',
    isOwnedByMultipleTeams: false
  },
  {
    id: 'player2',
    name: 'Christian McCaffrey',
    position: 'RB',
    nflTeam: 'SF',
    points: 245.8,
    avgPoints: 18.9,
    projectedPoints: 0,
    status: 'rostered',
    rosteredBy: 'Galactic Gladiators',
    rosteredByOwner: 'John Doe',
    injuryStatus: 'IR',
    gamesPlayed: 13,
    age: 28,
    draftPosition: 3,
    experience: 7,
    conference: 'mars',
    isOwnedByMultipleTeams: false
  },
  {
    id: 'player3',
    name: 'Tyreek Hill',
    position: 'WR',
    nflTeam: 'MIA',
    points: 198.2,
    avgPoints: 15.2,
    projectedPoints: 16.4,
    status: 'rostered',
    rosteredBy: 'Space Vikings',
    rosteredByOwner: 'Jane Smith',
    injuryStatus: null,
    gamesPlayed: 13,
    age: 30,
    draftPosition: 18,
    experience: 8,
    conference: 'jupiter',
    isOwnedByMultipleTeams: false
  },
  {
    id: 'player4',
    name: 'Saquon Barkley',
    position: 'RB',
    nflTeam: 'PHI',
    points: 234.6,
    avgPoints: 18.0,
    projectedPoints: 18.5,
    status: 'free_agent',
    rosteredBy: null,
    rosteredByOwner: null,
    injuryStatus: null,
    gamesPlayed: 13,
    age: 27,
    draftPosition: 5,
    experience: 6,
    conference: null,
    isOwnedByMultipleTeams: false
  },
  {
    id: 'player5',
    name: 'Cooper Kupp',
    position: 'WR',
    nflTeam: 'LAR',
    points: 156.8,
    avgPoints: 14.2,
    projectedPoints: 15.8,
    status: 'rostered',
    rosteredBy: 'Meteor Crushers',
    rosteredByOwner: 'Bob Johnson',
    injuryStatus: 'Q',
    gamesPlayed: 11,
    age: 31,
    draftPosition: 24,
    experience: 7,
    conference: 'vulcan',
    isOwnedByMultipleTeams: false
  },
  {
    id: 'player6',
    name: 'Travis Kelce',
    position: 'TE',
    nflTeam: 'KC',
    points: 189.4,
    avgPoints: 14.6,
    projectedPoints: 15.2,
    status: 'rostered',
    rosteredBy: 'Nebula Warriors',
    rosteredByOwner: 'Sarah Wilson',
    injuryStatus: null,
    gamesPlayed: 13,
    age: 35,
    draftPosition: 31,
    experience: 11,
    conference: 'mars',
    isOwnedByMultipleTeams: true
  },
  {
    id: 'player7',
    name: 'Myles Garrett',
    position: 'DL',
    nflTeam: 'CLE',
    points: 98.5,
    avgPoints: 7.6,
    projectedPoints: 8.1,
    status: 'rostered',
    rosteredBy: 'Cosmic Defenders',
    rosteredByOwner: 'Mike Davis',
    injuryStatus: null,
    gamesPlayed: 13,
    age: 29,
    draftPosition: 89,
    experience: 7,
    conference: 'jupiter',
    isOwnedByMultipleTeams: false
  },
  {
    id: 'player8',
    name: 'Micah Parsons',
    position: 'LB',
    nflTeam: 'DAL',
    points: 112.8,
    avgPoints: 8.7,
    projectedPoints: 9.2,
    status: 'rostered',
    rosteredBy: 'Star Destroyers',
    rosteredByOwner: 'Lisa Brown',
    injuryStatus: null,
    gamesPlayed: 13,
    age: 25,
    draftPosition: 67,
    experience: 3,
    conference: 'vulcan',
    isOwnedByMultipleTeams: false
  },
  {
    id: 'player9',
    name: 'Trevon Diggs',
    position: 'DB',
    nflTeam: 'DAL',
    points: 87.3,
    avgPoints: 6.7,
    projectedPoints: 7.1,
    status: 'free_agent',
    rosteredBy: null,
    rosteredByOwner: null,
    injuryStatus: null,
    gamesPlayed: 13,
    age: 26,
    draftPosition: 156,
    experience: 4,
    conference: null,
    isOwnedByMultipleTeams: false
  }
];

// Generate more mock data for demonstration
const generateMockPlayers = (count: number) => {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];
  const teams = ['BUF', 'MIA', 'NYJ', 'NE', 'KC', 'LAC', 'LV', 'DEN', 'DAL', 'NYG', 'PHI', 'WAS'];
  const conferences = ['mars', 'jupiter', 'vulcan'];
  const statuses = ['rostered', 'free_agent'];
  const injuries = [null, 'Q', 'D', 'IR', 'O'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `player${i + 10}`,
    name: `Player ${i + 10}`,
    position: positions[i % positions.length],
    nflTeam: teams[i % teams.length],
    points: Math.random() * 300,
    avgPoints: Math.random() * 20,
    projectedPoints: Math.random() * 25,
    status: statuses[i % statuses.length],
    rosteredBy: i % 3 === 0 ? null : `Team ${i % 10}`,
    rosteredByOwner: i % 3 === 0 ? null : `Owner ${i % 10}`,
    injuryStatus: injuries[i % injuries.length],
    gamesPlayed: Math.floor(Math.random() * 17) + 1,
    age: Math.floor(Math.random() * 15) + 20,
    draftPosition: Math.floor(Math.random() * 200) + 1,
    experience: Math.floor(Math.random() * 15) + 1,
    conference: i % 4 === 0 ? null : conferences[i % conferences.length],
    isOwnedByMultipleTeams: Math.random() > 0.9
  }));
};

const allMockData = [...mockPlayersData, ...generateMockPlayers(500)];

interface PlayersPageContentProps {}

const PlayersPageContent: React.FC<PlayersPageContentProps> = () => {
  const { selectedSeason, selectedConference } = useApp();
  const { toast } = useToast();
  const { filters, debouncedSearch, updateFilter, clearFilters } = usePlayerFilters();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Real-time data hooks (commented out for now, using mock data)
  // const { data: playersData, isLoading, error, refetch } = usePlayersData();
  // const { data: searchResults } = usePlayerSearch({
  //   name: debouncedSearch,
  //   position: filters.position !== 'all' ? filters.position : undefined,
  //   team: filters.nflTeam !== 'all' ? filters.nflTeam : undefined,
  //   status: filters.availabilityStatus !== 'all' ? filters.availabilityStatus : undefined
  // });

  // Mock data for demonstration
  const isLoading = false;
  const error = null;

  // Filter players based on current filters
  const filteredPlayers = useMemo(() => {
    let filtered = allMockData;

    // Search filter
    if (debouncedSearch) {
      const searchTerm = debouncedSearch.toLowerCase();
      filtered = filtered.filter(player =>
        player.name.toLowerCase().includes(searchTerm) ||
        player.nflTeam.toLowerCase().includes(searchTerm) ||
        player.rosteredBy?.toLowerCase().includes(searchTerm) ||
        player.rosteredByOwner?.toLowerCase().includes(searchTerm)
      );
    }

    // Position filter
    if (filters.position !== 'all') {
      if (filters.position === 'offense') {
        filtered = filtered.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
      } else if (filters.position === 'defense') {
        filtered = filtered.filter(p => ['DEF', 'DL', 'LB', 'DB'].includes(p.position));
      } else {
        filtered = filtered.filter(p => p.position === filters.position);
      }
    }

    // NFL Team filter
    if (filters.nflTeam !== 'all') {
      filtered = filtered.filter(p => p.nflTeam === filters.nflTeam);
    }

    // Conference filter
    if (filters.conference !== 'all') {
      filtered = filtered.filter(p => p.conference === filters.conference);
    }

    // Availability filter
    if (filters.availabilityStatus !== 'all') {
      if (filters.availabilityStatus === 'available') {
        filtered = filtered.filter(p => p.status === 'free_agent');
      } else if (filters.availabilityStatus === 'owned') {
        filtered = filtered.filter(p => p.status === 'rostered');
      }
    }

    // Injury filter
    if (filters.injuryStatus !== 'all') {
      if (filters.injuryStatus === 'healthy') {
        filtered = filtered.filter(p => !p.injuryStatus);
      } else {
        filtered = filtered.filter(p => p.injuryStatus === filters.injuryStatus);
      }
    }

    // Multi-owned filter
    if (filters.ownedByMultipleTeams) {
      filtered = filtered.filter(p => p.isOwnedByMultipleTeams);
    }

    return filtered;
  }, [debouncedSearch, filters]);

  // Generate search suggestions
  const searchSuggestions = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) return [];
    
    const suggestions = [];
    const searchTerm = debouncedSearch.toLowerCase();
    
    // Player suggestions
    const playerMatches = allMockData
      .filter(p => p.name.toLowerCase().includes(searchTerm))
      .slice(0, 5)
      .map(p => ({
        type: 'player' as const,
        value: p.name,
        label: p.name,
        meta: `${p.position} - ${p.nflTeam}`
      }));
    
    // Team suggestions
    const teamMatches = [...new Set(allMockData.map(p => p.nflTeam))]
      .filter(team => team.toLowerCase().includes(searchTerm))
      .slice(0, 3)
      .map(team => ({
        type: 'team' as const,
        value: team,
        label: team,
        meta: 'NFL Team'
      }));
    
    // Owner suggestions
    const ownerMatches = [...new Set(allMockData.map(p => p.rosteredByOwner).filter(Boolean))]
      .filter(owner => owner!.toLowerCase().includes(searchTerm))
      .slice(0, 3)
      .map(owner => ({
        type: 'owner' as const,
        value: owner!,
        label: owner!,
        meta: 'Owner'
      }));
    
    return [...playerMatches, ...teamMatches, ...ownerMatches];
  }, [debouncedSearch]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // In real implementation, this would call refetch()
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Data refreshed",
        description: "Player data has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh player data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...playerPageShortcuts.SEARCH_FOCUS,
      handler: () => searchRef.current?.focus()
    },
    {
      ...playerPageShortcuts.CLEAR_FILTERS,
      handler: () => clearFilters()
    },
    {
      ...playerPageShortcuts.FILTER_AVAILABLE,
      handler: () => updateFilter('availabilityStatus', 'available')
    },
    {
      ...playerPageShortcuts.FILTER_OWNED,
      handler: () => updateFilter('availabilityStatus', 'owned')
    },
    {
      ...playerPageShortcuts.NEXT_PAGE,
      handler: () => updateFilter('page', Math.min(filters.page + 1, Math.ceil(filteredPlayers.length / filters.pageSize)))
    },
    {
      ...playerPageShortcuts.PREV_PAGE,
      handler: () => updateFilter('page', Math.max(filters.page - 1, 1))
    }
  ]);

  // Generate filter description for export
  const filterDescription = useMemo(() => {
    const parts = [];
    if (filters.search) parts.push(`Search: "${filters.search}"`);
    if (filters.position !== 'all') parts.push(`Position: ${filters.position}`);
    if (filters.nflTeam !== 'all') parts.push(`NFL Team: ${filters.nflTeam}`);
    if (filters.conference !== 'all') parts.push(`Conference: ${filters.conference}`);
    if (filters.availabilityStatus !== 'all') parts.push(`Status: ${filters.availabilityStatus}`);
    if (filters.ownedByMultipleTeams) parts.push('Multi-owned only');
    return parts.length > 0 ? parts.join(', ') : 'No filters applied';
  }, [filters]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div className="flex items-center space-x-3">
          <UserCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Players</h1>
            <p className="text-muted-foreground">
              {selectedSeason} Season • {filteredPlayers.length} of {allMockData.length} players
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
          >
            <Keyboard className="h-4 w-4 mr-2" />
            Shortcuts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <PlayerExport
            players={filteredPlayers}
            totalCount={allMockData.length}
            filterDescription={filterDescription}
          />
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      {showKeyboardShortcuts && (
        <Alert>
          <Keyboard className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap gap-4 mt-2">
            <Badge variant="outline">Ctrl+F: Focus search</Badge>
            <Badge variant="outline">Ctrl+R: Clear filters</Badge>
            <Badge variant="outline">Ctrl+A: Filter available</Badge>
            <Badge variant="outline">Ctrl+O: Filter owned</Badge>
            <Badge variant="outline">Ctrl+←/→: Navigate pages</Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <div className="max-w-2xl">
        <PlayerSearchBar
          suggestions={searchSuggestions}
          onFocus={() => {}}
        />
      </div>

      {/* Filters */}
      <PlayerFilters
        showAdvanced={true}
        onExport={() => toast({ title: "Filter exported", description: "Filter configuration copied to clipboard" })}
        onImport={() => toast({ title: "Filter imported", description: "Filter configuration loaded from clipboard" })}
      />

      {/* Stats Cards */}
      <PlayerStatsCards
        players={filteredPlayers}
        totalCount={allMockData.length}
        isLoading={isLoading}
      />

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Player Table */}
      <PlayerTable
        players={filteredPlayers}
        isLoading={isLoading}
        error={error}
        enableVirtualization={filteredPlayers.length > 100}
      />
    </div>
  );
};

const PlayersPage: React.FC = () => {
  return (
    <PlayerFilterProvider>
      <PlayersPageContent />
    </PlayerFilterProvider>
  );
};

export default PlayersPage;
