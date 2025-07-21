import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { fetchPlayersFromApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Search, ArrowUpDown, ExternalLink, Filter, Loader2 } from 'lucide-react';

const PlayersPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  const [apiPlayers, setApiPlayers] = useState([]); // Holds the current page of players
  const [totalCount, setTotalCount] = useState(0);   // Total players for pagination
  const [currentPage, setCurrentPage] = useState(1); // For pagination controls
  const pageSize = 50; // Players per page
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const positions = ['QB', 'RB', 'WR', 'TE'];

  // New API-based data fetching
  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      setError(null);

      try {
        // Prepare filters from component state
        const filters = {
          search: searchTerm,
          position: positionFilter,
          is_rostered: statusFilter === 'rostered' ? true : (statusFilter === 'free_agent' ? false : ''),
        };

        const { data, count } = await fetchPlayersFromApi(filters, currentPage, pageSize);
        
        setApiPlayers(data || []);
        setTotalCount(count || 0);

        toast({
          title: 'Players Loaded',
          description: `Found ${count || 0} players for ${selectedSeason} season`
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
  }, [searchTerm, positionFilter, statusFilter, currentPage, selectedSeason, selectedConference]);
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching players data for season:', selectedSeason);

      // Get all active offensive players from the database
      const playersResult = await DatabaseService.getAllPlayersForMapping([
        { column: 'playing_status', operator: 'eq', value: 'Active' },
        { column: 'position', operator: 'in', value: ['QB', 'RB', 'WR', 'TE'] }
      ]);

      if (!playersResult || playersResult.length === 0) {
        throw new Error('No players found in database');
      }

      // Get current season conferences
      if (!currentSeasonConfig || !currentSeasonConfig.conferences) {
        throw new Error('No season configuration found');
      }

      let targetConferences = currentSeasonConfig.conferences;
      
      // Filter by selected conference if specified
      if (selectedConference && selectedConference !== 'all') {
        targetConferences = currentSeasonConfig.conferences.filter(c => c.id === selectedConference);
      }

      const conferenceIds = targetConferences
        .filter(c => c.dbConferenceId)
        .map(c => c.dbConferenceId!);

      if (conferenceIds.length === 0) {
        console.warn('No valid conference IDs found');
        setPlayers([]);
        return;
      }

      // Get team-conference junctions for current season
      const junctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'conference_id', operator: 'in', value: conferenceIds }
        ]
      });

      if (junctionResult.error || !junctionResult.data) {
        throw new Error('Failed to fetch team mappings');
      }

      // Get team data
      const teamIds = [...new Set(junctionResult.data.map(j => j.team_id))];
      const teamsResult = await DatabaseService.getTeams({
        filters: [
          { column: 'id', operator: 'in', value: teamIds }
        ]
      });

      if (teamsResult.error || !teamsResult.data) {
        throw new Error('Failed to fetch teams');
      }

      // Get roster data using SleeperApiService for each conference
      const allRosterData = await Promise.all(
        targetConferences.map(async (conference) => {
          try {
            if (!conference.leagueId) {
              console.warn(`No league ID for conference ${conference.name}`);
              return { conference, rosters: [] };
            }
            
            const rosters = await SleeperApiService.fetchLeagueRosters(conference.leagueId);
            return { conference, rosters };
          } catch (error) {
            console.warn(`Failed to fetch rosters for conference ${conference.name}:`, error);
            return { conference, rosters: [] };
          }
        })
      );

      // Create enhanced player data
      const enhancedPlayers: EnhancedPlayer[] = playersResult.map(player => {
        const rosterInfo: PlayerRosterInfo[] = [];

        // Check each conference for this player
        allRosterData.forEach(({ conference, rosters }) => {
          rosters.forEach(roster => {
            if (roster.players && roster.players.includes(player.sleeper_id)) {
              // Find the team for this roster
              const junction = junctionResult.data?.find(j => 
                j.conference_id === conference.dbConferenceId && j.roster_id === roster.roster_id
              );
              
              if (junction) {
                const team = teamsResult.data?.find(t => t.id === junction.team_id);
                if (team) {
                  rosterInfo.push({
                    conference_id: conference.dbConferenceId!,
                    conference_name: conference.name,
                    team_id: team.id,
                    team_name: team.team_name,
                    owner_name: team.owner_name,
                    roster_id: roster.roster_id
                  });
                }
              }
            }
          });
        });

        // Determine availability status
        let availability_status: 'free_agent' | 'rostered' | 'multi_rostered';
        if (rosterInfo.length === 0) {
          availability_status = 'free_agent';
        } else if (rosterInfo.length === 1) {
          availability_status = 'rostered';
        } else {
          availability_status = 'multi_rostered';
        }

        return {
          id: player.id,
          sleeper_id: player.sleeper_id,
          player_name: player.player_name,
          position: player.position,
          team_abbreviation: player.nfl_team || 'FA',
          playing_status: player.playing_status,
          injury_status: player.injury_status,
          rookie_year: player.age && player.age <= 23 ? new Date().getFullYear() - (player.age - 23) : null,
          rostered_by: rosterInfo,
          availability_status,
          total_points: 0, // TODO: Add scoring data when available
          avg_points: 0    // TODO: Add scoring data when available
        };
      });

      setPlayers(enhancedPlayers);
      console.log(`Loaded ${enhancedPlayers.length} players with roster data`);

      toast({
        title: 'Players Loaded',
        description: `Found ${enhancedPlayers.length} players for ${selectedSeason} season`
      });

    } catch (error) {
      console.error('Error fetching players data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch players data';
      setError(errorMessage);
      toast({
        title: 'Error Loading Players',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentSeasonConfig) {
      fetchPlayersData();
    }
  }, [selectedSeason, selectedConference, currentSeasonConfig]);

  // Filter players based on search term and filters
  const filteredPlayers = players.filter((player) => {
    const searchMatch = searchTerm === '' ||
      player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team_abbreviation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.rostered_by.some(r => 
        r.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.owner_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const positionMatch = positionFilter === 'all' ||
      player.position === positionFilter ||
      (positionFilter === 'offense' && offensePositions.includes(player.position));

    const statusMatch = statusFilter === 'all' || 
      (statusFilter === 'rostered' && player.availability_status !== 'free_agent') ||
      (statusFilter === 'free_agent' && player.availability_status === 'free_agent') ||
      (statusFilter === 'multi_rostered' && player.availability_status === 'multi_rostered');

    return searchMatch && positionMatch && statusMatch;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPlayers = React.useMemo(() => {
    let sortablePlayers = [...filteredPlayers];
    if (sortConfig !== null) {
      sortablePlayers.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key];
        const bValue = (b as any)[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortablePlayers;
  }, [filteredPlayers, sortConfig]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB':return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR':return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE':return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusBadge = (availabilityStatus: string, injuryStatus: string | null) => {
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

    if (availabilityStatus === 'free_agent') {
      return <Badge variant="outline" className="text-xs">FA</Badge>;
    } else if (availabilityStatus === 'multi_rostered') {
      return <Badge variant="secondary" className="text-xs">Multi-Rostered</Badge>;
    } else {
      return <Badge variant="default" className="text-xs">Rostered</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Players</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {sortedPlayers.length} players
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players, teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10" />

        </div>

        {/* Position Filter */}
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Positions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="offense">All Offense (QB, RB, WR, TE)</SelectItem>
            {positions.map((pos) =>
            <SelectItem key={pos} value={pos}>{pos}</SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="rostered">Rostered</SelectItem>
            <SelectItem value="free_agent">Free Agent</SelectItem>
            <SelectItem value="multi_rostered">Multi-Rostered</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        <Button
          variant="outline"
          onClick={() => {
            setSearchTerm('');
            setPositionFilter('all');
            setStatusFilter('all');
          }}
          className="flex items-center space-x-2">

          <Filter className="h-4 w-4" />
          <span>Clear Filters</span>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Players</CardDescription>
            <CardTitle className="text-2xl">{sortedPlayers.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Free Agents</CardDescription>
            <CardTitle className="text-2xl">
              {sortedPlayers.filter((p) => p.availability_status === 'free_agent').length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Injured Players</CardDescription>
            <CardTitle className="text-2xl">
              {sortedPlayers.filter((p) => p.injury_status).length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Points/Game</CardDescription>
            <CardTitle className="text-2xl">
              {sortedPlayers.length > 0 ?
              (sortedPlayers.reduce((sum, p) => sum + p.avg_points, 0) / sortedPlayers.length).toFixed(1) :
              '0.0'
              }
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Players Table */}
      <Card>
        <CardHeader>
          <CardTitle>Player Database</CardTitle>
          <CardDescription>
            Click column headers to sort. Click player names for detailed stats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('name')}>
                      Player <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('position')}>
                      Pos <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">NFL Team</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('points')}>
                      Points <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('avgPoints')}>
                      Avg <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Rostered By</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player) =>
                <TableRow key={player.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="font-medium">{player.player_name}</div>
                      <div className="text-sm text-muted-foreground sm:hidden">
                        {player.team_abbreviation}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPositionColor(player.position)}>
                        {player.position}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{player.team_abbreviation}</TableCell>
                    <TableCell className="text-right font-mono">
                      {player.total_points.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      {player.avg_points.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(player.availability_status, player.injury_status)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {player.rostered_by.length > 0 ? (
                        <div>
                          {player.rostered_by.map((roster, idx) => (
                            <div key={idx} className="mb-1 last:mb-0">
                              <div className="text-sm font-medium">{roster.team_name}</div>
                              <div className="text-xs text-muted-foreground">{roster.owner_name}</div>
                              {player.rostered_by.length > 1 && (
                                <div className="text-xs text-blue-600">{roster.conference_name}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Free Agent</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={`/players/${player.sleeper_id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {sortedPlayers.length === 0 &&
          <div className="text-center py-8">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No players found</h3>
              <p className="text-muted-foreground">
                No players match your current search criteria.
              </p>
            </div>
          }
        </CardContent>
      </Card>
    </div>);

};

export default PlayersPage;