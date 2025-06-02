import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { 
  Shield, 
  Trophy, 
  Swords, 
  Users, 
  TrendingUp, 
  Calendar, 
  ArrowRight,
  Activity,
  Star
} from 'lucide-react';

// Mock data for homepage - this will be replaced with real Sleeper API data
const mockDashboardData = {
  currentWeek: 14,
  standings: [
    { rank: 1, team: 'Galactic Gladiators', owner: 'John Doe', record: '11-2', points: 1485.2, conference: 'Legions of Mars' },
    { rank: 2, team: 'Space Vikings', owner: 'Jane Smith', record: '10-3', points: 1442.8, conference: 'Guardians of Jupiter' },
    { rank: 3, team: 'Meteor Crushers', owner: 'Bob Johnson', record: '9-4', points: 1398.6, conference: "Vulcan's Oathsworn" },
    { rank: 4, team: 'Asteroid Miners', owner: 'Alice Brown', record: '8-5', points: 1376.4, conference: 'Guardians of Jupiter' },
    { rank: 5, team: 'Solar Flares', owner: 'Charlie Wilson', record: '7-6', points: 1298.8, conference: "Vulcan's Oathsworn" }
  ],
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
    }
  ],
  recentTransactions: [
    { id: '1', team: 'Space Vikings', action: 'Added Jerome Ford', type: 'waiver', date: '2024-12-15' },
    { id: '2', team: 'Galactic Gladiators', action: 'Traded Saquon Barkley for Stefon Diggs', type: 'trade', date: '2024-12-14' },
    { id: '3', team: 'Meteor Crushers', action: 'Added Tank Dell', type: 'waiver', date: '2024-12-13' },
    { id: '4', team: 'Solar Flares', action: 'Dropped Antonio Gibson', type: 'drop', date: '2024-12-12' },
    { id: '5', team: 'Asteroid Miners', action: 'Added Romeo Doubs', type: 'waiver', date: '2024-12-11' }
  ],
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500 hover:bg-green-600 text-xs">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="text-xs">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline" className="text-xs">Upcoming</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'trade': return '🔄';
      case 'waiver': return '📈';
      case 'drop': return '📉';
      default: return '📝';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background border">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="relative px-6 py-12 sm:px-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-12 w-12 text-primary" />
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Gladiator League</h1>
                <p className="text-lg text-muted-foreground">Fantasy Football Championship</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Welcome to the ultimate fantasy football experience. Track your teams across three 
              competitive conferences in real-time.
            </p>
            <div className="flex items-center space-x-2 mt-4">
              <Badge variant="outline">{selectedSeason} Season</Badge>
              <Badge variant="outline">Week {mockDashboardData.currentWeek}</Badge>
              {selectedConference && (
                <Badge variant="secondary">
                  {currentSeasonConfig.conferences.find(c => c.id === selectedConference)?.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Teams</CardDescription>
            <CardTitle className="text-2xl">{mockDashboardData.keyMetrics.totalTeams}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Games Played</CardDescription>
            <CardTitle className="text-2xl">{mockDashboardData.keyMetrics.totalGames}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Score</CardDescription>
            <CardTitle className="text-2xl">{mockDashboardData.keyMetrics.avgPointsPerGame}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Score</CardDescription>
            <CardTitle className="text-2xl">{mockDashboardData.keyMetrics.highestScore}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transactions</CardDescription>
            <CardTitle className="text-2xl">{mockDashboardData.keyMetrics.totalTransactions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Standings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>League Standings</CardTitle>
              </div>
              <Link to="/standings">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>
              Top 5 teams across all conferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockDashboardData.standings.map((team) => (
                <div key={team.rank} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      {team.rank === 1 && <Star className="h-4 w-4 text-yellow-500" />}
                      <span className="font-semibold w-6">#{team.rank}</span>
                    </div>
                    <div>
                      <p className="font-medium">{team.team}</p>
                      <p className="text-xs text-muted-foreground">{team.owner} • {team.conference}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{team.record}</p>
                    <p className="text-xs text-muted-foreground">{team.points.toFixed(0)} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Matchups */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Swords className="h-5 w-5 text-primary" />
                <CardTitle>Week {mockDashboardData.currentWeek}</CardTitle>
              </div>
              <Link to="/matchups">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Current matchups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockDashboardData.currentMatchups.map((matchup) => (
                <div key={matchup.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {matchup.conference.split(' ')[0]}
                    </Badge>
                    {getStatusBadge(matchup.status)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center text-sm">
                    <div className="text-right">
                      <p className="font-medium truncate">{matchup.homeTeam.name}</p>
                      <p className="text-lg font-bold">
                        {matchup.status === 'upcoming' ? '--' : matchup.homeTeam.score.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center text-muted-foreground font-semibold">
                      VS
                    </div>
                    <div className="text-left">
                      <p className="font-medium truncate">{matchup.awayTeam.name}</p>
                      <p className="text-lg font-bold">
                        {matchup.status === 'upcoming' ? '--' : matchup.awayTeam.score.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>Recent Transactions</CardTitle>
              </div>
              <Link to="/teams">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>
              Latest roster moves across all conferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockDashboardData.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-accent/50">
                  <div className="text-lg">{getTransactionIcon(transaction.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{transaction.team}</p>
                    <p className="text-xs text-muted-foreground truncate">{transaction.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>
              Navigate to key sections of the league
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/standings">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                  <Trophy className="h-5 w-5" />
                  <span className="text-xs">Standings</span>
                </Button>
              </Link>
              
              <Link to="/matchups">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                  <Swords className="h-5 w-5" />
                  <span className="text-xs">Matchups</span>
                </Button>
              </Link>
              
              <Link to="/teams">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                  <Users className="h-5 w-5" />
                  <span className="text-xs">Teams</span>
                </Button>
              </Link>
              
              <Link to="/players">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                  <Activity className="h-5 w-5" />
                  <span className="text-xs">Players</span>
                </Button>
              </Link>
              
              <Link to="/draft">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                  <Shield className="h-5 w-5" />
                  <span className="text-xs">Draft Results</span>
                </Button>
              </Link>
              
              <Link to="/rules">
                <Button variant="outline" className="w-full h-16 flex flex-col space-y-1">
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs">League Rules</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* League Information */}
      <Card>
        <CardHeader>
          <CardTitle>League Information</CardTitle>
          <CardDescription>
            Current season details and conference structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {currentSeasonConfig.conferences.map((conference) => (
              <div key={conference.id} className="text-center p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{conference.name}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  4 teams • 14-week season
                </p>
                <Badge variant="outline" className="text-xs">
                  Conference ID: {conference.id}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomePage;