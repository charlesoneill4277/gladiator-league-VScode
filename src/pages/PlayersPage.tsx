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
import { UserCheck, Search, Filter, ExternalLink, Loader2, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamLookup, setTeamLookup] = useState<Map<number, string>>(new Map());
  const [teamNameToIdLookup, setTeamNameToIdLookup] = useState<Map<string, number>>(new Map());
  const [activeTab, setActiveTab] = useState('all-players');

  const positions = ['QB', 'RB', 'WR', 'TE'];

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
          {selectedSeason} Season • {totalCount} players
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          </div>

          {/* Players Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Pos</TableHead>
                      <TableHead className="hidden sm:table-cell">NFL Team</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Avg</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Rostered By</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : apiPlayers.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8">No players found.</TableCell></TableRow>
                    ) : (
                      apiPlayers.map((player) => (
                        <TableRow key={player.id}>
                          <TableCell>
                            {/* CORRECTED: The API sends 'player_name', not 'full_name' */}
                            <div className="font-medium">{player.player_name}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPositionColor(player.position)}>{player.position}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{player.nfl_team || 'FA'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {/* This is safe because the VIEW guarantees a number */}
                            {player.total_points.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono hidden md:table-cell">
                            {player.avg_points.toFixed(1)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(player.is_rostered, player.injury_status)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
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
