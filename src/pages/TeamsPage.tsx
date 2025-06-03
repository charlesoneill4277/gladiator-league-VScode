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
  record: { wins: number; losses: number; ties: number };
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
      const conferencesToFetch = selectedConference 
        ? currentSeasonConfig.conferences.filter(c => c.id === selectedConference)
        : currentSeasonConfig.conferences;
      
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
          
          allRosterData.push(...rosterData.map(roster => ({
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
        const matchingRoster = allRosterData.find(roster => 
          roster.owner_id === dbTeam.owner_id
        );
        
        if (matchingRoster) {
          const conference = conferencesToFetch.find(c => c.leagueId === matchingRoster.league_id);
          
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
            pointsFor: (matchingRoster.settings.fpts + (matchingRoster.settings.fpts_decimal / 100)),
            pointsAgainst: (matchingRoster.settings.fpts_against + (matchingRoster.settings.fpts_against_decimal / 100)),
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
      (team.coOwnerName && team.coOwnerName.toLowerCase().includes(searchTerm.toLowerCase()));

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
    <div className="space-y-6" data-id="d2r6f693v">
      {/* Page Header */}
      <div className="flex flex-col space-y-2" data-id="9kifswlf9">
        <div className="flex items-center space-x-2" data-id="cbo8lb0fe">
          <Users className="h-6 w-6 text-primary" data-id="lba92cgc4" />
          <h1 className="text-3xl font-bold" data-id="ub9kcovse">Teams</h1>
        </div>
        <p className="text-muted-foreground" data-id="69ki7fdbe">
          {selectedSeason} Season • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          } • {filteredTeams.length} teams
        </p>
      </div>

      {/* Search Bar and Refresh */}
      <div className="flex items-center space-x-2" data-id="lk34i6dpv">
        <div className="relative flex-1 max-w-md" data-id="x0en7aiax">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" data-id="p5wmjfhhi" />
          <Input
            placeholder="Search teams or owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10" data-id="fxizdfmy0" />
        </div>
        <Button variant="outline" onClick={() => setSearchTerm('')} data-id="wq5mi605l">
          Clear
        </Button>
        <Button 
          variant="outline" 
          onClick={fetchTeamsData} 
          disabled={loading}
          data-id="refresh-btn"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <Card data-id="loading-card">
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Loading Teams</h3>
            <p className="text-muted-foreground">Fetching team data from Sleeper API...</p>
          </CardContent>
        </Card>
      )}
      
      {/* Error State */}
      {error && !loading && (
        <Card data-id="error-card">
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
      )}
      
      {/* Teams Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-id="hrj38fwkv">
          {filteredTeams.map((team) =>
            <Card key={team.id} className="hover:shadow-lg transition-shadow" data-id="y0pho5oio">
            <CardHeader className="pb-4" data-id="c8ksz31rc">
              <div className="flex items-start justify-between" data-id="xkuwvnrtz">
                <div className="flex items-center space-x-3" data-id="s0zykx7kl">
                  <Avatar className="h-12 w-12" data-id="0u97ns8x5">
                    <AvatarImage src={team.ownerAvatar || undefined} data-id="m60ey7qau" />
                    <AvatarFallback className="bg-primary/10" data-id="u4civsuyz">
                      {team.ownerName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div data-id="yp33kltml">
                    <CardTitle className="text-lg leading-tight" data-id="vhxypt52h">{team.teamName}</CardTitle>
                    <CardDescription data-id="hn5k37bhv">
                      {team.ownerName}
                      {team.coOwnerName && ` & ${team.coOwnerName}`}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-1" data-id="jdps3sizy">
                  {team.rank <= 3 && <Trophy className="h-4 w-4 text-yellow-500" data-id="p626vbbx6" />}
                  <span className="text-sm font-semibold" data-id="914dc2lf8">#{team.rank}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4" data-id="pc1473cbu">
              {/* Conference Badge */}
              <Badge variant="outline" className="text-xs" data-id="4a71kplth">
                {team.conference}
              </Badge>

              {/* Record and Stats */}
              <div className="grid grid-cols-2 gap-4" data-id="zs3yqdtrq">
                <div data-id="mil6pkksx">
                  <p className="text-sm text-muted-foreground" data-id="mx6263fte">Record</p>
                  <Badge variant={getRecordBadgeVariant(team.record.wins, team.record.losses)} data-id="y71ug955i">
                    {team.record.wins}-{team.record.losses}
                    {team.record.ties > 0 && `-${team.record.ties}`}
                  </Badge>
                </div>
                <div data-id="wn4fgesoe">
                  <p className="text-sm text-muted-foreground" data-id="nmodsrs5o">Streak</p>
                  <div className="flex items-center space-x-1" data-id="baypa7kll">
                    <TrendingUp className={`h-4 w-4 ${getStreakColor(team.streak)}`} data-id="il5jth3xg" />
                    <span className={`font-semibold ${getStreakColor(team.streak)}`} data-id="7emuiu0hs">
                      {team.streak}
                    </span>
                  </div>
                </div>
              </div>

              {/* Points */}
              <div className="grid grid-cols-2 gap-4 text-sm" data-id="u796y9p9k">
                <div data-id="tjtwo3i2v">
                  <p className="text-muted-foreground" data-id="ys164dxkr">Points For</p>
                  <p className="font-semibold" data-id="4d67l7moc">{team.pointsFor.toFixed(1)}</p>
                </div>
                <div data-id="389my87cy">
                  <p className="text-muted-foreground" data-id="zie823fk9">Points Against</p>
                  <p className="font-semibold" data-id="6jn576y3o">{team.pointsAgainst.toFixed(1)}</p>
                </div>
              </div>

              {/* Team Activity */}
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground" data-id="xahgiazmm">
                <div className="text-center" data-id="19wx9u8ju">
                  <p className="font-medium" data-id="fvkv0dqd8">{team.rosterCount}</p>
                  <p data-id="prp9t5o0r">Roster</p>
                </div>
                <div className="text-center" data-id="c2fij8a6n">
                  <p className="font-medium" data-id="l1jf0cyd3">{team.waiversCount}</p>
                  <p data-id="lroxten6c">Moves</p>
                </div>
                <div className="text-center" data-id="ns3iifv74">
                  <p className="font-medium" data-id="85kzjoasp">#{team.rosterId}</p>
                  <p data-id="w3ub7uu2b">Roster ID</p>
                </div>
              </div>

              {/* View Team Button */}
              <Link to={`/teams/${team.id}`} className="w-full" data-id="hwbx5x2t7">
                <Button variant="outline" className="w-full" data-id="ch3o7ujf1">
                  <ExternalLink className="mr-2 h-4 w-4" data-id="218i30npf" />
                  View Team Details
                </Button>
              </Link>
            </CardContent>
          </Card>
          )}
        </div>
      )}

      {/* No Results */}
      {!loading && !error && filteredTeams.length === 0 &&
        <Card data-id="w6xy764fl">
          <CardContent className="py-12 text-center" data-id="vvem02to2">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" data-id="et33wwsqi" />
            <h3 className="text-lg font-semibold mb-2" data-id="jf5rzflce">No teams found</h3>
            <p className="text-muted-foreground mb-4" data-id="a4s8ckpo1">
              No teams match your current search criteria.
            </p>
            <Button variant="outline" onClick={() => setSearchTerm('')} data-id="810xvgglm">
              Clear Search
            </Button>
          </CardContent>
        </Card>
      }

      {/* Summary Stats */}
      {!loading && !error && filteredTeams.length > 0 &&
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-id="x9nqkq9kz">
          <Card data-id="x59l2vdql">
            <CardHeader className="pb-2" data-id="kjokxjtuq">
              <CardDescription data-id="vzdk4clxk">Average Points For</CardDescription>
              <CardTitle className="text-2xl" data-id="et5zrhffc">
                {(filteredTeams.reduce((sum, team) => sum + team.pointsFor, 0) / filteredTeams.length).toFixed(1)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card data-id="cse0brt30">
            <CardHeader className="pb-2" data-id="yvgew04tb">
              <CardDescription data-id="t5nd6fka9">Most Active Team</CardDescription>
              <CardTitle className="text-lg" data-id="x2qj3krc2">
                {filteredTeams.reduce((prev, current) =>
                  prev.waiversCount > current.waiversCount ? prev : current
                ).teamName}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card data-id="ytvgl6sg7">
            <CardHeader className="pb-2" data-id="hdjeg59j5">
              <CardDescription data-id="85wv5vjh1">Total Moves</CardDescription>
              <CardTitle className="text-2xl" data-id="gj361hu7x">
                {filteredTeams.reduce((sum, team) => sum + team.waiversCount, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    </div>
  );

};

export default TeamsPage;