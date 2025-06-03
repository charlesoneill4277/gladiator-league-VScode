import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Trophy, TrendingUp, Calendar, Star, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { type SleeperRoster, type SleeperPlayer, type OrganizedRoster } from '../services/sleeperApi';

interface TeamData {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name?: string;
  co_owner_id?: string;
  team_logo_url?: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface ConferenceData {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url?: string;
}

interface TeamRosterData {
  roster: SleeperRoster;
  organizedRoster: OrganizedRoster;
  allPlayers: Record<string, SleeperPlayer>;
  teamData: TeamData;
  conferenceData: ConferenceData;
}

const TeamDetailPage: React.FC = () => {
  const { teamId } = useParams<{teamId: string;}>();
  const [activeTab, setActiveTab] = useState('roster');
  const [teamRosterData, setTeamRosterData] = useState<TeamRosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (teamId) {
      fetchTeamData(parseInt(teamId));
    }
  }, [teamId]);

  const fetchTeamData = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Fetching data for team ID: ${id}`);

      // Fetch team data from database
      const teamResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'id', op: 'Equal', value: id }]
      });

      if (teamResponse.error) throw new Error(teamResponse.error);
      if (!teamResponse.data?.List?.length) {
        throw new Error('Team not found');
      }

      const teamData = teamResponse.data.List[0] as TeamData;
      console.log('Team data:', teamData);

      // Find the conference this team belongs to
      const junctionResponse = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'team_id', op: 'Equal', value: id }]
      });

      if (junctionResponse.error) throw new Error(junctionResponse.error);
      if (!junctionResponse.data?.List?.length) {
        throw new Error('Team conference mapping not found');
      }

      const junction = junctionResponse.data.List[0];
      const rosterId = parseInt(junction.roster_id);
      console.log('Junction data:', junction, 'Roster ID:', rosterId);

      // Get conference data
      const conferenceResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'id', op: 'Equal', value: junction.conference_id }]
      });

      if (conferenceResponse.error) throw new Error(conferenceResponse.error);
      if (!conferenceResponse.data?.List?.length) {
        throw new Error('Conference not found');
      }

      const conferenceData = conferenceResponse.data.List[0] as ConferenceData;
      console.log('Conference data:', conferenceData);

      // Fetch roster data from Sleeper API
      console.log(`Fetching Sleeper data for league ${conferenceData.league_id}, roster ${rosterId}`);
      const sleeperData = await SleeperApiService.getTeamRosterData(
        conferenceData.league_id,
        rosterId
      );

      setTeamRosterData({
        ...sleeperData,
        teamData,
        conferenceData
      });

      console.log('Successfully loaded team roster data');

    } catch (error) {
      console.error('Error fetching team data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load team data';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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

  const getSlotPositionColor = (position: string) => {
    switch (position) {
      case 'FLEX': return 'bg-orange-100 text-orange-800';
      case 'SUPER_FLEX': return 'bg-pink-100 text-pink-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status || status === 'Active') return null;

    const variants: {[key: string]: string;} = {
      'IR': 'destructive',
      'Out': 'destructive',
      'Doubtful': 'destructive',
      'Questionable': 'secondary',
      'Probable': 'outline'
    };

    return <Badge variant={variants[status] || 'outline'} className="text-xs">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading team data...</span>
        </div>
      </div>
    );
  }

  if (error || !teamRosterData) {
    return (
      <div className="space-y-6">
        <Link to="/teams">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teams
          </Button>
        </Link>
        <Card>
          <CardContent className="flex items-center justify-center min-h-64">
            <div className="text-center space-y-2">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h3 className="text-lg font-semibold">Error Loading Team</h3>
              <p className="text-muted-foreground">{error || 'Team data not available'}</p>
              <Button onClick={() => teamId && fetchTeamData(parseInt(teamId))}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { roster, organizedRoster, allPlayers, teamData, conferenceData } = teamRosterData;
  
  // Calculate additional stats
  const totalPoints = SleeperApiService.formatPoints(roster.settings.fpts, roster.settings.fpts_decimal);
  const totalPointsAgainst = SleeperApiService.formatPoints(roster.settings.fpts_against, roster.settings.fpts_against_decimal);
  const gamesPlayed = roster.settings.wins + roster.settings.losses + roster.settings.ties;
  const avgPointsPerGame = SleeperApiService.calculatePointsPerGame(totalPoints, gamesPlayed);
  const winPercentage = gamesPlayed > 0 ? (roster.settings.wins / gamesPlayed * 100) : 0;

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
            <AvatarImage src={teamData.team_logo_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-lg" style={{backgroundColor: teamData.team_primary_color + '20'}}>
              {teamData.team_name.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{teamData.team_name}</h1>
            <p className="text-muted-foreground">Owned by {teamData.owner_name}</p>
            {teamData.co_owner_name && (
              <p className="text-sm text-muted-foreground">Co-owner: {teamData.co_owner_name}</p>
            )}
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline">{conferenceData.conference_name}</Badge>
              <Badge variant="secondary">Roster #{roster.roster_id}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{roster.settings.wins}-{roster.settings.losses}</div>
            <div className="text-sm text-muted-foreground">Record</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{totalPoints.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Points For</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{avgPointsPerGame.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg/Game</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{winPercentage.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Win %</div>
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
          {/* Starting Lineup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5" />
                <span>Starting Lineup</span>
              </CardTitle>
              <CardDescription>
                Current starting players for this roster
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>NFL Team</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizedRoster.starters.map((starter, index) => {
                      const player = allPlayers[starter.playerId];
                      return (
                        <TableRow key={`starter-${index}`}>
                          <TableCell>
                            <Badge className={getSlotPositionColor(starter.slotPosition)}>
                              {starter.slotPosition}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">
                                {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                              </span>
                              {player && (
                                <Badge className={getPositionColor(player.position)}>
                                  {player.position}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{player?.team || 'N/A'}</TableCell>
                          <TableCell>
                            {getInjuryBadge(player?.injury_status)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Bench Players */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Bench ({organizedRoster.bench.length})</span>
              </CardTitle>
              <CardDescription>
                Players available as substitutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>NFL Team</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizedRoster.bench.map((playerId) => {
                      const player = allPlayers[playerId];
                      return (
                        <TableRow key={`bench-${playerId}`}>
                          <TableCell className="font-medium">
                            {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                          </TableCell>
                          <TableCell>
                            {player && (
                              <Badge className={getPositionColor(player.position)}>
                                {player.position}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{player?.team || 'N/A'}</TableCell>
                          <TableCell>
                            {getInjuryBadge(player?.injury_status)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {organizedRoster.bench.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          No bench players
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Injured Reserve */}
          {organizedRoster.ir.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Injured Reserve ({organizedRoster.ir.length})</span>
                </CardTitle>
                <CardDescription>
                  Players on injured reserve
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>NFL Team</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizedRoster.ir.map((playerId) => {
                        const player = allPlayers[playerId];
                        return (
                          <TableRow key={`ir-${playerId}`}>
                            <TableCell className="font-medium">
                              {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                            </TableCell>
                            <TableCell>
                              {player && (
                                <Badge className={getPositionColor(player.position)}>
                                  {player.position}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{player?.team || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs">IR</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
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
                    <p className="text-2xl font-bold">{totalPoints.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Points Against</p>
                    <p className="text-2xl font-bold">{totalPointsAgainst.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Point Differential</p>
                    <p className={`text-2xl font-bold ${(totalPoints - totalPointsAgainst) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(totalPoints - totalPointsAgainst) > 0 ? '+' : ''}{(totalPoints - totalPointsAgainst).toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Percentage</p>
                    <p className="text-2xl font-bold">{winPercentage.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Team Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Waiver Position</p>
                    <p className="text-2xl font-bold">{roster.settings.waiver_position}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Waiver Budget Used</p>
                    <p className="text-2xl font-bold">${roster.settings.waiver_budget_used}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Moves</p>
                    <p className="text-2xl font-bold">{roster.settings.total_moves}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Games Played</p>
                    <p className="text-2xl font-bold">{gamesPlayed}</p>
                  </div>
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
                <span>Transaction History</span>
              </CardTitle>
              <CardDescription>
                Trades, waivers, and roster moves (requires additional API integration)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Transaction history will be available when connected to Sleeper's transaction API endpoints.
                Current stats: {roster.settings.total_moves} total moves this season.
              </p>
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
                Full schedule view will be implemented when connected to Sleeper's matchup API endpoints.
                Current record: {roster.settings.wins}-{roster.settings.losses}-{roster.settings.ties}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamDetailPage;