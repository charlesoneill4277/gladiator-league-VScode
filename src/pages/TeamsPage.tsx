import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useApp } from '@/contexts/AppContext';
import { Users, Search, ExternalLink, Trophy, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Interface for Sleeper API roster data
interface SleeperRoster {
  starters: string[];
  settings: {
    wins: number;
    waiver_position: number;
    waiver_budget_used: number;
    total_moves: number;
    ties: number;
    losses: number;
    fpts_decimal: number;
    fpts_against_decimal: number;
    fpts_against: number;
    fpts: number;
  };
  roster_id: number;
  reserve: string[];
  players: string[];
  owner_id: string;
  league_id: string;
}

// Interface for team data combining database and API data
interface TeamData {
  id: string;
  teamName: string;
  ownerName: string;
  coOwnerName?: string;
  ownerAvatar: string | null;
  conference: string;
  record: {wins: number;losses: number;ties: number;};
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  streak: string;
  rosterCount: number;
  waiversCount: number;
  tradesCount: number;
  rosterId: number;
  leagueId: string;
}


const TeamsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [teamsData, setTeamsData] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch team data from database and Sleeper API
  const fetchTeamsData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching teams data for season:', selectedSeason);

      // Get conferences for current season
      const conferencesToFetch = selectedConference ?
      currentSeasonConfig.conferences.filter((c) => c.id === selectedConference) :
      currentSeasonConfig.conferences;

      console.log('Conferences to fetch:', conferencesToFetch);

      // Fetch teams from database
      const { data: teamsResponse, error: teamsError } = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (teamsError) throw new Error(teamsError);

      const dbTeams = teamsResponse?.List || [];
      console.log('Database teams:', dbTeams);

      // Fetch conferences from database to get league IDs
      const { data: conferencesResponse, error: conferencesError } = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: []
      });

      if (conferencesError) throw new Error(conferencesError);

      const dbConferences = conferencesResponse?.List || [];
      console.log('Database conferences:', dbConferences);

      // Fetch roster data from Sleeper API for each conference
      const allRosterData: SleeperRoster[] = [];

      for (const conference of conferencesToFetch) {
        try {
          console.log(`Fetching roster data for league: ${conference.leagueId}`);
          const response = await fetch(`https://api.sleeper.app/v1/league/${conference.leagueId}/rosters`);

          if (!response.ok) {
            console.warn(`Failed to fetch roster data for league ${conference.leagueId}:`, response.statusText);
            continue;
          }

          const rosterData: SleeperRoster[] = await response.json();
          console.log(`Roster data for ${conference.name}:`, rosterData);

          allRosterData.push(...rosterData.map((roster) => ({
            ...roster,
            league_id: conference.leagueId
          })));
        } catch (apiError) {
          console.warn(`Error fetching roster data for league ${conference.leagueId}:`, apiError);
        }
      }

      console.log('All roster data:', allRosterData);

      // Combine database teams with Sleeper API data
      const combinedTeams: TeamData[] = [];

      for (const dbTeam of dbTeams) {
        // Find matching roster from Sleeper API
        const matchingRoster = allRosterData.find((roster) =>
        roster.owner_id === dbTeam.owner_id
        );

        if (matchingRoster) {
          const conference = conferencesToFetch.find((c) => c.leagueId === matchingRoster.league_id);

          // Calculate win streak
          const streak = calculateStreak(matchingRoster.settings.wins, matchingRoster.settings.losses);

          combinedTeams.push({
            id: dbTeam.id.toString(),
            teamName: dbTeam.team_name,
            ownerName: dbTeam.owner_name,
            coOwnerName: dbTeam.co_owner_name || undefined,
            ownerAvatar: dbTeam.team_logo_url || null,
            conference: conference?.name || 'Unknown Conference',
            record: {
              wins: matchingRoster.settings.wins,
              losses: matchingRoster.settings.losses,
              ties: matchingRoster.settings.ties
            },
            pointsFor: matchingRoster.settings.fpts + matchingRoster.settings.fpts_decimal / 100,
            pointsAgainst: matchingRoster.settings.fpts_against + matchingRoster.settings.fpts_against_decimal / 100,
            rank: 0, // Will be calculated after sorting
            streak,
            rosterCount: matchingRoster.players?.length || 0,
            waiversCount: matchingRoster.settings.total_moves || 0,
            tradesCount: 0, // Would need additional API call to get trade data
            rosterId: matchingRoster.roster_id,
            leagueId: matchingRoster.league_id
          });
        } else {
          // Team exists in database but no matching roster found
          console.warn(`No matching roster found for team: ${dbTeam.team_name} (owner_id: ${dbTeam.owner_id})`);
        }
      }

      // Sort teams by wins (descending), then by points for (descending)
      combinedTeams.sort((a, b) => {
        if (a.record.wins !== b.record.wins) {
          return b.record.wins - a.record.wins;
        }
        return b.pointsFor - a.pointsFor;
      });

      // Assign ranks
      combinedTeams.forEach((team, index) => {
        team.rank = index + 1;
      });

      console.log('Final combined teams data:', combinedTeams);
      setTeamsData(combinedTeams);

    } catch (err) {
      console.error('Error fetching teams data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load teams data');
      toast({
        title: "Error Loading Teams",
        description: "Failed to load team data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate win/loss streak (simplified - would need game-by-game data for accuracy)
  const calculateStreak = (wins: number, losses: number): string => {
    // This is a simplified calculation - ideally we'd have game history
    if (wins > losses) {
      return `W${Math.min(wins - losses, 5)}`; // Cap at 5 for display
    } else if (losses > wins) {
      return `L${Math.min(losses - wins, 5)}`; // Cap at 5 for display
    }
    return 'T1';
  };

  // Load data when component mounts or when season/conference changes
  useEffect(() => {
    fetchTeamsData();
  }, [selectedSeason, selectedConference]);

  // Filter teams based on search term
  const filteredTeams = teamsData.filter((team) => {
    const searchMatch = searchTerm === '' ||
    team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.coOwnerName && team.coOwnerName.toLowerCase().includes(searchTerm.toLowerCase());

    return searchMatch;
  });

  const getRecordBadgeVariant = (wins: number, losses: number) => {
    const winPercentage = wins / (wins + losses);
    if (winPercentage >= 0.7) return 'default';
    if (winPercentage >= 0.5) return 'secondary';
    return 'destructive';
  };

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) return 'text-green-600';
    if (streak.startsWith('L')) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Teams</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          } • {filteredTeams.length} teams
        </p>
      </div>

      {/* Search Bar and Refresh */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams or owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10" />
        </div>
        <Button variant="outline" onClick={() => setSearchTerm('')}>
          Clear
        </Button>
        <Button
          variant="outline"
          onClick={fetchTeamsData}
          disabled={loading}>


          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Loading State */}
      {loading &&
      <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Loading Teams</h3>
            <p className="text-muted-foreground">Fetching team data from Sleeper API...</p>
          </CardContent>
        </Card>
      }
      
      {/* Error State */}
      {error && !loading &&
      <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Teams</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchTeamsData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      }
      
      {/* Teams Grid */}
      {!loading && !error &&
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) =>
        <Card key={team.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={team.ownerAvatar || undefined} />
                    <AvatarFallback className="bg-primary/10">
                      {team.ownerName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg leading-tight">{team.teamName}</CardTitle>
                    <CardDescription>
                      {team.ownerName}
                      {team.coOwnerName && ` & ${team.coOwnerName}`}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {team.rank <= 3 && <Trophy className="h-4 w-4 text-yellow-500" />}
                  <span className="text-sm font-semibold">#{team.rank}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Conference Badge */}
              <Badge variant="outline" className="text-xs">
                {team.conference}
              </Badge>

              {/* Record and Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Record</p>
                  <Badge variant={getRecordBadgeVariant(team.record.wins, team.record.losses)}>
                    {team.record.wins}-{team.record.losses}
                    {team.record.ties > 0 && `-${team.record.ties}`}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Streak</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className={`h-4 w-4 ${getStreakColor(team.streak)}`} />
                    <span className={`font-semibold ${getStreakColor(team.streak)}`}>
                      {team.streak}
                    </span>
                  </div>
                </div>
              </div>

              {/* Points */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Points For</p>
                  <p className="font-semibold">{team.pointsFor.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Points Against</p>
                  <p className="font-semibold">{team.pointsAgainst.toFixed(1)}</p>
                </div>
              </div>

              {/* Team Activity */}
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium">{team.rosterCount}</p>
                  <p>Roster</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{team.waiversCount}</p>
                  <p>Moves</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">#{team.rosterId}</p>
                  <p>Roster ID</p>
                </div>
              </div>

              {/* View Team Button */}
              <Link to={`/teams/${team.id}`} className="w-full">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Team Details
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        </div>
      }

      {/* No Results */}
      {!loading && !error && filteredTeams.length === 0 &&
      <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams found</h3>
            <p className="text-muted-foreground mb-4">
              No teams match your current search criteria.
            </p>
            <Button variant="outline" onClick={() => setSearchTerm('')}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      }

      {/* Summary Stats */}
      {!loading && !error && filteredTeams.length > 0 &&
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Points For</CardDescription>
              <CardTitle className="text-2xl">
                {(filteredTeams.reduce((sum, team) => sum + team.pointsFor, 0) / filteredTeams.length).toFixed(1)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Most Active Team</CardDescription>
              <CardTitle className="text-lg">
                {filteredTeams.reduce((prev, current) =>
              prev.waiversCount > current.waiversCount ? prev : current
              ).teamName}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Moves</CardDescription>
              <CardTitle className="text-2xl">
                {filteredTeams.reduce((sum, team) => sum + team.waiversCount, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    </div>);


};

export default TeamsPage;