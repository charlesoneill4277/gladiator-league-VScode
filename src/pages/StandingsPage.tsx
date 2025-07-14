import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { ArrowUpDown, Trophy, TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { teamRecordsService, StandingsData } from '@/services/teamRecordsService';

const StandingsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const [sortConfig, setSortConfig] = useState<{key: string; direction: 'asc' | 'desc';} | null>(null);
  const [standingsData, setStandingsData] = useState<StandingsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Fetch standings data from the team records service
  const fetchStandingsData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching standings data for season ${selectedSeason} and conference ${selectedConference || 'all'}...`);

      // Get the season ID for the selected year
      const { data: seasonsData, error: seasonsError } = await window.ezsite.apis.tablePage('12818', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [{
          name: 'season_year',
          op: 'Equal',
          value: selectedSeason
        }]
      });

      if (seasonsError) throw new Error(`Seasons fetch error: ${seasonsError}`);

      const seasons = seasonsData.List || [];
      if (seasons.length === 0) {
        throw new Error(`No season found for year ${selectedSeason}`);
      }

      const seasonId = seasons[0].id;
      console.log(`Found season ID ${seasonId} for year ${selectedSeason}`);

      // Get conference ID if specific conference is selected
      let conferenceId: number | undefined;
      if (selectedConference) {
        const selectedConferenceName = currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name;
        if (selectedConferenceName) {
          const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage('12820', {
            PageNo: 1,
            PageSize: 10,
            OrderByField: 'id',
            IsAsc: true,
            Filters: [
              { name: 'season_id', op: 'Equal', value: seasonId },
              { name: 'conference_name', op: 'Equal', value: selectedConferenceName }
            ]
          });

          if (conferencesError) throw new Error(`Conferences fetch error: ${conferencesError}`);

          const conferences = conferencesData.List || [];
          if (conferences.length > 0) {
            conferenceId = conferences[0].id;
          }
        }
      }

      // Use the team records service to get standings data
      const standings = await teamRecordsService.getStandingsData(seasonId, conferenceId);
      
      console.log('Standings data from service:', standings);
      setStandingsData(standings);

    } catch (err) {
      console.error('Error fetching standings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch standings data');
      toast({
        title: 'Error',
        description: 'Failed to fetch standings data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh standings data and recalculate records
  const refreshStandings = async () => {
    try {
      setRefreshing(true);
      
      // Get the season ID for the selected year
      const { data: seasonsData, error: seasonsError } = await window.ezsite.apis.tablePage('12818', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [{
          name: 'season_year',
          op: 'Equal',
          value: selectedSeason
        }]
      });

      if (seasonsError) throw new Error(`Seasons fetch error: ${seasonsError}`);

      const seasons = seasonsData.List || [];
      if (seasons.length === 0) {
        throw new Error(`No season found for year ${selectedSeason}`);
      }

      const seasonId = seasons[0].id;
      
      // Get conference ID if specific conference is selected
      let conferenceId: number | undefined;
      if (selectedConference) {
        const selectedConferenceName = currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name;
        if (selectedConferenceName) {
          const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage('12820', {
            PageNo: 1,
            PageSize: 10,
            OrderByField: 'id',
            IsAsc: true,
            Filters: [
              { name: 'season_id', op: 'Equal', value: seasonId },
              { name: 'conference_name', op: 'Equal', value: selectedConferenceName }
            ]
          });

          if (conferencesError) throw new Error(`Conferences fetch error: ${conferencesError}`);

          const conferences = conferencesData.List || [];
          if (conferences.length > 0) {
            conferenceId = conferences[0].id;
          }
        }
      }

      // Recalculate team records
      await teamRecordsService.calculateTeamRecords(seasonId, conferenceId);
      
      // Refresh the standings data
      await fetchStandingsData();
      
      toast({
        title: 'Success',
        description: 'Standings refreshed successfully',
      });
    } catch (err) {
      console.error('Error refreshing standings:', err);
      toast({
        title: 'Error',
        description: 'Failed to refresh standings data',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStandingsData();
  }, [selectedSeason, selectedConference]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStandings = React.useMemo(() => {
    let sortableStandings = [...standingsData];
    if (sortConfig !== null) {
      sortableStandings.sort((a, b) => {
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
    return sortableStandings;
  }, [standingsData, sortConfig]);

  const getRecordBadgeVariant = (wins: number, losses: number) => {
    const totalGames = wins + losses;
    if (totalGames === 0) return 'outline';
    
    const winPercentage = wins / totalGames;
    if (winPercentage >= 0.7) return 'default';
    if (winPercentage >= 0.5) return 'secondary';
    return 'destructive';
  };

  const getPlayoffBadge = (playoffEligible: boolean, isChampion: boolean) => {
    if (isChampion) {
      return <Badge variant="default" className="bg-yellow-500 text-white"><Trophy className="w-3 h-3 mr-1" />Champion</Badge>;
    }
    if (playoffEligible) {
      return <Badge variant="default" className="bg-green-500">Playoff</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading standings data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">League Standings</h1>
          </div>
          <p className="text-muted-foreground">
            {selectedSeason} Season • {selectedConference ?
              currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
              'All Conferences'
            }
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Standings</CardTitle>
            <CardDescription>Unable to fetch standings data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={fetchStandingsData}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">League Standings</h1>
          </div>
          <Button
            variant="outline"
            onClick={refreshStandings}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {selectedConference ?
            currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
            'All Conferences'
          }
        </p>
      </div>

      {/* Standings Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Teams</CardDescription>
            <CardTitle className="text-2xl">{standingsData.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Highest Scoring Team</CardDescription>
            <CardTitle className="text-xl">
              {standingsData.length > 0 &&
                standingsData.reduce((prev, current) =>
                  prev.points_for > current.points_for ? prev : current
                ).team_name
              }
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Playoff Teams</CardDescription>
            <CardTitle className="text-2xl">
              {standingsData.filter(team => team.playoff_eligible).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Standings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Standings</CardTitle>
          <CardDescription>
            Click column headers to sort. Current standings for the {selectedSeason} season.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('overall_rank')}>
                      Rank <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('team_name')}>
                      Team <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead className="hidden lg:table-cell">Conference</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('wins')}>
                      Record <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('points_for')}>
                      PF <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('points_against')}>
                      PA <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('win_percentage')}>
                      Win% <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStandings.map((team, index) => (
                  <TableRow key={team.team_id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-1">
                        {team.overall_rank === 1 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        <span>{team.overall_rank}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{team.team_name}</div>
                      <div className="text-sm text-muted-foreground md:hidden">{team.owner_name}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{team.owner_name}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {team.conference_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRecordBadgeVariant(team.wins, team.losses)}>
                        {team.wins}-{team.losses}
                        {team.ties > 0 && `-${team.ties}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {team.points_for.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {team.points_against.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      {(team.win_percentage * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center space-x-1">
                        {getPlayoffBadge(team.playoff_eligible, team.is_conference_champion)}
                        <Badge variant="outline" className="text-xs">
                          C{team.conference_rank}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StandingsPage;
