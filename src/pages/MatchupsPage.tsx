import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from '@/services/sleeperApi';

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url: string;
}

interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name: string;
  co_owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface OrganizedMatchup {
  matchup_id: number;
  conference: Conference;
  teams: Array<{
    roster_id: number;
    points: number;
    projected_points?: number;
    owner: SleeperUser | null;
    roster: SleeperRoster | null;
    team: Team | null;
    players_points: Record<string, number>;
    starters_points: number[];
  }>;
  status: 'live' | 'completed' | 'upcoming';
}

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();

  const [selectedWeek, setSelectedWeek] = useState<number>(14);
  const [currentWeek, setCurrentWeek] = useState<number>(14);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matchups, setMatchups] = useState<OrganizedMatchup[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch conferences and teams from database
  const fetchDatabaseData = async () => {
    try {
      console.log('Fetching conferences and teams from database...');
      console.log('Selected season:', selectedSeason, 'Selected conference:', selectedConference);

      // First fetch seasons to get the season ID for the selected year
      const seasonsResponse = await window.ezsite.apis.tablePage('12818', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: [
        {
          name: 'season_year',
          op: 'Equal',
          value: selectedSeason
        }]

      });

      if (seasonsResponse.error) {
        throw new Error(seasonsResponse.error);
      }

      const seasons = seasonsResponse.data.List;
      const currentSeason = seasons.find((s) => s.season_year === selectedSeason);

      if (!currentSeason) {
        console.warn(`No season found for year ${selectedSeason}`);
        setConferences([]);
        setTeams([]);
        return { conferences: [], teams: [] };
      }

      console.log('Found season:', currentSeason);

      // Fetch conferences filtered by season
      const conferencesFilters = [
      {
        name: 'season_id',
        op: 'Equal',
        value: currentSeason.id
      }];


      // If a specific conference is selected, add that filter
      if (selectedConference) {
        // Find the conference from the currentSeasonConfig to get the league_id
        const targetConference = currentSeasonConfig.conferences.find((c) => c.id === selectedConference);
        if (targetConference) {
          conferencesFilters.push({
            name: 'league_id',
            op: 'Equal',
            value: targetConference.leagueId
          });
        }
      }

      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: conferencesFilters
      });

      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }

      const conferenceData = conferencesResponse.data.List;
      setConferences(conferenceData);
      console.log(`Loaded ${conferenceData.length} conferences for season ${selectedSeason}`);

      // Fetch teams
      const teamsResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (teamsResponse.error) {
        throw new Error(teamsResponse.error);
      }

      const teamData = teamsResponse.data.List;
      setTeams(teamData);
      console.log(`Loaded ${teamData.length} teams`);

      return { conferences: conferenceData, teams: teamData };
    } catch (error) {
      console.error('Error fetching database data:', error);
      toast({
        title: 'Database Error',
        description: 'Failed to load conferences and teams from database.',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Fetch matchup data from Sleeper API
  const fetchMatchupData = async (conferenceData: Conference[], teamData: Team[]) => {
    try {
      console.log('Fetching matchup data from Sleeper API...');

      // Use all the filtered conferences from the database query
      // They are already filtered by season and optionally by specific conference
      const targetConferences = conferenceData;

      if (targetConferences.length === 0) {
        setMatchups([]);
        return;
      }

      // Fetch players data once
      const playersData = await SleeperApiService.fetchAllPlayers();
      setAllPlayers(playersData);

      const allMatchups: OrganizedMatchup[] = [];

      // Process each conference
      for (const conference of targetConferences) {
        try {
          console.log(`Processing conference: ${conference.conference_name} (${conference.league_id})`);

          // Fetch league data
          const [matchupsData, rostersData, usersData] = await Promise.all([
          SleeperApiService.fetchMatchups(conference.league_id, selectedWeek),
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)]
          );

          // Organize matchups
          const organizedMatchups = SleeperApiService.organizeMatchups(
            matchupsData,
            rostersData,
            usersData
          );

          // Convert to our format and add team data
          const conferenceMatchups: OrganizedMatchup[] = organizedMatchups.map((matchup) => {
            const matchupTeams = matchup.teams.map((team) => {
              // Find corresponding team from database
              const dbTeam = teamData.find((t) =>
              team.owner && t.owner_id === team.owner.user_id
              );

              const matchupTeam = matchupsData.find((m) => m.roster_id === team.roster_id);

              return {
                ...team,
                team: dbTeam || null,
                players_points: matchupTeam?.players_points || {},
                starters_points: matchupTeam?.starters_points || []
              };
            });

            // Determine status for this specific matchup
            let matchupStatus: 'live' | 'completed' | 'upcoming';
            if (selectedWeek > currentWeek) {
              matchupStatus = 'upcoming';
            } else {
              // Check if this specific matchup has points
              const hasPoints = matchupTeams.some(team => team.points > 0);
              matchupStatus = hasPoints ? 'completed' : 'live';
            }

            return {
              matchup_id: matchup.matchup_id,
              conference,
              teams: matchupTeams,
              status: matchupStatus
            };
          });

          allMatchups.push(...conferenceMatchups);

        } catch (error) {
          console.error(`Error processing conference ${conference.conference_name}:`, error);
          toast({
            title: 'Conference Error',
            description: `Failed to load data for ${conference.conference_name}`,
            variant: 'destructive'
          });
        }
      }

      setMatchups(allMatchups);
      console.log(`Loaded ${allMatchups.length} total matchups`);

    } catch (error) {
      console.error('Error fetching matchup data:', error);
      toast({
        title: 'API Error',
        description: 'Failed to load matchup data from Sleeper API.',
        variant: 'destructive'
      });
    }
  };

  // Load all data
  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { conferences: conferenceData, teams: teamData } = await fetchDatabaseData();
      await fetchMatchupData(conferenceData, teamData);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Get current NFL week on mount
  useEffect(() => {
    const getCurrentWeek = async () => {
      try {
        const week = await SleeperApiService.getCurrentNFLWeek();
        setCurrentWeek(week);
        setSelectedWeek(week);
      } catch (error) {
        console.error('Error getting current week:', error);
      }
    };

    getCurrentWeek();
  }, []);

  // Load data when component mounts or dependencies change
  useEffect(() => {
    loadData();
  }, [selectedWeek, selectedConference, selectedSeason]);

  const toggleMatchupExpansion = (matchupId: string) => {
    const newExpanded = new Set(expandedMatchups);
    if (newExpanded.has(matchupId)) {
      newExpanded.delete(matchupId);
    } else {
      newExpanded.add(matchupId);
    }
    setExpandedMatchups(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500 hover:bg-green-600" data-id="fewvvu914">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary" data-id="9es8w6uxj">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline" data-id="70g417pa1">Upcoming</Badge>;
      default:
        return <Badge variant="secondary" data-id="3canx3eko">{status}</Badge>;
    }
  };

  const getPlayerName = (playerId: string): string => {
    const player = allPlayers[playerId];
    return SleeperApiService.getPlayerName(player);
  };

  const getWinningTeam = (matchup: OrganizedMatchup) => {
    if (matchup.status !== 'completed') return null;
    const [team1, team2] = matchup.teams;
    return team1.points > team2.points ? team1 : team2;
  };

  if (loading) {
    return (
      <div className="space-y-6" data-id="o8wnv0klw">
        <div className="flex items-center space-x-2" data-id="bcygro0c4">
          <Swords className="h-6 w-6 text-primary" data-id="h2ol7clu3" />
          <h1 className="text-3xl font-bold" data-id="zresew2pn">Matchups</h1>
        </div>
        <Card data-id="ldb0q9qji">
          <CardContent className="py-8 text-center" data-id="ftdti63my">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" data-id="v5qx4w8s6" />
            <p data-id="n3i9ugc8d">Loading matchup data...</p>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="space-y-6" data-id="b022z08vs">
      {/* Page Header */}
      <div className="flex flex-col space-y-2" data-id="s4ituyw4y">
        <div className="flex items-center space-x-2" data-id="r155q4rp1">
          <Swords className="h-6 w-6 text-primary" data-id="ofwmihnvk" />
          <h1 className="text-3xl font-bold" data-id="8h1icol56">Matchups</h1>
        </div>
        <p className="text-muted-foreground" data-id="c1acp9qhf">
          {selectedSeason} Season • Week {selectedWeek} • {
          selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name || 'Selected Conference' :

          conferences.length > 0 ? `${conferences.length} Conference${conferences.length !== 1 ? 's' : ''}` : 'All Conferences'

          }
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-id="n0zl43nnn">
        <div className="flex items-center space-x-4" data-id="nyckzqi8a">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))} data-id="xv6xbmfe6">
            <SelectTrigger className="w-32" data-id="wyq8talrb">
              <SelectValue data-id="n139g7hib" />
            </SelectTrigger>
            <SelectContent data-id="nzf92gk9u">
              {Array.from({ length: 18 }, (_, i) => i + 1).map((week) =>
              <SelectItem key={week} value={week.toString()} data-id="te15bpn3a">
                  <div className="flex items-center space-x-2" data-id="p5yotuvut">
                    <span data-id="zdptcjjvq">Week {week}</span>
                    {week === currentWeek && <Badge variant="outline" className="text-xs" data-id="9sokqi6n2">Current</Badge>}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {selectedWeek === currentWeek &&
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="4ysa24a6i">
              <Clock className="h-4 w-4" data-id="xx4j2mh4n" />
              <span data-id="a9w0lkl9n">Current week</span>
            </div>
          }
        </div>

        <div className="flex items-center space-x-4" data-id="cpiaj2as4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing} data-id="qjzcx8v3j">

            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} data-id="r5dkhnns4" />
            Refresh
          </Button>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="qkoude2gh">
            <Users className="h-4 w-4" data-id="vbki4lvtd" />
            <span data-id="x6p3fhmvq">{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Matchups Grid */}
      <div className="grid gap-4" data-id="puhumtxh9">
        {matchups.map((matchup) => {
          const [team1, team2] = matchup.teams;
          const winningTeam = getWinningTeam(matchup);

          return (
            <Card key={`${matchup.conference.id}-${matchup.matchup_id}`} className="hover:shadow-md transition-shadow" data-id="6jox7h91o">
              <Collapsible data-id="m1w095x9y">
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(`${matchup.conference.id}-${matchup.matchup_id}`)} data-id="q4xst0oxd">

                  <CardHeader className="pb-4" data-id="axyd4wxlh">
                    <div className="flex items-center justify-between" data-id="ekrkzbcs0">
                      <div className="flex items-center space-x-2" data-id="sbefv536n">
                        <CardTitle className="text-lg" data-id="pb4y9asae">
                          {matchup.conference.conference_name}
                        </CardTitle>
                        {getStatusBadge(matchup.status)}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                      expandedMatchups.has(`${matchup.conference.id}-${matchup.matchup_id}`) ? 'rotate-180' : ''}`
                      } data-id="13gve218x" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="pt-0" data-id="lnllss44b">
                  {/* Matchup Summary */}
                  <div className="grid grid-cols-3 gap-4 items-center" data-id="hkv0g6021">
                    {/* Team 1 */}
                    <div className="text-right space-y-1" data-id="gsm1hshgs">
                      <div className="font-semibold" data-id="iwmtmfp0n">
                        {team1.team?.team_name || team1.owner?.display_name || team1.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground" data-id="2qzd7dlfa">
                        {team1.team?.owner_name || team1.owner?.display_name || 'Unknown Owner'}
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team1.roster_id ? 'text-green-600' : ''}`} data-id="s9b1hyg23">
                        {matchup.status === 'upcoming' ? '--' : team1.points.toFixed(1)}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center" data-id="dz34bilm2">
                      <div className="text-lg font-semibold text-muted-foreground" data-id="rc1zwkdlr">VS</div>
                      {matchup.status === 'completed' && winningTeam &&
                      <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" data-id="foa4dxojg" />
                      }
                    </div>

                    {/* Team 2 */}
                    <div className="text-left space-y-1" data-id="pq8m4r5v6">
                      <div className="font-semibold" data-id="j9rxz40a9">
                        {team2.team?.team_name || team2.owner?.display_name || team2.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground" data-id="38n2q9dd8">
                        {team2.team?.owner_name || team2.owner?.display_name || 'Unknown Owner'}
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team2.roster_id ? 'text-green-600' : ''}`} data-id="2t9dbmef6">
                        {matchup.status === 'upcoming' ? '--' : team2.points.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6" data-id="hklf6k239">
                    <div className="border-t pt-4 space-y-4" data-id="22pkop9w5">
                      {/* Team Rosters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-id="8xq9qpwzj">
                        {/* Team 1 Roster */}
                        <Card data-id="srrqevm0k">
                          <CardHeader className="pb-2" data-id="cq9qzzy6m">
                            <CardTitle className="text-sm" data-id="nz1uzsoqi">
                              {team1.team?.team_name || team1.owner?.display_name || 'Team 1'} Lineup
                            </CardTitle>
                          </CardHeader>
                          <CardContent data-id="u9wy6vp1g">
                            <div className="space-y-2" data-id="nc28wuj4r">
                              {team1.roster?.starters.map((playerId, index) =>
                              <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm" data-id="gwm5u79l6">
                                  <span data-id="ux655oprw">{getPlayerName(playerId)}</span>
                                  <span className="font-medium" data-id="q0vrvzzcc">
                                    {team1.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              ) || <p className="text-muted-foreground text-sm" data-id="dgsmvxmvv">No lineup data available</p>}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Team 2 Roster */}
                        <Card data-id="d6urnkjug">
                          <CardHeader className="pb-2" data-id="92cnoteef">
                            <CardTitle className="text-sm" data-id="pv12n8xwm">
                              {team2.team?.team_name || team2.owner?.display_name || 'Team 2'} Lineup
                            </CardTitle>
                          </CardHeader>
                          <CardContent data-id="d30qfqjz8">
                            <div className="space-y-2" data-id="4d9dv4hkq">
                              {team2.roster?.starters.map((playerId, index) =>
                              <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm" data-id="m3kxhxu26">
                                  <span data-id="cwmlbv4vx">{getPlayerName(playerId)}</span>
                                  <span className="font-medium" data-id="poi29at0f">
                                    {team2.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              ) || <p className="text-muted-foreground text-sm" data-id="4m00eoqny">No lineup data available</p>}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Matchup Stats */}
                      {matchup.status !== 'upcoming' &&
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center" data-id="ztequjro5">
                          <div data-id="gmcay091s">
                            <div className="text-sm text-muted-foreground" data-id="4iytqun66">Total Points</div>
                            <div className="font-semibold" data-id="kb0xx021k">
                              {(team1.points + team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="veei88npd">
                            <div className="text-sm text-muted-foreground" data-id="qz50xi1ws">Point Spread</div>
                            <div className="font-semibold" data-id="hkdvebld8">
                              {Math.abs(team1.points - team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="kzvey4nqf">
                            <div className="text-sm text-muted-foreground" data-id="8yqipy7sv">High Score</div>
                            <div className="font-semibold" data-id="uhr33sbgr">
                              {Math.max(team1.points, team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="46ut3tlq2">
                            <div className="text-sm text-muted-foreground" data-id="ztd5jr0kf">Status</div>
                            <div className="text-xs capitalize" data-id="y1nsea8pd">{matchup.status}</div>
                          </div>
                        </div>
                      }
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>);

        })}

        {matchups.length === 0 &&
        <Card data-id="x8pm8qv1q">
            <CardContent className="py-8 text-center" data-id="2wqoiexbm">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" data-id="3p7manw62" />
              <p className="text-muted-foreground" data-id="fa10va6x7">No matchups found for the selected filters.</p>
              {conferences.length === 0 &&
            <p className="text-sm text-muted-foreground mt-2" data-id="suagg1c7v">
                  Make sure conferences are configured in the admin panel.
                </p>
            }
            </CardContent>
          </Card>
        }
      </div>
    </div>);

};

export default MatchupsPage;