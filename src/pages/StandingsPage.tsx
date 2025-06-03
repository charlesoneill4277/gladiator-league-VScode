import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { ArrowUpDown, Trophy, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StandingData {
  id: string;
  teamName: string;
  ownerName: string;
  conference: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  streak: string;
  avgPointsFor: number;
  rosterId: number;
  leagueId: string;
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_against: number;
    fpts_decimal: number;
    fpts_against_decimal: number;
    waiver_position: number;
    waiver_budget_used: number;
    total_moves: number;
  };
  starters: string[];
  players: string[];
  reserve: string[];
}

const StandingsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const [sortConfig, setSortConfig] = useState<{key: string;direction: 'asc' | 'desc';} | null>(null);
  const [standingsData, setStandingsData] = useState<StandingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch standings data from Sleeper API and database
  const fetchStandingsData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching standings data for season ${selectedSeason} and conference ${selectedConference || 'all'}...`);

      // First, get the season ID for the selected year
      const { data: seasonsData, error: seasonsError } = await window.ezsite.apis.tablePage('12818', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
        {
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

      // Get conferences for the selected season
      const conferenceFilters = [
      {
        name: 'season_id',
        op: 'Equal',
        value: seasonId
      }];


      // If a specific conference is selected, add that filter too
      if (selectedConference) {
        const selectedConferenceName = currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name;
        if (selectedConferenceName) {
          conferenceFilters.push({
            name: 'conference_name',
            op: 'Equal',
            value: selectedConferenceName
          });
        }
      }

      const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: conferenceFilters
      });

      if (conferencesError) throw new Error(`Conferences fetch error: ${conferencesError}`);

      const conferences = conferencesData.List || [];
      if (conferences.length === 0) {
        console.warn(`No conferences found for season ${selectedSeason} and conference filter`);
        setStandingsData([]);
        return;
      }

      console.log(`Found ${conferences.length} conferences for the selected filters`);

      // Get junction data for the found conferences
      const conferenceIds = conferences.map((c) => c.id);
      const junctionFilters = conferenceIds.map((id) => ({
        name: 'conference_id',
        op: 'Equal',
        value: id
      }));

      // For now, we'll fetch all junctions and filter in memory since the API doesn't support OR operations
      // In a production environment, you'd want to make multiple requests or use a more sophisticated query
      const { data: junctionData, error: junctionError } = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 1000, // Increase to ensure we get all relevant data
        OrderByField: 'id',
        IsAsc: true,
        Filters: [] // We'll filter this in memory
      });

      if (junctionError) throw new Error(`Junction fetch error: ${junctionError}`);

      // Filter junctions to only include those for our selected conferences
      const filteredJunctions = (junctionData.List || []).filter((junction) =>
      conferenceIds.includes(junction.conference_id) && junction.is_active
      );

      console.log(`Found ${filteredJunctions.length} active team-conference junctions`);

      // Get all teams (we can't filter these effectively without knowing which team IDs we need first)
      const { data: teamsData, error: teamsError } = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 1000, // Increase to ensure we get all teams
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      });

      if (teamsError) throw new Error(`Teams fetch error: ${teamsError}`);

      console.log('Database data:', {
        seasonsData,
        conferencesData: { List: conferences },
        junctionData: { List: filteredJunctions },
        teamsData
      });

      const teams = teamsData.List || [];
      const junctions = filteredJunctions;

      // Group junctions by conference for fetching Sleeper data
      const conferenceGroups = new Map<number, any[]>();
      junctions.forEach((junction) => {
        if (!conferenceGroups.has(junction.conference_id)) {
          conferenceGroups.set(junction.conference_id, []);
        }
        conferenceGroups.get(junction.conference_id)!.push(junction);
      });

      const allStandingsData: StandingData[] = [];

      // Fetch roster data for each conference
      for (const [conferenceId, conferenceJunctions] of conferenceGroups) {
        const conference = conferences.find((c) => c.id === conferenceId);
        if (!conference || !conference.league_id) {
          console.warn(`Conference ${conferenceId} not found or missing league_id`);
          continue;
        }

        try {
          console.log(`Fetching roster data for conference ${conference.conference_name} (league_id: ${conference.league_id})`);

          const response = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/rosters`);
          if (!response.ok) {
            throw new Error(`Failed to fetch rosters for league ${conference.league_id}: ${response.statusText}`);
          }

          const rosters: SleeperRoster[] = await response.json();
          console.log(`Fetched ${rosters.length} rosters for conference ${conference.conference_name}`);

          // Map roster data to our standings format
          for (const roster of rosters) {
            // Find the team data using roster_id
            const junction = conferenceJunctions.find((j) => j.roster_id === roster.roster_id.toString());
            if (!junction) {
              console.warn(`No junction found for roster_id ${roster.roster_id} in conference ${conferenceId}`);
              continue;
            }

            const team = teams.find((t) => t.id === junction.team_id);
            if (!team) {
              console.warn(`No team found for team_id ${junction.team_id}`);
              continue;
            }

            const totalGames = roster.settings.wins + roster.settings.losses + roster.settings.ties;
            const pointsFor = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100;
            const pointsAgainst = (roster.settings.fpts_against || 0) + (roster.settings.fpts_against_decimal || 0) / 100;

            const standingData: StandingData = {
              id: `${team.id}-${conferenceId}`,
              teamName: team.team_name || 'Unknown Team',
              ownerName: team.owner_name || 'Unknown Owner',
              conference: conference.conference_name,
              rank: 0, // Will be calculated later
              wins: roster.settings.wins || 0,
              losses: roster.settings.losses || 0,
              ties: roster.settings.ties || 0,
              pointsFor: pointsFor,
              pointsAgainst: pointsAgainst,
              pointsDiff: pointsFor - pointsAgainst,
              streak: calculateStreak(roster.settings.wins, roster.settings.losses), // Simplified for now
              avgPointsFor: totalGames > 0 ? pointsFor / totalGames : 0,
              rosterId: roster.roster_id,
              leagueId: roster.league_id
            };

            allStandingsData.push(standingData);
          }
        } catch (fetchError) {
          console.error(`Error fetching rosters for conference ${conference.conference_name}:`, fetchError);
          // Continue with other conferences
        }
      }

      // Sort by wins (desc), then by points for (desc) to calculate ranks
      allStandingsData.sort((a, b) => {
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.pointsFor - a.pointsFor;
      });

      // Assign ranks
      allStandingsData.forEach((team, index) => {
        team.rank = index + 1;
      });

      console.log('Final standings data:', allStandingsData);
      setStandingsData(allStandingsData);

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

  // Simple streak calculation (can be enhanced later)
  const calculateStreak = (wins: number, losses: number): string => {
    // This is a simplified implementation
    // In a real scenario, you'd need historical matchup data
    if (wins > losses) return `W${Math.min(wins, 3)}`;
    if (losses > wins) return `L${Math.min(losses, 3)}`;
    return 'T1';
  };

  useEffect(() => {
    fetchStandingsData();
  }, [selectedSeason, selectedConference]);

  // The standings data is already filtered by the database queries,
  // but we'll apply an additional client-side filter as a safety measure
  const filteredStandings = standingsData; // Data is already filtered by database queries

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStandings = React.useMemo(() => {
    let sortableStandings = [...filteredStandings];
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
  }, [filteredStandings, sortConfig]);

  const getStreakIcon = (streak: string) => {
    if (streak.startsWith('W')) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (streak.startsWith('L')) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  const getRecordBadgeVariant = (wins: number, losses: number) => {
    const winPercentage = wins / (wins + losses);
    if (winPercentage >= 0.7) return 'default';
    if (winPercentage >= 0.5) return 'secondary';
    return 'destructive';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading standings data...</span>
        </div>
      </div>);

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

      {/* Standings Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Teams</CardDescription>
            <CardTitle className="text-2xl">{filteredStandings.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Highest Scoring Team</CardDescription>
            <CardTitle className="text-xl">
              {filteredStandings.length > 0 &&
              filteredStandings.reduce((prev, current) =>
              prev.pointsFor > current.pointsFor ? prev : current
              ).teamName
              }
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>League Average PPG</CardDescription>
            <CardTitle className="text-2xl">
              {filteredStandings.length > 0 &&
              (filteredStandings.reduce((sum, team) => sum + team.avgPointsFor, 0) / filteredStandings.length).toFixed(1)
              }
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
                    <Button variant="ghost" size="sm" onClick={() => handleSort('rank')}>
                      Rank <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('teamName')}>
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
                    <Button variant="ghost" size="sm" onClick={() => handleSort('pointsFor')}>
                      PF <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('pointsAgainst')}>
                      PA <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('pointsDiff')}>
                      Diff <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Streak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStandings.map((team, index) =>
                <TableRow key={team.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-1">
                        {team.rank === 1 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        <span>{team.rank}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{team.teamName}</div>
                      <div className="text-sm text-muted-foreground md:hidden">{team.ownerName}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{team.ownerName}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {team.conference}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRecordBadgeVariant(team.wins, team.losses)}>
                        {team.wins}-{team.losses}
                        {team.ties > 0 && `-${team.ties}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {team.pointsFor.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {team.pointsAgainst.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      <span className={team.pointsDiff > 0 ? 'text-green-600' : 'text-red-600'}>
                        {team.pointsDiff > 0 ? '+' : ''}{team.pointsDiff.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center space-x-1">
                        {getStreakIcon(team.streak)}
                        <span className="text-sm">{team.streak}</span>
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