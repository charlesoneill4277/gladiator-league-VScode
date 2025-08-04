import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { ArrowUpDown, Trophy, TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StandingsService, StandingsData } from '@/services/standingsService';
import { DatabaseService, DbPlayoffFormat } from '@/services/databaseService';
import { ConferenceBadge } from '@/components/ui/conference-badge';

const StandingsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig, loading: appLoading } = useApp();
  const [sortConfig, setSortConfig] = useState<{key: string;direction: 'asc' | 'desc';} | null>(null);
  const [standingsData, setStandingsData] = useState<StandingsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [playoffFormat, setPlayoffFormat] = useState<DbPlayoffFormat | null>(null);
  const { toast } = useToast();

  // Default playoff format
  const DEFAULT_PLAYOFF_FORMAT: DbPlayoffFormat = {
    id: 0,
    season_id: 0,
    playoff_teams: 10,
    week_14_byes: 6,
    reseed: true,
    playoff_start_week: 14,
    championship_week: 17,
    is_active: true
  };

  // Fetch playoff format data for the selected season
  const fetchPlayoffFormat = async (seasonId: number) => {
    try {
      console.log(`Fetching playoff format for season ID ${seasonId}...`);
      
      // Query the playoff_formats table for the selected season
      const playoffFormatsResult = await DatabaseService.getPlayoffFormats({
        filters: [{ column: 'season_id', operator: 'eq', value: seasonId }],
        limit: 1
      });
      
      if (playoffFormatsResult.error) {
        console.error('Error fetching playoff format:', playoffFormatsResult.error);
        return null;
      }
      
      const formats = playoffFormatsResult.data || [];
      if (formats.length > 0) {
        console.log('Playoff format found:', formats[0]);
        setPlayoffFormat(formats[0]);
        return formats[0];
      } else {
        console.log('No playoff format found for season', seasonId);
        // Use default format but with the correct season ID
        const defaultFormat = { ...DEFAULT_PLAYOFF_FORMAT, season_id: seasonId };
        setPlayoffFormat(defaultFormat);
        return defaultFormat;
      }
    } catch (err) {
      console.error('Error in fetchPlayoffFormat:', err);
      // Use default format on error
      setPlayoffFormat(DEFAULT_PLAYOFF_FORMAT);
      return DEFAULT_PLAYOFF_FORMAT;
    }
  };

  // Fetch standings data using Supabase services
  const fetchStandingsData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching standings data for season ${selectedSeason} and conference ${selectedConference || 'all'}...`);

      // Use the season config from AppContext (already loaded from Supabase)
      const season = currentSeasonConfig;
      if (!season) {
        throw new Error(`No season configuration found for year ${selectedSeason}`);
      }

      // Get season ID from AppContext data (convert to number if needed)
      const seasonIdRaw = season.seasonId;
      const seasonId = typeof seasonIdRaw === 'string' ? parseInt(seasonIdRaw) : seasonIdRaw;
      console.log(`Using season ID ${seasonId} for year ${selectedSeason}`);
      
      // Fetch playoff format data for this season
      await fetchPlayoffFormat(seasonId);

      // Get conference ID if specific conference is selected
      let conferenceId: number | undefined;
      if (selectedConference) {
        const selectedConferenceConfig = season.conferences.find((c) => c.id === selectedConference);
        if (selectedConferenceConfig) {
          // Get the actual conference record from Supabase
          const conferencesResult = await DatabaseService.getConferences({
            filters: [
              { column: 'season_id', operator: 'eq', value: seasonId },
              { column: 'conference_name', operator: 'eq', value: selectedConferenceConfig.name }
            ]
          });

          if (conferencesResult.error) {
            throw new Error(`Conferences fetch error: ${conferencesResult.error}`);
          }

          const conferences = conferencesResult.data || [];
          if (conferences.length > 0) {
            conferenceId = typeof conferences[0].id === 'string' ? parseInt(conferences[0].id) : conferences[0].id;
          }
        }
      }

      // Use the team records service to get standings data (now using Supabase)
      const standings = await StandingsService.getStandingsData(seasonId, conferenceId);

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

      // Use the season config from AppContext
      const season = currentSeasonConfig;
      if (!season) {
        throw new Error(`No season configuration found for year ${selectedSeason}`);
      }

      const seasonIdRaw = season.seasonId;
      const seasonId = typeof seasonIdRaw === 'string' ? parseInt(seasonIdRaw) : seasonIdRaw;
      
      // Refresh playoff format data
      await fetchPlayoffFormat(seasonId);

      // Get conference ID if specific conference is selected
      let conferenceId: number | undefined;
      if (selectedConference) {
        const selectedConferenceConfig = season.conferences.find((c) => c.id === selectedConference);
        if (selectedConferenceConfig) {
          const conferencesResult = await DatabaseService.getConferences({
            filters: [
              { column: 'season_id', operator: 'eq', value: seasonId },
              { column: 'conference_name', operator: 'eq', value: selectedConferenceConfig.name }
            ]
          });

          if (conferencesResult.error) {
            throw new Error(`Conferences fetch error: ${conferencesResult.error}`);
          }

          const conferences = conferencesResult.data || [];
          if (conferences.length > 0) {
            conferenceId = typeof conferences[0].id === 'string' ? parseInt(conferences[0].id) : conferences[0].id;
          }
        }
      }

      // Recalculate team records
      // Note: Team records calculation now happens server-side in Supabase
      // or can be triggered through admin panel if needed
      console.log('Team records refresh triggered for season:', seasonId, 'conference:', conferenceId);

      // Refresh the standings data
      await fetchStandingsData();

      toast({
        title: 'Success',
        description: 'Standings refreshed successfully'
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
    // Don't load standings until app context is ready
    if (!appLoading && currentSeasonConfig) {
      fetchStandingsData();
    }
  }, [selectedSeason, selectedConference, appLoading, currentSeasonConfig]);

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
      // Custom sorting based on user selection
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
    } else {
      // Default sorting: Wins first (descending), then Points For (descending)
      sortableStandings.sort((a, b) => {
        // First sort by wins (descending)
        if (a.wins !== b.wins) {
          return b.wins - a.wins;
        }
        // If wins are equal, sort by points for (descending)
        return b.points_for - a.points_for;
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

  if (appLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading {appLoading ? 'season data' : 'standings'}...</span>
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
      </div>);

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
            className="flex items-center gap-2">

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
              {playoffFormat ? playoffFormat.playoff_teams : 0}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {standingsData.filter((team) => team.playoff_eligible).length} teams currently eligible
            </CardDescription>
            {playoffFormat && playoffFormat.week_14_byes > 0 && (
              <CardDescription className="text-xs mt-1">
                With {playoffFormat.week_14_byes} first-round byes
              </CardDescription>
            )}
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
                  <TableHead className="w-12 text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('overall_rank')}>
                      Rank <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('team_name')}>
                      Team <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-center">Conference</TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('wins')}>
                      Record <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('win_percentage')}>
                      Win% <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('points_for')}>
                      PF <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center hidden sm:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('points_against')}>
                      PA <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center hidden sm:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('point_diff')}>
                      Diff <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStandings.map((team, index) =>
                <TableRow key={team.team_id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {team.overall_rank === 1 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        <span>{team.overall_rank}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <img
                            src={team.team_logourl ? `https://sleepercdn.com/avatars/thumbs/${team.team_logourl}` : '/placeholder-team-logo.png'}
                            alt={`${team.team_name} logo`}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/placeholder-team-logo.png';
                            }}
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="font-medium text-sm">{team.team_name}</div>
                          <div className="text-xs text-muted-foreground">{team.owner_name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center">
                      <ConferenceBadge conferenceName={team.conference_name} variant="outline" size="sm" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getRecordBadgeVariant(team.wins, team.losses)}>
                        {team.wins}-{team.losses}
                        {team.ties > 0 && `-${team.ties}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono hidden md:table-cell">
                      {(team.win_percentage * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {team.points_for.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center font-mono hidden sm:table-cell">
                      {team.points_against.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center font-mono hidden sm:table-cell">
                      <span className={team.point_diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {team.point_diff >= 0 ? '+' : ''}{team.point_diff.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center space-x-1">
                        {getPlayoffBadge(team.playoff_eligible, team.is_conference_champion)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default StandingsPage;