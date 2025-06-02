import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, User, TrendingUp, Calendar, AlertCircle, Trophy } from 'lucide-react';

// Mock data for player detail - this will be replaced with real Sleeper API data
const mockPlayerDetail = {
  id: 'player1',
  name: 'Josh Allen',
  position: 'QB',
  nflTeam: 'BUF',
  number: 17,
  age: 27,
  height: "6'5\"",
  weight: 237,
  college: 'Wyoming',
  experience: 6,
  injuryStatus: null,
  points: 287.5,
  avgPoints: 22.1,
  projectedPoints: 24.8,
  status: 'rostered',
  rosteredBy: 'Galactic Gladiators',
  rosteredByOwner: 'John Doe',
  ownershipPercentage: 98.2,
  weeklyStats: [
  { week: 1, points: 28.5, opponent: 'vs ARI', result: 'W', projection: 24.2 },
  { week: 2, points: 18.3, opponent: '@ MIA', result: 'L', projection: 22.8 },
  { week: 3, points: 31.2, opponent: 'vs JAX', result: 'W', projection: 25.1 },
  { week: 4, points: 15.7, opponent: '@ BAL', result: 'L', projection: 21.6 },
  { week: 5, points: 26.8, opponent: 'vs HOU', result: 'W', projection: 23.9 },
  { week: 6, points: 24.1, opponent: '@ NYJ', result: 'W', projection: 22.4 },
  { week: 7, points: 19.6, opponent: 'vs TEN', result: 'W', projection: 24.7 },
  { week: 8, points: 22.9, opponent: '@ SEA', result: 'W', projection: 23.3 },
  { week: 9, points: 28.7, opponent: 'vs MIA', result: 'W', projection: 25.8 },
  { week: 10, points: 16.4, opponent: '@ IND', result: 'L', projection: 21.9 },
  { week: 11, points: 33.1, opponent: 'vs KC', result: 'W', projection: 26.2 },
  { week: 12, points: 25.4, opponent: '@ PHI', result: 'W', projection: 24.5 },
  { week: 13, points: 21.8, opponent: 'vs SF', result: 'W', projection: 23.7 }],

  seasonStats: {
    passingYards: 3731,
    passingTDs: 28,
    interceptions: 15,
    rushingYards: 421,
    rushingTDs: 12,
    completionPercentage: 63.2,
    qbRating: 89.4
  },
  news: [
  {
    id: 'news1',
    date: '2024-12-15',
    headline: 'Josh Allen leads Bills to division clinching victory',
    summary: 'Allen threw for 3 TDs and rushed for another in the 35-21 win over the Lions.',
    source: 'ESPN'
  },
  {
    id: 'news2',
    date: '2024-12-12',
    headline: 'Allen named AFC Offensive Player of the Week',
    summary: 'Fourth time this season Allen has received the honor after dominant performance.',
    source: 'NFL.com'
  }]

};

