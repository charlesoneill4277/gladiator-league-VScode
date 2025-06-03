import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle, Download } from 'lucide-react';
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

interface TeamWeeklyScore {
  conference_id: number;
  team_roster_id: string;
  week: number;
  points: number;
  matchup_id: string;
  starters: string;
  last_updated: string;
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
  const [teamWeeklyScores, setTeamWeeklyScores] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingScores, setSyncingScores] = useState(false);

  // Fetch and store team scores for all weeks
  const fetchAndStoreAllWeeklyScores = async (conferenceData: Conference[]) => {
    try {
      console.log('Fetching all weekly scores from Sleeper API...');
      
      for (const conference of conferenceData) {
        console.log(`Processing all weeks for conference: ${conference.conference_name} (${conference.league_id})`);
        
        // Get all unique weeks from matchups table for this conference
        const matchupsResponse = await window.ezsite.apis.tablePage('13329', {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'week',
          IsAsc: true,
          Filters: [
            {
              name: 'conference_id',
              op: 'Equal',
              value: conference.id
            }
          ]
        });
        
        if (matchupsResponse.error) {
          console.error('Error fetching matchups:', matchupsResponse.error);
          continue;
        }
        
        const weeks = [...new Set(matchupsResponse.data.List.map((m: any) => m.week))];
        console.log(`Found weeks for ${conference.conference_name}:`, weeks);
        
        // If no weeks found in matchups table, use standard weeks 1-18
        const weeksToProcess = weeks.length > 0 ? weeks : Array.from({ length: 18 }, (_, i) => i + 1);
        
        // Fetch scores for each week
        for (const week of weeksToProcess) {
          try {
            console.log(`Fetching scores for ${conference.conference_name} week ${week}`);
            
            // Fetch matchup data from Sleeper API
            const response = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/matchups/${week}`);
            if (!response.ok) {
              console.error(`Failed to fetch week ${week} for league ${conference.league_id}:`, response.status);
              continue;
            }
            
            const weeklyMatchups = await response.json();
            console.log(`Fetched ${weeklyMatchups.length} team scores for week ${week}`);
            
            // Store each team's score for this week
            for (const teamData of weeklyMatchups) {
              try {
                // Check if this score already exists
                const existingScoreResponse = await window.ezsite.apis.tablePage('13740', {
                  PageNo: 1,
                  PageSize: 1,
                  OrderByField: 'id',
                  IsAsc: false,
                  Filters: [
                    {
                      name: 'conference_id',
                      op: 'Equal',
                      value: conference.id
                    },
                    {
                      name: 'team_roster_id',
                      op: 'Equal',
                      value: teamData.roster_id.toString()
                    },
                    {
                      name: 'week',
                      op: 'Equal',
                      value: week
                    }
                  ]
                });
                
                const scoreData = {
                  conference_id: conference.id,
                  team_roster_id: teamData.roster_id.toString(),
                  week: week,
                  points: teamData.points || 0,
                  matchup_id: teamData.matchup_id?.toString() || '',
                  starters: JSON.stringify(teamData.starters || []),
                  last_updated: new Date().toISOString()
                };
                
                if (existingScoreResponse.data.List.length > 0) {
                  // Update existing record
                  const existingRecord = existingScoreResponse.data.List[0];
                  await window.ezsite.apis.tableUpdate('13740', {
                    ID: existingRecord.ID,
                    ...scoreData
                  });
                  console.log(`Updated score for roster ${teamData.roster_id} week ${week}`);
                } else {
                  // Create new record
                  await window.ezsite.apis.tableCreate('13740', scoreData);
                  console.log(`Created score for roster ${teamData.roster_id} week ${week}`);
                }
              } catch (error) {
                console.error(`Error storing score for roster ${teamData.roster_id} week ${week}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error fetching week ${week} for ${conference.conference_name}:`, error);
          }
        }
      }
      
      // After syncing, fetch the updated scores for display
      await fetchTeamWeeklyScores(conferenceData);
      
      toast({
        title: 'Success',
        description: 'All weekly scores have been updated from Sleeper API.',
        variant: 'default'
      });
      
    } catch (error) {
      console.error('Error fetching all weekly scores:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch all weekly scores.',
        variant: 'destructive'
      });
    }
  };

  // Fetch team weekly scores from database
  const fetchTeamWeeklyScores = async (conferenceData: Conference[]) => {
    try {
      console.log('Fetching team weekly scores from database...');
      
      const scoresMap: Record<string, Record<number, number>> = {};
      
      for (const conference of conferenceData) {
        const scoresResponse = await window.ezsite.apis.tablePage('13740', {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'week',
          IsAsc: true,
          Filters: [
            {
              name: 'conference_id',
              op: 'Equal',
              value: conference.id
            }
          ]
        });
        
        if (scoresResponse.error) {
          console.error('Error fetching weekly scores:', scoresResponse.error);
          continue;
        }
        
        scoresResponse.data.List.forEach((score: any) => {
          const rosterId = score.team_roster_id;
          if (!scoresMap[rosterId]) {
            scoresMap[rosterId] = {};
          }
          scoresMap[rosterId][score.week] = score.points;
        });
      }
      
      setTeamWeeklyScores(scoresMap);
      console.log('Loaded team weekly scores:', Object.keys(scoresMap).length, 'teams');
      
    } catch (error) {
      console.error('Error fetching team weekly scores:', error);
    }
  };

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
            SleeperApiService.fetchLeagueUsers(conference.league_id)
          ]);

          // Organize matchups
          const organizedMatchups = SleeperApiService.organizeMatchups(
            matchupsData,
            rostersData,
            usersData
          );

          // Convert to our format and add team data
          const conferenceMatchups: OrganizedMatchup[] = organizedMatchups.map((matchup) => ({
            matchup_id: matchup.matchup_id,
            conference,
            teams: matchup.teams.map((team) => {
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
            }),
            status: selectedWeek <= currentWeek ?
              matchupsData.some((m) => m.points > 0) ? 'completed' : 'live' :
              'upcoming'
          }));

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
      await Promise.all([
        fetchMatchupData(conferenceData, teamData),
        fetchTeamWeeklyScores(conferenceData)
      ]);

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
        return <Badge className="bg-green-500 hover:bg-green-600" data-id="j49vn36p6">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary" data-id="0ad3g3w4p">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline" data-id="1bsxzi70z">Upcoming</Badge>;
      default:
        return <Badge variant="secondary" data-id="m23shg89n">{status}</Badge>;
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

  const getTeamAverage = (rosterId: number): string => {
    const scores = teamWeeklyScores[rosterId.toString()];
    if (!scores || Object.keys(scores).length === 0) return 'No data';
    
    const totalPoints = Object.values(scores).reduce((a, b) => a + b, 0);
    const weekCount = Object.keys(scores).length;
    return `Avg: ${(totalPoints / weekCount).toFixed(1)} (${weekCount} games)`;
  };

  if (loading) {
    return (
      <div className="space-y-6" data-id="7ubytizhl">
        <div className="flex items-center space-x-2" data-id="7opolpktj">
          <Swords className="h-6 w-6 text-primary" data-id="cg5tk6ymt" />
          <h1 className="text-3xl font-bold" data-id="s45w8oigk">Matchups</h1>
        </div>
        <Card data-id="80qplbn9o">
          <CardContent className="py-8 text-center" data-id="cxjxn44nu">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" data-id="kigpf9aeb" />
            <p data-id="wdwzorfd7">Loading matchup data...</p>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="space-y-6" data-id="0pr3j6prg">
      {/* Page Header */}
      <div className="flex flex-col space-y-2" data-id="vaq0t74qp">
        <div className="flex items-center space-x-2" data-id="x8ybnx7rv">
          <Swords className="h-6 w-6 text-primary" data-id="gs7i1jnhg" />
          <h1 className="text-3xl font-bold" data-id="t0jap0bge">Matchups</h1>
        </div>
        <p className="text-muted-foreground" data-id="xw6yg3u3u">
          {selectedSeason} Season • Week {selectedWeek} • {
          selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name || 'Selected Conference' :

          conferences.length > 0 ? `${conferences.length} Conference${conferences.length !== 1 ? 's' : ''}` : 'All Conferences'

          }
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-id="9b34pciah">
        <div className="flex items-center space-x-4" data-id="j9wmy54up">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))} data-id="thvd6s6kn">
            <SelectTrigger className="w-32" data-id="3neb49boo">
              <SelectValue data-id="s4i5emie7" />
            </SelectTrigger>
            <SelectContent data-id="s94crve2c">
              {Array.from({ length: 18 }, (_, i) => i + 1).map((week) =>
                <SelectItem key={week} value={week.toString()} data-id="0ohde1ngz">
                  <div className="flex items-center space-x-2" data-id="t1negi6i9">
                    <span data-id="cma1y578b">Week {week}</span>
                    {week === currentWeek && <Badge variant="outline" className="text-xs" data-id="4g2ihh1a3">Current</Badge>}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {selectedWeek === currentWeek &&
            <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="7n00nwfyf">
              <Clock className="h-4 w-4" data-id="yilc3so0o" />
              <span data-id="crxpf776f">Current week</span>
            </div>
          }
        </div>

        <div className="flex items-center space-x-4" data-id="m2h1ce2at">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing} data-id="0gs5vvheo">

            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} data-id="sedeapyuk" />
            Refresh
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={async () => {
              setSyncingScores(true);
              await fetchAndStoreAllWeeklyScores(conferences);
              setSyncingScores(false);
            }}
            disabled={syncingScores || conferences.length === 0} data-id="s9b1hyg23">

            <Download className={`h-4 w-4 ${syncingScores ? 'animate-spin' : ''}`} data-id="sync-scores-icon" />
            Sync All Scores
          </Button>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="iynipopcu">
            <Users className="h-4 w-4" data-id="5orje3dyb" />
            <span data-id="aq3kqzkdv">{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Matchups Grid */}
      <div className="grid gap-4" data-id="zvjzf9i6i">
        {matchups.map((matchup) => {
          const [team1, team2] = matchup.teams;
          const winningTeam = getWinningTeam(matchup);

          return (
            <Card key={`${matchup.conference.id}-${matchup.matchup_id}`} className="hover:shadow-md transition-shadow" data-id="xumwkggvb">
              <Collapsible data-id="zdxh4oo0k">
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(`${matchup.conference.id}-${matchup.matchup_id}`)} data-id="glh9g7tmh">

                  <CardHeader className="pb-4" data-id="qkuwpe4h5">
                    <div className="flex items-center justify-between" data-id="5ykalykey">
                      <div className="flex items-center space-x-2" data-id="i8h3elu8x">
                        <CardTitle className="text-lg" data-id="7v1w9nhvf">
                          {matchup.conference.conference_name}
                        </CardTitle>
                        {getStatusBadge(matchup.status)}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        expandedMatchups.has(`${matchup.conference.id}-${matchup.matchup_id}`) ? 'rotate-180' : ''}`
                      } data-id="gca0gddo8" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="pt-0" data-id="yfl12tjbj">
                  {/* Matchup Summary */}
                  <div className="grid grid-cols-3 gap-4 items-center" data-id="uxgc1de29">
                    {/* Team 1 */}
                    <div className="text-right space-y-1" data-id="7vmged4fo">
                      <div className="font-semibold" data-id="wvd5d72st">
                        {team1.team?.team_name || team1.owner?.display_name || team1.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground" data-id="llom7vvgx">
                        {team1.team?.owner_name || team1.owner?.display_name || 'Unknown Owner'}
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team1.roster_id ? 'text-green-600' : ''}`} data-id="cc50fwyfz">
                        {matchup.status === 'upcoming' ? '--' : team1.points.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1" data-id="team1-weekly-scores">
                        {getTeamAverage(team1.roster_id)}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center" data-id="9n15z45kn">
                      <div className="text-lg font-semibold text-muted-foreground" data-id="9b07cmgpc">VS</div>
                      {matchup.status === 'completed' && winningTeam &&
                        <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" data-id="c7271tgd7" />
                      }
                    </div>

                    {/* Team 2 */}
                    <div className="text-left space-y-1" data-id="z4z3u2u6r">
                      <div className="font-semibold" data-id="sfpiv3bmf">
                        {team2.team?.team_name || team2.owner?.display_name || team2.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground" data-id="93ajawsfe">
                        {team2.team?.owner_name || team2.owner?.display_name || 'Unknown Owner'}
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team2.roster_id ? 'text-green-600' : ''}`} data-id="qe2zegfup">
                        {matchup.status === 'upcoming' ? '--' : team2.points.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1" data-id="team2-weekly-scores">
                        {getTeamAverage(team2.roster_id)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6" data-id="asgu6eh6p">
                    <div className="border-t pt-4 space-y-4" data-id="5bfhs7wve">
                      {/* Team Rosters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-id="ly97xjb46">
                        {/* Team 1 Roster */}
                        <Card data-id="9trgpa4jm">
                          <CardHeader className="pb-2" data-id="ltc0zwlrx">
                            <CardTitle className="text-sm" data-id="dysqm10dq">
                              {team1.team?.team_name || team1.owner?.display_name || 'Team 1'} Lineup
                            </CardTitle>
                          </CardHeader>
                          <CardContent data-id="bgw6ozitx">
                            <div className="space-y-2" data-id="21mvokaf1">
                              {team1.roster?.starters.map((playerId, index) =>
                                <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm" data-id="8k8emqpo4">
                                  <span data-id="pas27okwd">{getPlayerName(playerId)}</span>
                                  <span className="font-medium" data-id="clg6dy6iq">
                                    {team1.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              ) || <p className="text-muted-foreground text-sm" data-id="mkoj6ewa5">No lineup data available</p>}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Team 2 Roster */}
                        <Card data-id="nv2i6ths9">
                          <CardHeader className="pb-2" data-id="dzxahfxhe">
                            <CardTitle className="text-sm" data-id="9qgo6ywvp">
                              {team2.team?.team_name || team2.owner?.display_name || 'Team 2'} Lineup
                            </CardTitle>
                          </CardHeader>
                          <CardContent data-id="sg70vosuu">
                            <div className="space-y-2" data-id="2la9a2ufg">
                              {team2.roster?.starters.map((playerId, index) =>
                                <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm" data-id="fhfk5nbfz">
                                  <span data-id="spf3pshho">{getPlayerName(playerId)}</span>
                                  <span className="font-medium" data-id="w049qhlpy">
                                    {team2.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              ) || <p className="text-muted-foreground text-sm" data-id="r5k4pne3n">No lineup data available</p>}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Matchup Stats */}
                      {matchup.status !== 'upcoming' &&
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center" data-id="t1tca5g5j">
                          <div data-id="dbvfphcff">
                            <div className="text-sm text-muted-foreground" data-id="s1ubdscjr">Total Points</div>
                            <div className="font-semibold" data-id="msxumz9n2">
                              {(team1.points + team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="edaqyar81">
                            <div className="text-sm text-muted-foreground" data-id="mpapjnwa1">Point Spread</div>
                            <div className="font-semibold" data-id="5aj8oqchi">
                              {Math.abs(team1.points - team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="1wmv16xj6">
                            <div className="text-sm text-muted-foreground" data-id="r9vmtm8w8">High Score</div>
                            <div className="font-semibold" data-id="crev968qq">
                              {Math.max(team1.points, team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="964bpstih">
                            <div className="text-sm text-muted-foreground" data-id="0ab7hq11q">Status</div>
                            <div className="text-xs capitalize" data-id="e0u2yhiho">{matchup.status}</div>
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
          <Card data-id="96qho6imr">
            <CardContent className="py-8 text-center" data-id="zpdwuyr72">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" data-id="y2fbd1viq" />
              <p className="text-muted-foreground" data-id="60mmhbn6f">No matchups found for the selected filters.</p>
              {conferences.length === 0 &&
                <p className="text-sm text-muted-foreground mt-2" data-id="hldwd8nsn">
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