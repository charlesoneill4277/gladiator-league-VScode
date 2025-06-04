import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp } from '@/contexts/AppContext';
import { Search, Filter, User, Users, Heart, Activity, Clock, Shield, RefreshCw, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PlayerDetailModal from '@/components/PlayerDetailModal';
import { usePlayerRosterCache, useRosterCacheMetrics } from '@/hooks/usePlayerRosterCache';
import { RosterStatusInfo } from '@/services/playerRosterService';

interface Player {
  id: number;
  player_name: string;
  position: string;
  nfl_team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
  age: number;
  height: string;
  weight: number;
  years_experience: number;
  depth_chart_position: number;
  college: string;
  team_id: number;
  sleeper_player_id: string;
}

interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
}

interface TeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
}

interface PlayerTeamInfo {
  team: Team;
  conference: Conference;
}

interface SleeperRoster {
  owner_id: string;
  roster_id: number;
  players: string[];
}

// RosterStatusInfo is now imported from playerRosterService

const PlayersPage: React.FC = () => {
  const { selectedSeason, selectedConference } = useApp();
  const { toast } = useToast();

  // Core data states
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [teamConferenceJunctions, setTeamConferenceJunctions] = useState<TeamConferenceJunction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [nflTeamFilter, setNflTeamFilter] = useState<string>('all');
  const [weekFilter, setWeekFilter] = useState<string>('14'); // Default to current week
  const [freeAgentFilter, setFreeAgentFilter] = useState(false);
  const [rookieFilter, setRookieFilter] = useState(false);

  // Modal states
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Performance monitoring state
  const [showMetrics, setShowMetrics] = useState(false);

  // Enhanced roster caching with React Query
  const {
    data: rosterData,
    isLoading: isRosterLoading,
    isError: isRosterError,
    isFetching: isRosterFetching,
    refetch: refetchRoster,
    invalidate: invalidateRoster,
    getRosterStatus,
    metrics: rosterMetrics
  } = usePlayerRosterCache(conferences, {
    enabled: conferences.length > 0,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3
  });

  // Cache metrics for debugging
  const { metrics: detailedMetrics, clearAllCaches } = useRosterCacheMetrics();

  // NFL teams for the filter dropdown
  const nflTeams = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB',
  'TEN', 'WSH'];


  // Weeks for the filter dropdown
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  useEffect(() => {
    fetchAllData();
  }, []);

  // Show toast notifications for roster data updates
  useEffect(() => {
    if (isRosterError) {
      toast({
        title: 'Roster Data Error',
        description: 'Failed to load live roster data. Showing cached data if available.',
        variant: 'destructive'
      });
    }
  }, [isRosterError, toast]);

  // Show success toast when roster data is successfully loaded
  useEffect(() => {
    if (rosterData && !isRosterLoading && !isRosterFetching) {
      const playerCount = Object.keys(rosterData).length;
      if (playerCount > 0) {
        console.log(`✅ Roster data loaded: ${playerCount} players tracked`);
      }
    }
  }, [rosterData, isRosterLoading, isRosterFetching]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [playersResponse, teamsResponse, conferencesResponse, junctionsResponse] = await Promise.all([
      // Fetch players
      window.ezsite.apis.tablePage(12870, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'player_name',
        IsAsc: true,
        Filters: [{
          name: 'status',
          op: 'Equal',
          value: 'Active'
        }]
      }),
      // Fetch teams
      window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      }),
      // Fetch conferences
      window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: []
      }),
      // Fetch team-conference junctions
      window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [{
          name: 'is_active',
          op: 'Equal',
          value: true
        }]
      })]
      );

      // Check for errors
      if (playersResponse.error) throw playersResponse.error;
      if (teamsResponse.error) throw teamsResponse.error;
      if (conferencesResponse.error) throw conferencesResponse.error;
      if (junctionsResponse.error) throw junctionsResponse.error;

      // Filter for offensive positions only (QB, RB, WR, TE)
      const offensivePlayers = playersResponse.data.List.filter((player: Player) =>
      ['QB', 'RB', 'WR', 'TE'].includes(player.position)
      );

      setPlayers(offensivePlayers);
      setTeams(teamsResponse.data.List);
      setConferences(conferencesResponse.data.List);
      setTeamConferenceJunctions(junctionsResponse.data.List);

      // Debug logging to help identify the issue
      console.log('Loaded data summary:');
      console.log(`- Players: ${offensivePlayers.length}`);
      console.log(`- Teams: ${teamsResponse.data.List.length}`);
      console.log(`- Conferences: ${conferencesResponse.data.List.length}`);
      console.log(`- Team-Conference Junctions: ${junctionsResponse.data.List.length}`);

      // Sample data for debugging
      console.log('Sample team data:', teamsResponse.data.List.slice(0, 3));
      console.log('Sample conference data:', conferencesResponse.data.List);
      console.log('Sample junction data:', junctionsResponse.data.List.slice(0, 5));

      // Check for players with team assignments
      const rosteredPlayersCount = offensivePlayers.filter((p) => p.team_id !== 0).length;
      console.log(`Players with team assignments: ${rosteredPlayersCount}/${offensivePlayers.length}`);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load player data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Removed old fetchSleeperRosterData - now handled by PlayerRosterService

  // Enhanced roster status function with caching
  const getSleeperRosterStatus = useCallback((sleeperPlayerId: string): RosterStatusInfo => {
    return getRosterStatus(sleeperPlayerId);
  }, [getRosterStatus]);

  // Function to get team and conference info for a player
  const getPlayerTeamInfo = (playerId: number, teamId: number): PlayerTeamInfo[] => {
    // Handle free agents (team_id = 0 or no team found)
    if (teamId === 0) return [];

    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      console.log(`Warning: Player ${playerId} has team_id ${teamId} but no matching team found`);
      return [];
    }

    // Find all conferences this team is active in
    const activeJunctions = teamConferenceJunctions.filter(
      (junction) => junction.team_id === teamId && junction.is_active
    );

    if (activeJunctions.length === 0) {
      console.log(`Warning: Team ${team.team_name} (ID: ${teamId}) is not active in any conferences`);
      return [];
    }

    return activeJunctions.map((junction) => {
      const conference = conferences.find((c) => c.id === junction.conference_id);
      if (!conference) {
        console.log(`Warning: Junction references conference ID ${junction.conference_id} but conference not found`);
        return null;
      }
      return {
        team,
        conference
      };
    }).filter((info): info is PlayerTeamInfo => info !== null);
  };

  // Function to get conference color for badges
  const getConferenceColor = (conferenceName: string) => {
    switch (conferenceName) {
      case 'The Legions of Mars':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'The Guardians of Jupiter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case "Vulcan's Oathsworn":
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      // Search filter
      const searchMatch = searchTerm === '' ||
      player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.nfl_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.college.toLowerCase().includes(searchTerm.toLowerCase());

      // NFL team filter
      const nflTeamMatch = nflTeamFilter === 'all' || player.nfl_team === nflTeamFilter;

      // Free agent filter - check Sleeper data first, then fallback to database
      const sleeperStatus = getSleeperRosterStatus(player.sleeper_player_id);
      const isActuallyFreeAgent = !sleeperStatus.isRostered && getPlayerTeamInfo(player.id, player.team_id).length === 0;
      const freeAgentMatch = !freeAgentFilter || isActuallyFreeAgent;

      // Rookie filter
      const rookieMatch = !rookieFilter || player.years_experience <= 1;

      return searchMatch && nflTeamMatch && freeAgentMatch && rookieMatch;
    });
  }, [players, searchTerm, nflTeamFilter, freeAgentFilter, rookieFilter]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB':return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR':return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE':return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getInjuryStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy':return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Questionable':return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Doubtful':return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Out':return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'IR':return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Moved to useCallback above

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setNflTeamFilter('all');
    setWeekFilter('14');
    setFreeAgentFilter(false);
    setRookieFilter(false);
  }, []);

  // Optimized handle player click with useCallback
  const handlePlayerClick = useCallback((player: Player) => {
    setSelectedPlayer(player);
    setIsModalOpen(true);
  }, []);

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    try {
      await refetchRoster();
      toast({
        title: 'Refreshed',
        description: 'Roster data has been updated successfully.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh roster data. Please try again.',
        variant: 'destructive'
      });
    }
  }, [refetchRoster, toast]);

  // Cache clearing function
  const handleClearCache = useCallback(() => {
    clearAllCaches();
    toast({
      title: 'Cache Cleared',
      description: 'All roster cache has been cleared and will be rebuilt.',
      variant: 'default'
    });
  }, [clearAllCaches, toast]);

  // Optimized stats calculation with memoization
  const playerStats = useMemo(() => {
    const freeAgents = filteredPlayers.filter((p) => {
      const sleeperStatus = getSleeperRosterStatus(p.sleeper_player_id);
      return !sleeperStatus.isRostered && getPlayerTeamInfo(p.id, p.team_id).length === 0;
    });

    const rookies = filteredPlayers.filter((p) => p.years_experience <= 1);
    const injuredPlayers = filteredPlayers.filter((p) => p.injury_status !== 'Healthy');

    const rosteredPlayers = filteredPlayers.filter((p) => {
      const sleeperStatus = getSleeperRosterStatus(p.sleeper_player_id);
      return sleeperStatus.isRostered || getPlayerTeamInfo(p.id, p.team_id).length > 0;
    });

    return {
      freeAgents,
      rookies,
      injuredPlayers,
      rosteredPlayers
    };
  }, [filteredPlayers, getSleeperRosterStatus, teams, teamConferenceJunctions, conferences]);

  const { freeAgents, rookies, injuredPlayers, rosteredPlayers } = playerStats;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="h-6 w-6 text-primary animate-pulse" />
            <h1 className="text-3xl font-bold">Loading Players...</h1>
          </div>
          {isRosterFetching &&
          <div className="flex items-center space-x-2 text-blue-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Syncing roster data...</span>
            </div>
          }
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) =>
          <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Players</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-muted-foreground">
            {selectedSeason} Season • Week {weekFilter} • {filteredPlayers.length} players
            {isRosterFetching && <span className="ml-2 text-blue-600">• Updating roster data...</span>}
            {rosterData &&
            <span className="ml-2 text-green-600">
                • {Object.keys(rosterData).length} players tracked
              </span>
            }
          </p>
          
          {/* Performance Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRosterFetching}
              className="flex items-center gap-1">

              <RefreshCw className={`h-3 w-3 ${isRosterFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMetrics(!showMetrics)}
              className="flex items-center gap-1">

              <Zap className="h-3 w-3" />
              Metrics
            </Button>
          </div>
        </div>
        
        {/* Performance Metrics Panel */}
        {showMetrics &&
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Cache Hit Rate:</span>
                <div className="font-mono">
                  {rosterMetrics.cacheHits + rosterMetrics.cacheMisses > 0 ?
                `${(rosterMetrics.cacheHits / (rosterMetrics.cacheHits + rosterMetrics.cacheMisses) * 100).toFixed(1)}%` :
                '0%'
                }
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">API Calls:</span>
                <div className="font-mono">{rosterMetrics.apiCalls}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Response:</span>
                <div className="font-mono">{rosterMetrics.averageResponseTime.toFixed(0)}ms</div>
              </div>
              <div>
                <span className="text-muted-foreground">Cache Size:</span>
                <div className="font-mono">{rosterMetrics.cacheSize}</div>
              </div>
            </div>
            <div className="mt-2">
              <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              className="text-xs">

                Clear Cache
              </Button>
            </div>
          </div>
        }
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Search and dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players, teams, college..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10" />

          </div>

          {/* NFL Team Filter */}
          <Select value={nflTeamFilter} onValueChange={setNflTeamFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All NFL Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All NFL Teams</SelectItem>
              {nflTeams.map((team) =>
              <SelectItem key={team} value={team}>{team}</SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Week Filter */}
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select Week" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week) =>
              <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Checkboxes and Clear Button */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="freeAgent"
              checked={freeAgentFilter}
              onCheckedChange={setFreeAgentFilter} />

            <label htmlFor="freeAgent" className="text-sm font-medium">
              Free Agents Only
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rookie"
              checked={rookieFilter}
              onCheckedChange={setRookieFilter} />

            <label htmlFor="rookie" className="text-sm font-medium">
              Rookies Only
            </label>
          </div>

          <Button variant="outline" onClick={clearFilters} className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Clear Filters</span>
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>Total Players</span>
            </CardDescription>
            <CardTitle className="text-2xl">{filteredPlayers.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <Shield className="h-4 w-4" />
              <span>Rostered</span>
            </CardDescription>
            <CardTitle className="text-2xl">{rosteredPlayers.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span>Free Agents</span>
            </CardDescription>
            <CardTitle className="text-2xl">{freeAgents.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <Activity className="h-4 w-4" />
              <span>Rookies</span>
            </CardDescription>
            <CardTitle className="text-2xl">{rookies.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <Heart className="h-4 w-4" />
              <span>Injured</span>
            </CardDescription>
            <CardTitle className="text-2xl">{injuredPlayers.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Players Grid */}
      {filteredPlayers.length > 0 ?
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map((player) =>
        <Card
          key={player.id}
          className="hover:shadow-md transition-shadow cursor-pointer group"
          onClick={() => handlePlayerClick(player)}>

              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Player Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                        {player.player_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {player.nfl_team} • #{player.jersey_number}
                      </p>
                    </div>
                    <Badge className={getPositionColor(player.position)} variant="secondary">
                      {player.position}
                    </Badge>
                  </div>

                  {/* Player Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Age:</span>
                      <span>{player.age}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Experience:</span>
                      <span>{player.years_experience} yr{player.years_experience !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">College:</span>
                      <span className="truncate ml-2">{player.college}</span>
                    </div>
                  </div>

                  {/* Roster Status Info */}
                  <div className="space-y-2">
                    {(() => {
                  // Get Sleeper roster status first
                  const sleeperStatus = getSleeperRosterStatus(player.sleeper_player_id);

                  // If Sleeper data shows player is rostered, use that
                  if (sleeperStatus.isRostered && sleeperStatus.team && sleeperStatus.conference) {
                    return (
                      <div className="space-y-1">
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Shield className="h-3 w-3 text-blue-600" />
                              <span>Rostered by:</span>
                              {isRosterFetching && <span className="text-xs">(updating...)</span>}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate" title={sleeperStatus.team.team_name}>
                                {sleeperStatus.team.team_name}
                              </span>
                              <Badge
                            variant="outline"
                            size="sm"
                            className={getConferenceColor(sleeperStatus.conference.conference_name)}
                            title={sleeperStatus.conference.conference_name}>

                                {sleeperStatus.conference.conference_name.includes('Mars') ? 'MARS' :
                            sleeperStatus.conference.conference_name.includes('Jupiter') ? 'JUPITER' : 'VULCAN'}
                              </Badge>
                            </div>
                          </div>);

                  }

                  // Fallback to database info if Sleeper data not available
                  const teamInfo = getPlayerTeamInfo(player.id, player.team_id);

                  if (teamInfo.length === 0) {
                    return (
                      <div className="flex items-center space-x-1">
                            <Shield className="h-3 w-3 text-green-600" />
                            <Badge variant="outline" size="sm" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Free Agent
                            </Badge>
                            {isRosterFetching && <span className="text-xs text-muted-foreground">(checking...)</span>}
                          </div>);

                  }

                  return (
                    <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Shield className="h-3 w-3" />
                            <span>Rostered by (DB):</span>
                          </div>
                          {teamInfo.map((info, index) =>
                      <div key={index} className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate" title={info.team.team_name}>
                                {info.team.team_name}
                              </span>
                              <Badge
                          variant="outline"
                          size="sm"
                          className={getConferenceColor(info.conference.conference_name)}
                          title={info.conference.conference_name}>

                                {info.conference.conference_name.includes('Mars') ? 'MARS' :
                          info.conference.conference_name.includes('Jupiter') ? 'JUPITER' : 'VULCAN'}
                              </Badge>
                            </div>
                      )}
                        </div>);

                })()}
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-1">
                    <Badge
                  className={getInjuryStatusColor(player.injury_status)}
                  variant="outline"
                  size="sm">
                      {player.injury_status}
                    </Badge>
                    {player.years_experience <= 1 &&
                <Badge variant="outline" size="sm" className="bg-purple-100 text-purple-800">
                        ROO
                      </Badge>
                }
                    {player.depth_chart_position === 1 &&
                <Badge variant="outline" size="sm" className="bg-blue-100 text-blue-800">
                        ST
                      </Badge>
                }
                  </div>

                  {/* Week Info */}
                  <div className="pt-2 border-t border-muted/20">
                    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Week {weekFilter} vs Opponent</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
        )}
        </div> :

      <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No players found</h3>
          <p className="text-muted-foreground mb-4">
            No players match your current search criteria.
          </p>
          <Button onClick={clearFilters} variant="outline">
            Clear all filters
          </Button>
        </div>
      }

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayer}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPlayer(null);
        }} />

    </div>);

};

export default PlayersPage;