const PlayerDetailPage: React.FC = () => {
  const { playerId } = useParams<{playerId: string;}>();
  const [activeTab, setActiveTab] = useState('overview');

  // In a real app, you would fetch player data based on playerId
  const player = mockPlayerDetail;

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB':return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR':return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE':return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'K':return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'DEF':return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status) return null;

    const variants: {[key: string]: string;} = {
      'IR': 'destructive',
      'O': 'destructive',
      'D': 'destructive',
      'Q': 'secondary',
      'P': 'outline'
    };

    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const calculateConsistency = () => {
    const scores = player.weeklyStats.map((w) => w.points);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = stdDev / mean;
    return Math.max(0, 100 - coefficient * 100);
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/players">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Players
        </Button>
      </Link>

      {/* Player Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{player.name}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={getPositionColor(player.position)}>
                {player.position}
              </Badge>
              <Badge variant="outline">{player.nflTeam} #{player.number}</Badge>
              {getInjuryBadge(player.injuryStatus)}
            </div>
            <p className="text-muted-foreground mt-1">
              {player.age} years old • {player.height}, {player.weight} lbs • {player.college}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{player.points.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Total Points</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{player.avgPoints.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg/Game</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{player.projectedPoints.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Projected</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{player.ownershipPercentage.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Rostered</div>
          </div>
        </div>
      </div>

      {/* Current Team Info */}
      {player.rosteredBy &&
      <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Currently rostered by</p>
                <div className="flex items-center space-x-2">
                  <p className="font-semibold">{player.rosteredBy}</p>
                  <span className="text-muted-foreground">•</span>
                  <p className="text-muted-foreground">{player.rosteredByOwner}</p>
                </div>
              </div>
              <Link to={`/teams/${player.rosteredBy.toLowerCase().replace(/\s+/g, '-')}`}>
                <Button variant="outline" size="sm">
                  View Team
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      }

      {/* Player Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5" />
                  <span>Season Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Fantasy Points</p>
                    <p className="text-2xl font-bold">{player.points.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Games Played</p>
                    <p className="text-2xl font-bold">{player.weeklyStats.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best Game</p>
                    <p className="text-2xl font-bold">
                      {Math.max(...player.weeklyStats.map((w) => w.points)).toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Consistency</p>
                    <p className="text-2xl font-bold">{calculateConsistency().toFixed(0)}%</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Performance vs Projection</span>
                    <span>{(player.avgPoints / player.projectedPoints * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={player.avgPoints / player.projectedPoints * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Player Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Position</p>
                    <p className="font-medium">{player.position}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NFL Team</p>
                    <p className="font-medium">{player.nflTeam}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Number</p>
                    <p className="font-medium">#{player.number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Experience</p>
                    <p className="font-medium">{player.experience} years</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Height</p>
                    <p className="font-medium">{player.height}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Weight</p>
                    <p className="font-medium">{player.weight} lbs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">College</p>
                    <p className="font-medium">{player.college}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Age</p>
                    <p className="font-medium">{player.age}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Season Statistics</CardTitle>
              <CardDescription>
                NFL statistics for the current season
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{player.seasonStats.passingYards.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Passing Yards</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{player.seasonStats.passingTDs}</p>
                  <p className="text-sm text-muted-foreground">Passing TDs</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{player.seasonStats.interceptions}</p>
                  <p className="text-sm text-muted-foreground">Interceptions</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{player.seasonStats.completionPercentage.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Completion %</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{player.seasonStats.rushingYards}</p>
                  <p className="text-sm text-muted-foreground">Rushing Yards</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{player.seasonStats.rushingTDs}</p>
                  <p className="text-sm text-muted-foreground">Rushing TDs</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{player.seasonStats.qbRating.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">QB Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Weekly Performance</span>
              </CardTitle>
              <CardDescription>
                Fantasy points by week with projections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Opponent</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-right">Projection</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {player.weeklyStats.slice(-10).map((week) =>
                    <TableRow key={week.week}>
                        <TableCell className="font-medium">Week {week.week}</TableCell>
                        <TableCell>{week.opponent}</TableCell>
                        <TableCell className="text-right font-mono">
                          {week.points.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {week.projection.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={week.points > week.projection ? 'text-green-600' : 'text-red-600'}>
                            {week.points > week.projection ? '+' : ''}{(week.points - week.projection).toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={week.result === 'W' ? 'default' : 'destructive'}>
                            {week.result}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Recent News</span>
              </CardTitle>
              <CardDescription>
                Latest news and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {player.news.map((article) =>
                <div key={article.id} className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{article.headline}</h4>
                      <Badge variant="outline" className="text-xs">
                        {article.source}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {article.summary}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(article.date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                
                {player.injuryStatus &&
                <div className="flex items-start space-x-3 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                        Injury Status: {player.injuryStatus}
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Player is currently listed with an injury designation. Monitor status updates.
                      </p>
                    </div>
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default PlayerDetailPage;