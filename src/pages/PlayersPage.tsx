import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { fetchPlayersFromApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { SleeperApiService, SleeperPlayerResearch } from '@/services/sleeperApi';
import { UserCheck, Search, Filter, ExternalLink, Loader2, ChevronLeft, ChevronRight, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const PlayersPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  const [apiPlayers, setApiPlayers] = useState<any[]>([]); // Holds the current page of players
  const [totalCount, setTotalCount] = useState(0);   // Total players for pagination
  const [currentPage, setCurrentPage] = useState(1); // For pagination controls
  const pageSize = 50; // Players per page
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('free_agent');
  const [nflTeamFilter, setNflTeamFilter] = useState<string>('all');
  const [seasonFilter, setSeasonFilter] = useState<string>(selectedSeason.toString());
  const [teamLookup, setTeamLookup] = useState<Map<number, string>>(new Map());
  const [teamNameToIdLookup, setTeamNameToIdLookup] = useState<Map<string, number>>(new Map());
  const [activeTab, setActiveTab] = useState('all-players');
  const [ownershipData, setOwnershipData] = useState<SleeperPlayerResearch>({});
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [cachedPlayers, setCachedPlayers] = useState<any[]>([]);
  const [cacheKey, setCacheKey] = useState<string>('');
  const [sortTrigger, setSortTrigger] = useState<number>(0);

  const positions = ['QB', 'RB', 'WR', 'TE'];
  const nflTeams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'];
  const seasons = ['2020', '2021', '2022', '2023', '2024', '2025'];

  // Function to handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending for numerical values
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Function to render sort icon
  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Function to generate cache key based on filters (excluding sort)
  const generateCacheKey = (filters: any) => {
    return JSON.stringify({
      search: filters.search,
      position: filters.position,
      is_rostered: filters.is_rostered,
      nfl_team: filters.nfl_team,
    });
  };

  // Function to fetch all filtered data with pagination workaround
  const fetchAllFilteredData = async (filters: any) => {
    let allData: any[] = [];
    let page = 1;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, count } = await fetchPlayersFromApi(filters, page, batchSize);
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        hasMore = data.length === batchSize; // Continue if we got a full batch
        page++;
      } else {
        hasMore = false;
      }
      
      // Safety check to prevent infinite loops
      if (page > 10) {
        console.warn('Reached maximum page limit, stopping fetch');
        break;
      }
    }

    return { data: allData, count: allData.length };
  };

  // Function to fetch ownership data
  const fetchOwnershipData = async () => {
    setOwnershipLoading(true);
    try {
      // Get current NFL state to determine week and season
      const nflState = await SleeperApiService.getNFLState();
      const currentWeek = nflState.week === 0 ? 1 : nflState.week; // Use week 1 if current week is 0
      const currentSeason = nflState.season;

      console.log(`Fetching ownership data for season ${currentSeason}, week ${currentWeek}`);
      
      const research = await SleeperApiService.fetchPlayerResearch('regular', currentSeason, currentWeek);
      setOwnershipData(research);
      
      toast({
        title: 'Ownership Data Loaded',
        description: `Loaded ownership percentages for week ${currentWeek}`
      });
    } catch (error) {
      console.error('Error fetching ownership data:', error);
      toast({
        title: 'Error Loading Ownership Data',
        description: 'Could not load player ownership percentages',
        variant: 'destructive'
      });
    } finally {
      setOwnershipLoading(false);
    }
  };

  // Load team data for team name lookup
  useEffect(() => {
    const loadTeamData = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, team_name');

        if (error) {
          console.error('Error loading teams:', error);
          return;
        }

        const lookup = new Map();
        const nameToIdLookup = new Map();
        (data || []).forEach(team => {
          lookup.set(team.id, team.team_name);
          nameToIdLookup.set(team.team_name, team.id);
        });
        setTeamLookup(lookup);
        setTeamNameToIdLookup(nameToIdLookup);
      } catch (err) {
        console.error('Error setting up team lookup:', err);
      }
    };

    loadTeamData();
  }, []);

  // Load ownership data
  useEffect(() => {
    fetchOwnershipData();
  }, []);

  // Auto-sort by ownership percentage when ownership data is loaded and cache is created
  useEffect(() => {
    if (Object.keys(ownershipData).length > 0 && cachedPlayers.length > 0 && sortField === '') {
      console.log('Auto-setting sort to ownership');
      setSortField('ownership');
      setSortDirection('desc');
    }
  }, [ownershipData, cachedPlayers, sortField]);

  // Force re-render when ownership data loads and we're sorting by ownership
  useEffect(() => {
    if (Object.keys(ownershipData).length > 0 && sortField === 'ownership') {
      console.log('Ownership data loaded, re-triggering sort');
      setSortTrigger(prev => prev + 1);
    }
  }, [ownershipData, sortField]);

  // New API-based data fetching
  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      setError(null);

      try {
        // Prepare filters from component state (excluding sort for cache key)
        const filters = {
          search: searchTerm,
          position: positionFilter,
          is_rostered: statusFilter === 'rostered' ? true : (statusFilter === 'free_agent' ? false : ''),
          nfl_team: nflTeamFilter === 'all' ? '' : nflTeamFilter,
          // season: seasonFilter, // TODO: Season filtering not implemented yet - placeholder only
          sort_field: sortField,
          sort_direction: sortDirection,
        };

        const currentCacheKey = generateCacheKey(filters);
        let allFilteredData = cachedPlayers;

        // Check if we need to refresh the cache (filters changed)
        if (cacheKey !== currentCacheKey || cachedPlayers.length === 0) {
          console.log('Cache miss - fetching all filtered data...');
          
          // Fetch all data for the current filters
          const { data: fetchedData, count } = await fetchAllFilteredData({
            ...filters,
            sort_field: '', // Don't sort at database level when caching
            sort_direction: 'desc'
          });
          
          allFilteredData = fetchedData;
          setCachedPlayers(fetchedData);
          setCacheKey(currentCacheKey);
          
          console.log(`Cached ${fetchedData.length} players for filters:`, currentCacheKey);
        } else {
          console.log('Cache hit - using cached data');
        }

        // Now sort the cached data based on current sort settings
        let sortedData = [...allFilteredData];
        
        if (sortField === 'ownership') {
          // Sort by ownership - only if ownership data is available
          if (Object.keys(ownershipData).length > 0) {
            sortedData.sort((a, b) => {
              const aOwnership = ownershipData[a.sleeper_id]?.owned || 0;
              const bOwnership = ownershipData[b.sleeper_id]?.owned || 0;
              
              if (sortDirection === 'asc') {
                return aOwnership - bOwnership;
              } else {
                return bOwnership - aOwnership;
              }
            });
          } else {
            // If ownership data isn't loaded yet, fall back to default sort
            sortedData.sort((a, b) => b.total_points - a.total_points);
          }
        } else if (sortField === 'total_points') {
          // Sort by total points
          sortedData.sort((a, b) => {
            if (sortDirection === 'asc') {
              return a.total_points - b.total_points;
            } else {
              return b.total_points - a.total_points;
            }
          });
        } else if (sortField === 'avg_points') {
          // Sort by average points
          sortedData.sort((a, b) => {
            if (sortDirection === 'asc') {
              return a.avg_points - b.avg_points;
            } else {
              return b.avg_points - a.avg_points;
            }
          });
        } else if (sortField === '') {
          // Default sort by total points descending
          sortedData.sort((a, b) => b.total_points - a.total_points);
        }

        // Apply pagination to sorted data
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = sortedData.slice(startIndex, endIndex);
        
        setApiPlayers(paginatedData);
        setTotalCount(sortedData.length);
        
        toast({
          title: 'Players Loaded',
          description: `Found ${sortedData.length} players for ${seasonFilter} season${sortField ? ` (sorted by ${sortField})` : ''}`
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch players';
        setError(errorMessage);
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, [searchTerm, positionFilter, statusFilter, nflTeamFilter, sortField, sortDirection, currentPage, selectedSeason, selectedConference, sortTrigger]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusBadge = (isRostered: boolean, injuryStatus: string | null) => {
    if (injuryStatus) {
      const variants: {[key: string]: 'default' | 'destructive' | 'secondary' | 'outline';} = {
        'IR': 'destructive',
        'O': 'destructive',
        'D': 'destructive',
        'Q': 'secondary',
        'P': 'outline'
      };
      return <Badge variant={variants[injuryStatus] || 'outline'} className="text-xs">{injuryStatus}</Badge>;
    }

    if (isRostered) {
      return <Badge variant="default" className="text-xs">Rostered</Badge>;
    }
    return <Badge variant="outline" className="text-xs">FA</Badge>;
  };

  const getOwnershipPercentage = (sleeperId: string): string => {
    if (!ownershipData[sleeperId]) {
      return '-';
    }
    const owned = ownershipData[sleeperId].owned;
    return `${owned.toFixed(1)}%`;
  };

  const renderRosteredByTeams = (rosteredByTeams: any) => {
    if (!rosteredByTeams || rosteredByTeams.length === 0) {
      return null; // Show nothing for free agents instead of "N/A"
    }

    return (
      <div className="flex flex-col gap-1">
        {rosteredByTeams.map((teamData: any, index: number) => {
          let teamId: number;
          let teamName: string;
          
          // Handle both cases: team IDs (numbers) or team names (strings)
          if (typeof teamData === 'number') {
            // If it's a number, it's a team ID
            teamId = teamData;
            teamName = teamLookup.get(teamId) || `Team ${teamId}`;
          } else if (typeof teamData === 'string') {
            // If it's a string, it's a team name - look up the ID
            teamName = teamData;
            teamId = teamNameToIdLookup.get(teamName) || 0;
          } else {
            // Fallback for unexpected data structure
            console.warn('Unexpected team data structure:', teamData);
            return null;
          }

          // Only render if we have a valid team ID
          if (teamId === 0) {
            console.warn(`Could not find team ID for team name: ${teamName}`);
            return (
              <Badge key={index} variant="outline" className="text-xs">
                {teamName}
              </Badge>
            );
          }

          return (
            <Link key={teamId} to={`/teams/${teamId}`}>
              <Badge 
                variant="outline" 
                className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
              >
                {teamName}
              </Badge>
            </Link>
          );
        })}
      </div>
    );
  };

  if (loading && apiPlayers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Loading Players</h2>
          <p className="text-muted-foreground">Fetching player data...</p>
        </div>
      </div>
    );
  }

  if (error && apiPlayers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              Error Loading Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // This is the corrected JSX for the PlayerPage component.
// Replace your entire existing `return (...)` block with this.

return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Players</h1>
        </div>
        <p className="text-muted-foreground">
          {seasonFilter} Season • {totalCount} players
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all-players" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            All Players
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending Players
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-players" className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>

            {/* Position Filter */}
            <Select value={positionFilter} onValueChange={(value) => { setPositionFilter(value); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All Positions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                {positions.map((pos) => (<SelectItem key={pos} value={pos}>{pos}</SelectItem>))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="rostered">Rostered</SelectItem>
                <SelectItem value="free_agent">Free Agent</SelectItem>
              </SelectContent>
            </Select>

            {/* NFL Team Filter */}
            <Select value={nflTeamFilter} onValueChange={(value) => { setNflTeamFilter(value); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All Teams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {nflTeams.map((team) => (<SelectItem key={team} value={team}>{team}</SelectItem>))}
              </SelectContent>
            </Select>

            {/* Season Filter */}
            <Select value={seasonFilter} onValueChange={(value) => { setSeasonFilter(value); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Season" /></SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (<SelectItem key={season} value={season}>{season}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {/* Players Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">Pos</TableHead>
                      <TableHead 
                        className="text-center hidden md:table-cell cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('ownership')}
                      >
                        <div className="flex items-center justify-center">
                          Own%
                          {renderSortIcon('ownership')}
                        </div>
                      </TableHead>
                      <TableHead className="text-center hidden sm:table-cell">NFL Team</TableHead>
                      <TableHead 
                        className="text-center cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('total_points')}
                      >
                        <div className="flex items-center justify-center">
                          Points
                          {renderSortIcon('total_points')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-center hidden md:table-cell cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort('avg_points')}
                      >
                        <div className="flex items-center justify-center">
                          Avg
                          {renderSortIcon('avg_points')}
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Rostered By</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : apiPlayers.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8">No players found.</TableCell></TableRow>
                    ) : (
                      apiPlayers.map((player) => (
                        <TableRow key={player.id}>
                          <TableCell>
                            {/* CORRECTED: The API sends 'player_name', not 'full_name' */}
                            <div className="font-medium">{player.player_name}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getPositionColor(player.position)}>{player.position}</Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono hidden md:table-cell">
                            {ownershipLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              getOwnershipPercentage(player.sleeper_id)
                            )}
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell">{player.nfl_team || 'FA'}</TableCell>
                          <TableCell className="text-center font-mono">
                            {/* This is safe because the VIEW guarantees a number */}
                            {player.total_points.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center font-mono hidden md:table-cell">
                            {player.avg_points.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(player.is_rostered, player.injury_status)}
                          </TableCell>
                          <TableCell className="text-center hidden lg:table-cell">
                            {renderRosteredByTeams(player.rostered_by_teams)}
                          </TableCell>
                          <TableCell>
                            <Link to={`/players/${player.sleeper_id}`}>
                              <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min(((currentPage - 1) * pageSize) + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} players
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage * pageSize >= totalCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trending Players (Last 24 Hours)
              </CardTitle>
              <CardDescription>
                Most added players across all Sleeper leagues in the past 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <iframe 
                src="https://sleeper.app/embed/players/nfl/trending/add?lookback_hours=24&limit=25" 
                width="350" 
                height="500" 
                allowTransparency={true}
                frameBorder="0"
                className="rounded-lg border"
                title="Trending Players"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayersPage;
