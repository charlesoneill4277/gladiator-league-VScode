import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Trophy, TrendingUp, Calendar, Star } from 'lucide-react';

// Mock data for team detail - this will be replaced with real Sleeper API data
const mockTeamDetail = {
  id: '1',
  teamName: 'Galactic Gladiators',
  ownerName: 'John Doe',
  ownerAvatar: null,
  conference: 'Legions of Mars',
  record: { wins: 11, losses: 2, ties: 0 },
  pointsFor: 1485.2,
  pointsAgainst: 1289.5,
  rank: 1,
  streak: 'W5',
  avgPointsFor: 114.2,
  roster: [
    {
      id: 'player1',
      name: 'Josh Allen',
      position: 'QB',
      team: 'BUF',
      points: 287.5,
      starter: true,
      injury_status: null
    },
    {
      id: 'player2',
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      points: 245.8,
      starter: true,
      injury_status: 'IR'
    },
    {
      id: 'player3',
      name: 'Tyreek Hill',
      position: 'WR',
      team: 'MIA',
      points: 198.2,
      starter: true,
      injury_status: null
    },
    {
      id: 'player4',
      name: 'Travis Kelce',
      position: 'TE',
      team: 'KC',
      points: 156.7,
      starter: true,
      injury_status: 'Q'
    },
    {
      id: 'player5',
      name: 'Justin Tucker',
      position: 'K',
      team: 'BAL',
      points: 112.3,
      starter: true,
      injury_status: null
    }
  ],
  transactions: [
    {
      id: 'trans1',
      type: 'waiver',
      date: '2024-12-10',
      description: 'Added Jerome Ford, Dropped Antonio Gibson',
      week: 14
    },
    {
      id: 'trans2',
      type: 'trade',
      date: '2024-11-28',
      description: 'Traded Saquon Barkley for Stefon Diggs + 2025 2nd Round Pick',
      week: 12,
      tradePartner: 'Space Vikings'
    },
    {
      id: 'trans3',
      type: 'waiver',
      date: '2024-11-20',
      description: 'Added Tank Dell, Dropped Marquise Goodwin',
      week: 11
    }
  ],
  weeklyScores: [
    { week: 1, score: 128.5, opponent: 'Space Vikings', result: 'W' },
    { week: 2, score: 105.2, opponent: 'Meteor Crushers', result: 'L' },
    { week: 3, score: 142.8, opponent: 'Asteroid Miners', result: 'W' },
    { week: 4, score: 118.6, opponent: 'Solar Flares', result: 'W' },
    { week: 5, score: 95.4, opponent: 'Nebula Nomads', result: 'L' },
    { week: 6, score: 134.2, opponent: 'Cosmic Crusaders', result: 'W' }
  ]
};

const TeamDetailPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [activeTab, setActiveTab] = useState('roster');

  // In a real app, you would fetch team data based on teamId
  const team = mockTeamDetail;

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-green-100 text-green-800';
      case 'WR': return 'bg-blue-100 text-blue-800';
      case 'TE': return 'bg-yellow-100 text-yellow-800';
      case 'K': return 'bg-purple-100 text-purple-800';
      case 'DEF': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status) return null;
    
    const variants: { [key: string]: string } = {
      'IR': 'destructive',
      'O': 'destructive',
      'D': 'destructive',
      'Q': 'secondary',
      'P': 'outline'
    };
    
    return <Badge variant={variants[status] || 'outline'} className="text-xs">{status}</Badge>;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'trade': return '🔄';
      case 'waiver': return '📈';
      case 'draft': return '🎯';
      default: return '📝';
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/teams">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Teams
        </Button>
      </Link>

      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={team.ownerAvatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-lg">
              {team.ownerName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{team.teamName}</h1>
            <p className="text-muted-foreground">Owned by {team.ownerName}</p>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline">{team.conference}</Badge>
              <Badge variant="secondary">Rank #{team.rank}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{team.record.wins}-{team.record.losses}</div>
            <div className="text-sm text-muted-foreground">Record</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{team.pointsFor.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground">Points For</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{team.avgPointsFor.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg/Game</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{team.streak}</div>
            <div className="text-sm text-muted-foreground">Streak</div>
          </div>
        </div>
      </div>

      {/* Team Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Roster Tab */}
        <TabsContent value="roster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Current Roster</span>
              </CardTitle>
              <CardDescription>
                Active players and their season performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.roster.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <Link to={`/players/${player.id}`} className="font-medium hover:underline">
                            {player.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPositionColor(player.position)}>
                            {player.position}
                          </Badge>
                        </TableCell>
                        <TableCell>{player.team}</TableCell>
                        <TableCell className="text-right font-mono">
                          {player.points.toFixed(1)}
                        </TableCell>
                        <TableCell>
                          {getInjuryBadge(player.injury_status)}
                        </TableCell>
                        <TableCell>
                          {player.starter && (
                            <Badge variant="outline" className="text-xs">
                              <Star className="mr-1 h-3 w-3" />
                              Starter
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5" />
                  <span>Season Stats</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Points For</p>
                    <p className="text-2xl font-bold">{team.pointsFor.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Points Against</p>
                    <p className="text-2xl font-bold">{team.pointsAgainst.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Point Differential</p>
                    <p className="text-2xl font-bold text-green-600">
                      +{(team.pointsFor - team.pointsAgainst).toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Percentage</p>
                    <p className="text-2xl font-bold">
                      {((team.record.wins / (team.record.wins + team.record.losses)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Weekly Scores</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {team.weeklyScores.slice(-6).map((week) => (
                    <div key={week.week} className="flex items-center justify-between p-2 rounded-md bg-accent/50">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">Week {week.week}</Badge>
                        <span className="text-sm text-muted-foreground">vs {week.opponent}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono">{week.score}</span>
                        <Badge variant={week.result === 'W' ? 'default' : 'destructive'}>
                          {week.result}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Recent Transactions</span>
              </CardTitle>
              <CardDescription>
                Trades, waivers, and roster moves
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {team.transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-start space-x-3 p-3 rounded-md border">
                    <div className="text-2xl">{getTransactionIcon(transaction.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          Week {transaction.week}
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {transaction.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">{transaction.description}</p>
                      {transaction.tradePartner && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Trade partner: {transaction.tradePartner}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Season Schedule</CardTitle>
              <CardDescription>
                Complete schedule with results and upcoming matchups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Full schedule view will be implemented when connected to Sleeper API.
                This will show all past and upcoming matchups with scores and opponents.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamDetailPage;