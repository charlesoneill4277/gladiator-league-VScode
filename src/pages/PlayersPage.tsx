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

// Interface for component Player data (mapped from database)
interface Player {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  points: number;
  avgPoints: number;
  projectedPoints: number;
  status: string;
  rosteredBy: string | null;
  rosteredByOwner: string | null;
  injuryStatus: string | null;
  gamesPlayed: number;
  age?: number;
  draftPosition?: number;
  experience?: number;
  conference?: string;
  isOwnedByMultipleTeams?: boolean;
}

interface PlayersPageContentProps {}

const PlayersPageContent: React.FC<PlayersPageContentProps> = () => {
  const { selectedSeason, selectedConference } = useApp();
  const { toast } = useToast();
  const { filters, debouncedSearch, updateFilter, clearFilters } = usePlayerFilters();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Real-time data hooks
  const { data: playersData, isLoading, error, refetch } = usePlayersData();
  const { data: searchResults } = usePlayerSearch({
    name: debouncedSearch,
    position: filters.position !== 'all' ? filters.position : undefined,
    team: filters.nflTeam !== 'all' ? filters.nflTeam : undefined,
    status: filters.availabilityStatus !== 'all' ? filters.availabilityStatus : undefined
  });

  // Map database PlayerData to component Player interface
  const mapPlayerData = (dbPlayer: any): Player => {
    return {
      id: dbPlayer.id?.toString() || dbPlayer.sleeper_player_id,
      name: dbPlayer.player_name || dbPlayer.name || 'Unknown Player',
      position: dbPlayer.position || 'UNK',
      nflTeam: dbPlayer.nfl_team || 'FA',
      points: 0, // This would need to be calculated from stats
      avgPoints: 0, // This would need to be calculated from stats
      projectedPoints: 0, // This would need to be calculated from projections
      status: dbPlayer.status === 'Active' ? 'free_agent' : 'inactive',
      rosteredBy: null, // This would need to be joined with roster data
      rosteredByOwner: null, // This would need to be joined with owner data
      injuryStatus: dbPlayer.injury_status === 'Healthy' ? null : dbPlayer.injury_status,
      gamesPlayed: 0, // This would need to be calculated from stats
      age: dbPlayer.age || 0,
      draftPosition: 0, // This would need to come from draft data
      experience: dbPlayer.years_experience || 0,
      conference: null, // This would need to be determined from roster data
      isOwnedByMultipleTeams: false // This would need to be calculated from roster data
    };
  };

  // Convert database players to component format
  const players = useMemo(() => {
    if (!playersData) return [];
    return playersData.map(mapPlayerData);
  }, [playersData]);

  // Filter players based on current filters
  const filteredPlayers = useMemo(() => {
    let filtered = players;

    // Search filter
    if (debouncedSearch) {
      const searchTerm = debouncedSearch.toLowerCase();
      filtered = filtered.filter((player) =>
      player.name.toLowerCase().includes(searchTerm) ||
      player.nflTeam.toLowerCase().includes(searchTerm) ||
      player.rosteredBy?.toLowerCase().includes(searchTerm) ||
      player.rosteredByOwner?.toLowerCase().includes(searchTerm)
      );
    }

    // Position filter
    if (filters.position !== 'all') {
      if (filters.position === 'offense') {
        filtered = filtered.filter((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
      } else if (filters.position === 'defense') {
        // No defense players should be shown based on requirements
        filtered = [];
      } else {
        filtered = filtered.filter((p) => p.position === filters.position);
      }
    }

    // NFL Team filter
    if (filters.nflTeam !== 'all') {
      filtered = filtered.filter((p) => p.nflTeam === filters.nflTeam);
    }

    // Conference filter
    if (filters.conference !== 'all') {
      filtered = filtered.filter((p) => p.conference === filters.conference);
    }

    // Availability filter
    if (filters.availabilityStatus !== 'all') {
      if (filters.availabilityStatus === 'available') {
        filtered = filtered.filter((p) => p.status === 'free_agent');
      } else if (filters.availabilityStatus === 'owned') {
        filtered = filtered.filter((p) => p.status === 'rostered');
      }
    }

    // Injury filter
    if (filters.injuryStatus !== 'all') {
      if (filters.injuryStatus === 'healthy') {
        filtered = filtered.filter((p) => !p.injuryStatus);
      } else {
        filtered = filtered.filter((p) => p.injuryStatus === filters.injuryStatus);
      }
    }

    // Multi-owned filter
    if (filters.ownedByMultipleTeams) {
      filtered = filtered.filter((p) => p.isOwnedByMultipleTeams);
    }

    return filtered;
  }, [players, debouncedSearch, filters]);

  // Generate search suggestions from real data
  const searchSuggestions = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) return [];

    const suggestions = [];
    const searchTerm = debouncedSearch.toLowerCase();

    // Player suggestions
    const playerMatches = players.
    filter((p) => p.name.toLowerCase().includes(searchTerm)).
    slice(0, 5).
    map((p) => ({
      type: 'player' as const,
      value: p.name,
      label: p.name,
      meta: `${p.position} - ${p.nflTeam}`
    }));

    // Team suggestions
    const teamMatches = [...new Set(players.map((p) => p.nflTeam))].
    filter((team) => team.toLowerCase().includes(searchTerm)).
    slice(0, 3).
    map((team) => ({
      type: 'team' as const,
      value: team,
      label: team,
      meta: 'NFL Team'
    }));

    // Owner suggestions
    const ownerMatches = [...new Set(players.map((p) => p.rosteredByOwner).filter(Boolean))].
    filter((owner) => owner!.toLowerCase().includes(searchTerm)).
    slice(0, 3).
    map((owner) => ({
      type: 'owner' as const,
      value: owner!,
      label: owner!,
      meta: 'Owner'
    }));

    return [...playerMatches, ...teamMatches, ...ownerMatches];
  }, [debouncedSearch, players]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
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
  }]
  );

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

  // Show error alert if there's an error
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : 'An error occurred while loading player data.'}
          </AlertDescription>
        </Alert>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Try Again
        </Button>
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div className="flex items-center space-x-3">
          <UserCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Players</h1>
            <p className="text-muted-foreground">
              {selectedSeason} Season • {filteredPlayers.length} of {players.length} players
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}>
            <Keyboard className="h-4 w-4 mr-2" />
            Shortcuts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <PlayerExport
            players={filteredPlayers}
            totalCount={players.length}
            filterDescription={filterDescription} />
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      {showKeyboardShortcuts &&
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
      }

      {/* Search Bar */}
      <div className="max-w-2xl">
        <PlayerSearchBar
          suggestions={searchSuggestions}
          onFocus={() => {}} />
      </div>

      {/* Filters */}
      <PlayerFilters
        showAdvanced={true}
        onExport={() => toast({ title: "Filter exported", description: "Filter configuration copied to clipboard" })}
        onImport={() => toast({ title: "Filter imported", description: "Filter configuration loaded from clipboard" })} />

      {/* Stats Cards */}
      <PlayerStatsCards
        players={filteredPlayers}
        totalCount={players.length}
        isLoading={isLoading} />

      {/* Error Display */}
      {error &&
      <Alert variant="destructive">
          <AlertDescription>{error instanceof Error ? error.message : 'An error occurred.'}</AlertDescription>
        </Alert>
      }

      {/* Player Table */}
      <PlayerTable
        players={filteredPlayers}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : undefined}
        enableVirtualization={filteredPlayers.length > 100} />
    </div>);

};

const PlayersPage: React.FC = () => {
  return (
    <PlayerFilterProvider>
      <PlayersPageContent />
    </PlayerFilterProvider>);

};

export default PlayersPage;