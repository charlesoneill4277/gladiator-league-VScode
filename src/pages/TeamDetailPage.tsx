import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Users, Trophy, TrendingUp, Calendar, Star, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { type SleeperRoster, type SleeperPlayer, type OrganizedRoster } from '../services/sleeperApi';
import TransactionService, { type ProcessedTransaction } from '../services/transactionService';
import TransactionCard from '../components/transactions/TransactionCard';

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
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (teamId) {
      fetchTeamData(parseInt(teamId));
    }
  }, [teamId]);

  useEffect(() => {
    if (activeTab === 'transactions' && teamRosterData && transactions.length === 0) {
      fetchTransactions();
    }
  }, [activeTab, teamRosterData]);

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
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!teamRosterData) return;
    
    try {
      setTransactionsLoading(true);
      console.log(`Fetching transactions for league ${teamRosterData.conferenceData.league_id}`);
      
      const allTransactions = await TransactionService.fetchAllSeasonTransactions(
        teamRosterData.conferenceData.league_id
      );
      
      // Filter transactions that involve this team's roster
      const teamTransactions = allTransactions.filter(tx => 
        tx.rosterIds.includes(teamRosterData.roster.roster_id)
      );
      
      setTransactions(teamTransactions);
      console.log(`Loaded ${teamTransactions.length} transactions for this team`);
      
      toast({
        title: 'Transactions Loaded',
        description: `Found ${teamTransactions.length} transactions for this team`,
      });
      
    } catch (error) {
      console.error('Error fetching transactions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions';
      toast({
        title: 'Error Loading Transactions',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setTransactionsLoading(false);
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':return 'bg-red-100 text-red-800';
      case 'RB':return 'bg-green-100 text-green-800';
      case 'WR':return 'bg-blue-100 text-blue-800';
      case 'TE':return 'bg-yellow-100 text-yellow-800';
      case 'K':return 'bg-purple-100 text-purple-800';
      case 'DEF':return 'bg-gray-100 text-gray-800';
      default:return 'bg-gray-100 text-gray-800';
    }
  };

  const getSlotPositionColor = (position: string) => {
    switch (position) {
      case 'FLEX':return 'bg-orange-100 text-orange-800';
      case 'SUPER_FLEX':return 'bg-pink-100 text-pink-800';
      default:return 'bg-slate-100 text-slate-800';
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

    return <Badge variant={variants[status] || 'outline'} className="text-xs" data-id="zhbrq4abn">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-id="1ayp1vpfb">
        <div className="flex items-center space-x-2" data-id="gnhrzzqck">
          <Loader2 className="h-6 w-6 animate-spin" data-id="71clzmiw4" />
          <span data-id="1li84c3cp">Loading team data...</span>
        </div>
      </div>);

  }

  if (error || !teamRosterData) {
    return (
      <div className="space-y-6" data-id="n0rwrjxfa">
        <Link to="/teams" data-id="byr78uxrb">
          <Button variant="ghost" className="mb-4" data-id="vc3dec0nv">
            <ArrowLeft className="mr-2 h-4 w-4" data-id="pzust1c26" />
            Back to Teams
          </Button>
        </Link>
        <Card data-id="i049cp339">
          <CardContent className="flex items-center justify-center min-h-64" data-id="sqtfeviwj">
            <div className="text-center space-y-2" data-id="kud802tm8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" data-id="trqdow88l" />
              <h3 className="text-lg font-semibold" data-id="2iju1nlz0">Error Loading Team</h3>
              <p className="text-muted-foreground" data-id="axwg4c303">{error || 'Team data not available'}</p>
              <Button onClick={() => teamId && fetchTeamData(parseInt(teamId))} data-id="ih79pvuah">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>);

  }

  const { roster, organizedRoster, allPlayers, teamData, conferenceData } = teamRosterData;

  // Calculate additional stats
  const totalPoints = SleeperApiService.formatPoints(roster.settings.fpts, roster.settings.fpts_decimal);
  const totalPointsAgainst = SleeperApiService.formatPoints(roster.settings.fpts_against, roster.settings.fpts_against_decimal);
  const gamesPlayed = roster.settings.wins + roster.settings.losses + roster.settings.ties;
  const avgPointsPerGame = SleeperApiService.calculatePointsPerGame(totalPoints, gamesPlayed);
  const winPercentage = gamesPlayed > 0 ? roster.settings.wins / gamesPlayed * 100 : 0;

  return (
    <div className="space-y-6" data-id="nshpn0v80">
      {/* Back Button */}
      <Link to="/teams" data-id="hg3nkxdd6">
        <Button variant="ghost" className="mb-4" data-id="fm3vle6s3">
          <ArrowLeft className="mr-2 h-4 w-4" data-id="u8mtfufsc" />
          Back to Teams
        </Button>
      </Link>

      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-4 md:space-y-0" data-id="25crtc39p">
        <div className="flex items-center space-x-4" data-id="g3ywhoqop">
          <Avatar className="h-16 w-16" data-id="04jpjmazq">
            <AvatarImage src={teamData.team_logo_url || undefined} data-id="z6mtzcd6u" />
            <AvatarFallback className="bg-primary/10 text-lg" style={{ backgroundColor: teamData.team_primary_color + '20' }} data-id="1ajfmaeoo">
              {teamData.team_name.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div data-id="3m7nioe9s">
            <h1 className="text-3xl font-bold" data-id="x9bmraia3">{teamData.team_name}</h1>
            <p className="text-muted-foreground" data-id="m0wop5doc">Owned by {teamData.owner_name}</p>
            {teamData.co_owner_name &&
            <p className="text-sm text-muted-foreground" data-id="9bqwlzl37">Co-owner: {teamData.co_owner_name}</p>
            }
            <div className="flex items-center space-x-2 mt-2" data-id="718lcn4ok">
              <Badge variant="outline" data-id="ppzuicegc">{conferenceData.conference_name}</Badge>
              <Badge variant="secondary" data-id="y9a40jf7f">Roster #{roster.roster_id}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center" data-id="p6jfi9k6y">
          <div data-id="hdbkhuz51">
            <div className="text-2xl font-bold" data-id="ffnyczxw6">{roster.settings.wins}-{roster.settings.losses}</div>
            <div className="text-sm text-muted-foreground" data-id="1in7wcd24">Record</div>
          </div>
          <div data-id="gy2ll1j9r">
            <div className="text-2xl font-bold" data-id="5lvjjzek3">{totalPoints.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground" data-id="qqly900xl">Points For</div>
          </div>
          <div data-id="29nfnqf7u">
            <div className="text-2xl font-bold" data-id="5oj32lzb1">{avgPointsPerGame.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground" data-id="9egrn2ias">Avg/Game</div>
          </div>
          <div data-id="sh82bo7zx">
            <div className="text-2xl font-bold text-blue-600" data-id="easqa3x5z">{winPercentage.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground" data-id="kpmb52erz">Win %</div>
          </div>
        </div>
      </div>

      {/* Team Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-id="qtnq6rddi">
        <TabsList className="grid w-full grid-cols-4" data-id="l4xnfcula">
          <TabsTrigger value="roster" data-id="rvg0cltxp">Roster</TabsTrigger>
          <TabsTrigger value="performance" data-id="14psl2w2s">Performance</TabsTrigger>
          <TabsTrigger value="transactions" data-id="r47vdm4dt">Transactions</TabsTrigger>
          <TabsTrigger value="schedule" data-id="kgrh0mj6b">Schedule</TabsTrigger>
        </TabsList>

        {/* Roster Tab */}
        <TabsContent value="roster" className="space-y-4" data-id="w28lx93bs">
          {/* Starting Lineup */}
          <Card data-id="6w9ejjzrg">
            <CardHeader data-id="gtjoo9rhs">
              <CardTitle className="flex items-center space-x-2" data-id="6whbwls72">
                <Star className="h-5 w-5" data-id="q8flauucy" />
                <span data-id="0bu6m1gk4">Starting Lineup</span>
              </CardTitle>
              <CardDescription data-id="0hney2yjb">
                Current starting players for this roster
              </CardDescription>
            </CardHeader>
            <CardContent data-id="wejgcga9f">
              <div className="rounded-md border" data-id="eut5nn6ji">
                <Table data-id="d0c0537ka">
                  <TableHeader data-id="okrf03rf2">
                    <TableRow data-id="bzr9fxcm8">
                      <TableHead data-id="h1o249l9u">Position</TableHead>
                      <TableHead data-id="vb5xec7n5">Player</TableHead>
                      <TableHead data-id="u3c518ajv">NFL Team</TableHead>
                      <TableHead data-id="32kzgs12e">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody data-id="5cu2ni2fm">
                    {organizedRoster.starters.map((starter, index) => {
                      const player = allPlayers[starter.playerId];
                      return (
                        <TableRow key={`starter-${index}`} data-id="ity6biu6c">
                          <TableCell data-id="azfjssq8q">
                            <Badge className={getSlotPositionColor(starter.slotPosition)} data-id="xw1bt41yk">
                              {starter.slotPosition}
                            </Badge>
                          </TableCell>
                          <TableCell data-id="dcn6y2jkj">
                            <div className="flex items-center space-x-2" data-id="j5oay40oh">
                              <span className="font-medium" data-id="ywk9e1r83">
                                {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                              </span>
                              {player &&
                              <Badge className={getPositionColor(player.position)} data-id="mt5998pjb">
                                  {player.position}
                                </Badge>
                              }
                            </div>
                          </TableCell>
                          <TableCell data-id="wdzaakbgs">{player?.team || 'N/A'}</TableCell>
                          <TableCell data-id="16jz9h4z7">
                            {getInjuryBadge(player?.injury_status)}
                          </TableCell>
                        </TableRow>);

                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Bench Players */}
          <Card data-id="btke3mois">
            <CardHeader data-id="qrr8jy0qk">
              <CardTitle className="flex items-center space-x-2" data-id="c5qy7srfl">
                <Users className="h-5 w-5" data-id="ur58l2vjv" />
                <span data-id="29828zs2y">Bench ({organizedRoster.bench.length})</span>
              </CardTitle>
              <CardDescription data-id="t7vod7o3i">
                Players available as substitutes
              </CardDescription>
            </CardHeader>
            <CardContent data-id="izuwonlo6">
              <div className="rounded-md border" data-id="rnu4jwa31">
                <Table data-id="mvx1pxdw9">
                  <TableHeader data-id="kosbv8iim">
                    <TableRow data-id="wst2e02ep">
                      <TableHead data-id="dvv1a5a4t">Player</TableHead>
                      <TableHead data-id="4y68des5i">Position</TableHead>
                      <TableHead data-id="0r3b96es2">NFL Team</TableHead>
                      <TableHead data-id="8uyiun8md">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody data-id="fy2zm1hhu">
                    {organizedRoster.bench.map((playerId) => {
                      const player = allPlayers[playerId];
                      return (
                        <TableRow key={`bench-${playerId}`} data-id="rr5ut9x5d">
                          <TableCell className="font-medium" data-id="t2e5u6x04">
                            {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                          </TableCell>
                          <TableCell data-id="jfn7zqair">
                            {player &&
                            <Badge className={getPositionColor(player.position)} data-id="97igzivon">
                                {player.position}
                              </Badge>
                            }
                          </TableCell>
                          <TableCell data-id="jmv1hose7">{player?.team || 'N/A'}</TableCell>
                          <TableCell data-id="yy82tkurn">
                            {getInjuryBadge(player?.injury_status)}
                          </TableCell>
                        </TableRow>);

                    })}
                    {organizedRoster.bench.length === 0 &&
                    <TableRow data-id="mnwjldzr4">
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4" data-id="ke5nhtf0u">
                          No bench players
                        </TableCell>
                      </TableRow>
                    }
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Injured Reserve */}
          {organizedRoster.ir.length > 0 &&
          <Card data-id="opu888m15">
              <CardHeader data-id="idg37azqb">
                <CardTitle className="flex items-center space-x-2" data-id="zrpwglp1f">
                  <AlertCircle className="h-5 w-5" data-id="2ndkp93qk" />
                  <span data-id="u10plny2p">Injured Reserve ({organizedRoster.ir.length})</span>
                </CardTitle>
                <CardDescription data-id="4otg58y5u">
                  Players on injured reserve
                </CardDescription>
              </CardHeader>
              <CardContent data-id="bhdy6tlqc">
                <div className="rounded-md border" data-id="cfy07dpey">
                  <Table data-id="jyg7vs5jz">
                    <TableHeader data-id="vzw26yozw">
                      <TableRow data-id="g8zu4lq7i">
                        <TableHead data-id="muy6rntrv">Player</TableHead>
                        <TableHead data-id="183rn0ann">Position</TableHead>
                        <TableHead data-id="10q50orbr">NFL Team</TableHead>
                        <TableHead data-id="10gv43ia8">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody data-id="u68vkcp1c">
                      {organizedRoster.ir.map((playerId) => {
                      const player = allPlayers[playerId];
                      return (
                        <TableRow key={`ir-${playerId}`} data-id="n0rrq77wx">
                            <TableCell className="font-medium" data-id="xsaossqjr">
                              {player ? SleeperApiService.getPlayerName(player) : 'Unknown Player'}
                            </TableCell>
                            <TableCell data-id="myj25dw0w">
                              {player &&
                            <Badge className={getPositionColor(player.position)} data-id="m28x4xhql">
                                  {player.position}
                                </Badge>
                            }
                            </TableCell>
                            <TableCell data-id="bfe9mwo7s">{player?.team || 'N/A'}</TableCell>
                            <TableCell data-id="646z1kppo">
                              <Badge variant="destructive" className="text-xs" data-id="r46qgshjx">IR</Badge>
                            </TableCell>
                          </TableRow>);

                    })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          }
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4" data-id="p7lucdul3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-id="84l5caktm">
            <Card data-id="q7lex17wr">
              <CardHeader data-id="w8owhvg7o">
                <CardTitle className="flex items-center space-x-2" data-id="m712x0o8x">
                  <Trophy className="h-5 w-5" data-id="yq8aep60x" />
                  <span data-id="dr4wrhg7l">Season Stats</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4" data-id="xcbattj8i">
                <div className="grid grid-cols-2 gap-4" data-id="zprx55fuj">
                  <div data-id="p098983n9">
                    <p className="text-sm text-muted-foreground" data-id="gjfclhdb4">Total Points For</p>
                    <p className="text-2xl font-bold" data-id="9jlz65rdw">{totalPoints.toFixed(1)}</p>
                  </div>
                  <div data-id="sqq632bu9">
                    <p className="text-sm text-muted-foreground" data-id="f49h55r63">Total Points Against</p>
                    <p className="text-2xl font-bold" data-id="r9345tsm6">{totalPointsAgainst.toFixed(1)}</p>
                  </div>
                  <div data-id="l7gblx0bq">
                    <p className="text-sm text-muted-foreground" data-id="x5kqtxzcb">Point Differential</p>
                    <p className={`text-2xl font-bold ${totalPoints - totalPointsAgainst > 0 ? 'text-green-600' : 'text-red-600'}`} data-id="q20ohwuwf">
                      {totalPoints - totalPointsAgainst > 0 ? '+' : ''}{(totalPoints - totalPointsAgainst).toFixed(1)}
                    </p>
                  </div>
                  <div data-id="0atvt41b5">
                    <p className="text-sm text-muted-foreground" data-id="b04w18wz4">Win Percentage</p>
                    <p className="text-2xl font-bold" data-id="qdwzww1sz">{winPercentage.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-id="9pnbmm28h">
              <CardHeader data-id="qs4kqqdk7">
                <CardTitle className="flex items-center space-x-2" data-id="hdiv1oq1l">
                  <TrendingUp className="h-5 w-5" data-id="mifu4ey4b" />
                  <span data-id="lgexigry5">Team Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4" data-id="svf14z3la">
                <div className="grid grid-cols-2 gap-4" data-id="cs0m8cli1">
                  <div data-id="iyk5qb78n">
                    <p className="text-sm text-muted-foreground" data-id="hf1wwun92">Waiver Position</p>
                    <p className="text-2xl font-bold" data-id="36kg920z6">{roster.settings.waiver_position}</p>
                  </div>
                  <div data-id="s7fytymtt">
                    <p className="text-sm text-muted-foreground" data-id="qho2oj7od">Waiver Budget Used</p>
                    <p className="text-2xl font-bold" data-id="o4o0xho8p">${roster.settings.waiver_budget_used}</p>
                  </div>
                  <div data-id="cgck85fh1">
                    <p className="text-sm text-muted-foreground" data-id="4pgm9rn17">Total Moves</p>
                    <p className="text-2xl font-bold" data-id="s8dd73k79">{roster.settings.total_moves}</p>
                  </div>
                  <div data-id="6ap74lxlb">
                    <p className="text-sm text-muted-foreground" data-id="zj1gmngzp">Games Played</p>
                    <p className="text-2xl font-bold" data-id="ckssksdf0">{gamesPlayed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4" data-id="l7606kuo3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Transaction History</h3>
              <p className="text-sm text-muted-foreground">
                All trades, waivers, and roster moves for this team
              </p>
            </div>
            <Button 
              onClick={fetchTransactions} 
              disabled={transactionsLoading}
              variant="outline"
              size="sm"
            >
              {transactionsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>

          {transactionsLoading && transactions.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center min-h-32">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading transactions...</span>
                </div>
              </CardContent>
            </Card>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center min-h-32">
                <div className="text-center space-y-2">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-semibold">No Transactions Found</h3>
                  <p className="text-muted-foreground">
                    This team hasn't made any trades, waiver claims, or free agent pickups this season.
                  </p>
                  <div className="mt-4">
                    <Badge variant="secondary">
                      Total moves: {roster.settings.total_moves}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                </p>
                <Badge variant="secondary">
                  Total moves: {roster.settings.total_moves}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <TransactionCard 
                    key={transaction.id} 
                    transaction={transaction} 
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4" data-id="dymkyjim6">
          <Card data-id="7ux9dbnv7">
            <CardHeader data-id="7la4qm31k">
              <CardTitle data-id="3lka7hnzo">Season Schedule</CardTitle>
              <CardDescription data-id="23f8h3w1v">
                Complete schedule with results and upcoming matchups
              </CardDescription>
            </CardHeader>
            <CardContent data-id="prd2of66h">
              <p className="text-muted-foreground text-center py-8" data-id="31rpdyv24">
                Full schedule view will be implemented when connected to Sleeper's matchup API endpoints.
                Current record: {roster.settings.wins}-{roster.settings.losses}-{roster.settings.ties}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default TeamDetailPage;