import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { useStandingsData } from '@/hooks/useStandingsData';
import { StandingsService } from '@/services/standingsService';
import {
  Shield,
  Trophy,
  Swords,
  Users,
  TrendingUp,
  Calendar,
  ArrowRight,
  Activity,
  Star,
  Loader2
} from 'lucide-react';

// Mock data for other sections - will be replaced with real API data
const mockDashboardData = {
  currentWeek: 14,
  currentMatchups: [
  {
    id: '1',
    conference: 'Legions of Mars',
    homeTeam: { name: 'Galactic Gladiators', score: 127.5 },
    awayTeam: { name: 'Mars Rovers', score: 98.2 },
    status: 'live'
  },
  {
    id: '2',
    conference: 'Guardians of Jupiter',
    homeTeam: { name: 'Space Vikings', score: 112.8 },
    awayTeam: { name: 'Storm Chasers', score: 134.2 },
    status: 'live'
  },
  {
    id: '3',
    conference: "Vulcan's Oathsworn",
    homeTeam: { name: 'Meteor Crushers', score: 0 },
    awayTeam: { name: 'Forge Masters', score: 0 },
    status: 'upcoming'
  }],

  recentTransactions: [
  { id: '1', team: 'Space Vikings', action: 'Added Jerome Ford', type: 'waiver', date: '2024-12-15' },
  { id: '2', team: 'Galactic Gladiators', action: 'Traded Saquon Barkley for Stefon Diggs', type: 'trade', date: '2024-12-14' },
  { id: '3', team: 'Meteor Crushers', action: 'Added Tank Dell', type: 'waiver', date: '2024-12-13' },
  { id: '4', team: 'Solar Flares', action: 'Dropped Antonio Gibson', type: 'drop', date: '2024-12-12' },
  { id: '5', team: 'Asteroid Miners', action: 'Added Romeo Doubs', type: 'waiver', date: '2024-12-11' }],

  keyMetrics: {
    totalTeams: 36,
    totalGames: 468,
    avgPointsPerGame: 112.5,
    highestScore: 187.2,
    totalTransactions: 284
  }
};

const HomePage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  
  // Get the current season year from the season configuration
  const currentSeasonYear = currentSeasonConfig?.year || 2025;
  
  // Fetch live standings data
  const { 
    standings, 
    loading: standingsLoading, 
    error: standingsError, 
    refetch: refetchStandings 
  } = useStandingsData({
    seasonYear: currentSeasonYear,
    conferenceId: selectedConference === 'all' ? undefined : selectedConference,
    limit: 5,
    autoRefresh: true,
    refreshInterval: 60000 // Refresh every minute
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500 hover:bg-green-600 text-xs" data-id="ko0wj23h5">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="text-xs" data-id="y59ikmzvm">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline" className="text-xs" data-id="nj447g6ex">Upcoming</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs" data-id="ggcxw6qx4">{status}</Badge>;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'trade':return '🔄';
      case 'waiver':return '📈';
      case 'drop':return '📉';
      default:return '📝';
    }
  };

  const renderStandings = () => {
    if (standingsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading standings...</span>
        </div>
      );
    }

    if (standingsError) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-red-600 mb-4">Error loading standings: {standingsError}</p>
          <Button variant="outline" size="sm" onClick={refetchStandings}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!standings || standings.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-sm text-muted-foreground">No standings data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {standings.map((team) => (
          <div key={team.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                {team.overall_rank === 1 && <Star className="h-4 w-4 text-yellow-500" />}
                <span className="font-semibold w-6">#{team.overall_rank}</span>
              </div>
              <div>
                <p className="font-medium">{team.team_name}</p>
                <p className="text-xs text-muted-foreground">{team.owner_name} • {team.conference_name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">{StandingsService.formatRecord(team.wins, team.losses, team.ties)}</p>
              <p className="text-xs text-muted-foreground">{StandingsService.formatPoints(team.points_for)} pts</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-id="0mmz23e37">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background border" data-id="efblbr1ws">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" data-id="yxaxcutum" />
        <div className="relative px-6 py-12 sm:px-12" data-id="oapmfhe3l">
          <div className="flex flex-col items-center text-center space-y-4" data-id="604905rne">
            <div className="flex items-center space-x-3" data-id="d5az7puyx">
              <Shield className="h-12 w-12 text-primary" data-id="2hilq90n1" />
              <div data-id="vl46aexqb">
                <h1 className="text-4xl font-bold tracking-tight" data-id="ump9vs71o">Gladiator League</h1>
                <p className="text-lg text-muted-foreground" data-id="1u70llgko">Fantasy Football Championship</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl" data-id="pcmooxx3r">
              Welcome to the ultimate fantasy football experience. Track your teams across three 
              competitive conferences in real-time.
            </p>
            <div className="flex items-center space-x-2 mt-4" data-id="b6gsae563">
              <Badge variant="outline" data-id="jzwpsw59a">{selectedSeason} Season</Badge>
              <Badge variant="outline" data-id="ocfl6we74">Week {mockDashboardData.currentWeek}</Badge>
              {selectedConference &&
              <Badge variant="secondary" data-id="xcjmtymly">
                  {currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name}
                </Badge>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4" data-id="ytbeco6un">
        <Card data-id="7d6v2mz7t">
          <CardHeader className="pb-2" data-id="ndtv7enp6">
            <CardDescription data-id="4crxh1y7s">Total Teams</CardDescription>
            <CardTitle className="text-2xl" data-id="d3f42ez5g">{mockDashboardData.keyMetrics.totalTeams}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card data-id="v4yxoevrg">
          <CardHeader className="pb-2" data-id="7k2rn7bur">
            <CardDescription data-id="rmarmooaa">Games Played</CardDescription>
            <CardTitle className="text-2xl" data-id="z1zzb2276">{mockDashboardData.keyMetrics.totalGames}</CardTitle>
          </CardHeader>
        </Card>

        <Card data-id="3d8x2bwkq">
          <CardHeader className="pb-2" data-id="p2r8ggu2v">
            <CardDescription data-id="6on59gahg">Avg Score</CardDescription>
            <CardTitle className="text-2xl" data-id="yksvuean5">{mockDashboardData.keyMetrics.avgPointsPerGame}</CardTitle>
          </CardHeader>
        </Card>

        <Card data-id="t4a2x11a7">
          <CardHeader className="pb-2" data-id="g5yvqivez">
            <CardDescription data-id="sj4fv9eb2">High Score</CardDescription>
            <CardTitle className="text-2xl" data-id="72enzdfpo">{mockDashboardData.keyMetrics.highestScore}</CardTitle>
          </CardHeader>
        </Card>

        <Card data-id="pgvah2x6a">
          <CardHeader className="pb-2" data-id="9vk9ac7qc">
            <CardDescription data-id="4503dy8lj">Transactions</CardDescription>
            <CardTitle className="text-2xl" data-id="750id85kk">{mockDashboardData.keyMetrics.totalTransactions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-id="3pcf5momq">
        {/* Current Standings */}
        <Card className="lg:col-span-2" data-id="u6eptzovw">
          <CardHeader data-id="v2kc916w1">
            <div className="flex items-center justify-between" data-id="3ule77vlt">
              <div className="flex items-center space-x-2" data-id="t16ez2uj8">
                <Trophy className="h-5 w-5 text-primary" data-id="k08jnuz4j" />
                <CardTitle data-id="di9umi7ib">League Standings</CardTitle>
              </div>
              <Link to="/standings" data-id="ba72apcoj">
                <Button variant="ghost" size="sm" data-id="9ge9uut1i">
                  View All <ArrowRight className="ml-1 h-4 w-4" data-id="ur35maa5l" />
                </Button>
              </Link>
            </div>
            <CardDescription data-id="pyzxxtqk2">
              Top 5 teams across all conferences
            </CardDescription>
          </CardHeader>
          <CardContent data-id="o81214jkv">
            {renderStandings()}
          </CardContent>
        </Card>

        {/* Current Matchups */}
        <Card data-id="iu38s7g60">
          <CardHeader data-id="lb2jexkbq">
            <div className="flex items-center justify-between" data-id="63oay7464">
              <div className="flex items-center space-x-2" data-id="qy61xanby">
                <Swords className="h-5 w-5 text-primary" data-id="7mwz6gpfz" />
                <CardTitle data-id="rjewfovsi">Week {mockDashboardData.currentWeek}</CardTitle>
              </div>
              <Link to="/matchups" data-id="g2gu9ok28">
                <Button variant="ghost" size="sm" data-id="eziklhglb">
                  <ArrowRight className="h-4 w-4" data-id="l06kuebxr" />
                </Button>
              </Link>
            </div>
            <CardDescription data-id="5newayilf">Current matchups</CardDescription>
          </CardHeader>
          <CardContent data-id="q4eg0ja0d">
            <div className="space-y-4" data-id="ghkl7wqzg">
              {mockDashboardData.currentMatchups.map((matchup) =>
              <div key={matchup.id} className="space-y-2" data-id="tfxm5pby8">
                  <div className="flex items-center justify-between" data-id="16opj39ih">
                    <Badge variant="outline" className="text-xs" data-id="ejo80kvtl">
                      {matchup.conference.split(' ')[0]}
                    </Badge>
                    {getStatusBadge(matchup.status)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center text-sm" data-id="eja23k1x9">
                    <div className="text-right" data-id="3xgczmr6q">
                      <p className="font-medium truncate" data-id="5d1m1sjeb">{matchup.homeTeam.name}</p>
                      <p className="text-lg font-bold" data-id="9sju87k8w">
                        {matchup.status === 'upcoming' ? '--' : matchup.homeTeam.score.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center text-muted-foreground font-semibold" data-id="hufkhg8hr">
                      VS
                    </div>
                    <div className="text-left" data-id="kz3uhwnj9">
                      <p className="font-medium truncate" data-id="a47xq4uub">{matchup.awayTeam.name}</p>
                      <p className="text-lg font-bold" data-id="dvdaa2m0x">
                        {matchup.status === 'upcoming' ? '--' : matchup.awayTeam.score.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-id="hmr1aw0vn">
        {/* Recent Transactions */}
        <Card data-id="x171h0auk">
          <CardHeader data-id="i7utp8dz8">
            <div className="flex items-center justify-between" data-id="w56seonje">
              <div className="flex items-center space-x-2" data-id="2frndtjog">
                <Activity className="h-5 w-5 text-primary" data-id="s6gtbn7xj" />
                <CardTitle data-id="60rtgblef">Recent Transactions</CardTitle>
              </div>
              <Link to="/teams" data-id="xcrs7pqsf">
                <Button variant="ghost" size="sm" data-id="3y6ksyg62">
                  View All <ArrowRight className="ml-1 h-4 w-4" data-id="g17mfgb6x" />
                </Button>
              </Link>
            </div>
            <CardDescription data-id="xe4loqfar">
              Latest roster moves across all conferences
            </CardDescription>
          </CardHeader>
          <CardContent data-id="66gf40efp">
            <div className="space-y-3" data-id="n6ilpow80">
              {mockDashboardData.recentTransactions.map((transaction) =>
              <div key={transaction.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-accent/50" data-id="tup7lafka">
                  <div className="text-lg" data-id="q1gqod650">{getTransactionIcon(transaction.type)}</div>
                  <div className="flex-1 min-w-0" data-id="5ljxob34d">
                    <p className="text-sm font-medium" data-id="pr8qly8az">{transaction.team}</p>
                    <p className="text-xs text-muted-foreground truncate" data-id="7gw7s41zv">{transaction.action}</p>
                    <p className="text-xs text-muted-foreground" data-id="p1av3gip4">
                      {new Date(transaction.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card data-id="n2sbetlkv">
          <CardHeader data-id="74m2q6ru6">
            <CardTitle className="flex items-center space-x-2" data-id="ggenwzsx1">
              <Users className="h-5 w-5 text-primary" data-id="2rzs8a5ku" />
              <span data-id="oru2sergo">Quick Actions</span>
            </CardTitle>
            <CardDescription data-id="2pvdllbog">
              Navigate to key sections of the league
            </CardDescription>
          </CardHeader>
          <CardContent data-id="h0c28ltsp">
            <div className="grid grid-cols-2 gap-3" data-id="quqe2fxsy">
              <Link to="/standings" data-id="nk0tusrru">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1" data-id="tf4hb45il">
                  <Trophy className="h-5 w-5" data-id="35we5zetj" />
                  <span className="text-xs" data-id="217vs7d8z">Standings</span>
                </Button>
              </Link>
              
              <Link to="/matchups" data-id="lg1o0t2y4">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1" data-id="2q3foygop">
                  <Swords className="h-5 w-5" data-id="df3942e3f" />
                  <span className="text-xs" data-id="zx0mugns7">Matchups</span>
                </Button>
              </Link>
              
              <Link to="/teams" data-id="edf8gnszy">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1" data-id="xvoqc0fux">
                  <Users className="h-5 w-5" data-id="zi9nkb8ao" />
                  <span className="text-xs" data-id="roeiml3dj">Teams</span>
                </Button>
              </Link>
              
              <Link to="/players" data-id="a17bvqh4i">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1" data-id="a4q9hswh8">
                  <Activity className="h-5 w-5" data-id="uaoquvfi2" />
                  <span className="text-xs" data-id="rvlh1zld1">Players</span>
                </Button>
              </Link>
              
              <Link to="/draft" data-id="145fb2042">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1" data-id="77yf6aid7">
                  <Shield className="h-5 w-5" data-id="y4ywrwehq" />
                  <span className="text-xs" data-id="wx1cfq3va">Draft Results</span>
                </Button>
              </Link>
              
              <Link to="/rules" data-id="bqnp9r27i">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1" data-id="d23gbyb9l">
                  <Calendar className="h-5 w-5" data-id="7uimlvrhd" />
                  <span className="text-xs" data-id="964h6nuzg">League Rules</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* League Information */}
      <Card data-id="kecz0li9f">
        <CardHeader data-id="uqht7b9p0">
          <CardTitle data-id="9izfyfz3e">League Information</CardTitle>
          <CardDescription data-id="kmysmh45y">
            Current season details and conference structure
          </CardDescription>
        </CardHeader>
        <CardContent data-id="nxh24xlly">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-id="50l2zl1ek">
            {currentSeasonConfig.conferences.map((conference) =>
            <div key={conference.id} className="text-center p-4 border rounded-lg" data-id="kar3zdlg2">
                <h4 className="font-semibold mb-2" data-id="g8cux6w61">{conference.name}</h4>
                <p className="text-sm text-muted-foreground mb-2" data-id="6ad6nbwy0">
                  12 teams • 14-week season
                </p>
                <Badge variant="outline" className="text-xs" data-id="l2tkqyqyw">
                  Conference ID: {conference.id}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default HomePage;
