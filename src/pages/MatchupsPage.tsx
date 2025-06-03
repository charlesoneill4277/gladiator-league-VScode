import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle, Bug, CheckCircle, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from '@/services/sleeperApi';
import StartingLineup from '@/components/StartingLineup';

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
  rawData?: any; // For debug mode
}

type WeekStatus = {
  week: number;
  status: 'future' | 'current' | 'live' | 'completed';
  description: string;
};

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
  const [debugMode, setDebugMode] = useState(false);
  const [weekStatus, setWeekStatus] = useState<WeekStatus | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [rawApiData, setRawApiData] = useState<any>(null);

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

  // Determine week status
  const determineWeekStatus = (week: number, currentWeek: number): WeekStatus => {
    console.log(`🔍 Determining status for week ${week}, current week: ${currentWeek}, selected season: ${selectedSeason}`);

    // Get current year to determine if this is a historical season
    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = selectedSeason < currentYear;

    console.log(`📅 Season analysis: ${selectedSeason} (current year: ${currentYear}, historical: ${isHistoricalSeason})`);

    // For historical seasons, all weeks should be treated as completed
    if (isHistoricalSeason) {
      return {
        week,
        status: 'completed',
        description: `Week ${week} - ${selectedSeason} Season (Historical)`
      };
    }

    // For current season, use normal logic
    if (week > currentWeek) {
      return {
        week,
        status: 'future',
        description: `Week ${week} has not started yet`
      };
    } else if (week === currentWeek) {
      return {
        week,
        status: 'current',
        description: `Week ${week} is the current week`
      };
    } else {
      return {
        week,
        status: 'completed',
        description: `Week ${week} has been completed`
      };
    }
  };

  // Fetch matchup data from Sleeper API
  const fetchMatchupData = async (conferenceData: Conference[], teamData: Team[]) => {
    try {
      console.log('🚀 Starting fetchMatchupData...');
      console.log(`📊 Conference count: ${conferenceData.length}`);
      console.log(`👥 Team count: ${teamData.length}`);
      console.log(`📅 Selected week: ${selectedWeek}`);
      console.log(`📅 Current week: ${currentWeek}`);

      setApiErrors([]);
      const errors: string[] = [];

      // Determine and set week status
      const status = determineWeekStatus(selectedWeek, currentWeek);
      setWeekStatus(status);
      console.log(`📋 Week status:`, status);

      // Use all the filtered conferences from the database query
      const targetConferences = conferenceData;

      if (targetConferences.length === 0) {
        console.warn('⚠️ No target conferences found');
        setMatchups([]);
        return;
      }

      console.log('🔗 Fetching players data from Sleeper API...');
      // Fetch players data once
      const playersData = await SleeperApiService.fetchAllPlayers();
      setAllPlayers(playersData);
      console.log(`✅ Loaded ${Object.keys(playersData).length} players`);

      const allMatchups: OrganizedMatchup[] = [];
      const debugData: any = {
        conferences: [],
        totalMatchups: 0,
        errors: [],
        weekStatus: status
      };

      // Process each conference
      for (const conference of targetConferences) {
        try {
          console.log(`🏟️ Processing conference: ${conference.conference_name} (${conference.league_id})`);
          const conferenceDebugData: any = {
            conference: conference.conference_name,
            leagueId: conference.league_id,
            matchupsData: null,
            rostersData: null,
            usersData: null,
            organizedMatchups: null
          };

          console.log(`🔄 Fetching league data for ${conference.conference_name}...`);
          // Fetch league data
          const [matchupsData, rostersData, usersData] = await Promise.all([
          SleeperApiService.fetchMatchups(conference.league_id, selectedWeek),
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)]
          );

          console.log(`📈 Raw matchup data for ${conference.conference_name}:`, {
            matchupsCount: matchupsData.length,
            rostersCount: rostersData.length,
            usersCount: usersData.length,
            sampleMatchup: matchupsData[0] || null
          });

          // Store debug data
          conferenceDebugData.matchupsData = matchupsData;
          conferenceDebugData.rostersData = rostersData;
          conferenceDebugData.usersData = usersData;

          // Check for points data availability
          const hasPointsData = matchupsData.some((m) => m.points > 0);
          const hasPlayersPoints = matchupsData.some((m) => m.players_points && Object.keys(m.players_points).length > 0);
          const hasStartersPoints = matchupsData.some((m) => m.starters_points && m.starters_points.length > 0);

          console.log(`🎯 Points data analysis for ${conference.conference_name}:`, {
            hasPointsData,
            hasPlayersPoints,
            hasStartersPoints,
            pointsRange: matchupsData.map((m) => m.points),
            playersPointsKeys: matchupsData.map((m) => Object.keys(m.players_points || {}).length),
            startersPointsLengths: matchupsData.map((m) => (m.starters_points || []).length)
          });

          // Organize matchups
          const organizedMatchups = SleeperApiService.organizeMatchups(
            matchupsData,
            rostersData,
            usersData
          );

          conferenceDebugData.organizedMatchups = organizedMatchups;
          console.log(`🎲 Organized ${organizedMatchups.length} matchups for ${conference.conference_name}`);

          // Convert to our format and add team data
          const conferenceMatchups: OrganizedMatchup[] = organizedMatchups.map((matchup) => {
            const matchupWithData = {
              matchup_id: matchup.matchup_id,
              conference,
              teams: matchup.teams.map((team) => {
                // Find corresponding team from database
                const dbTeam = teamData.find((t) =>
                team.owner && t.owner_id === team.owner.user_id
                );

                const matchupTeam = matchupsData.find((m) => m.roster_id === team.roster_id);

                console.log(`👤 Team data for roster ${team.roster_id}:`, {
                  points: team.points,
                  hasMatchupTeam: !!matchupTeam,
                  playersPointsCount: Object.keys(matchupTeam?.players_points || {}).length,
                  startersPointsCount: (matchupTeam?.starters_points || []).length,
                  dbTeamFound: !!dbTeam
                });

                return {
                  ...team,
                  team: dbTeam || null,
                  players_points: matchupTeam?.players_points || {},
                  starters_points: matchupTeam?.starters_points || [],
                  // Add fallback handling for zero points
                  points: team.points ?? 0 // Use nullish coalescing to handle null/undefined
                };
              }),
              status: determineMatchupStatus(selectedWeek, currentWeek, matchupsData),
              rawData: debugMode ? {
                matchupsData: matchupsData.filter((m) =>
                matchup.teams.some((t) => t.roster_id === m.roster_id)
                ),
                status: status
              } : undefined
            };

            return matchupWithData;
          });

          allMatchups.push(...conferenceMatchups);
          debugData.conferences.push(conferenceDebugData);

        } catch (error) {
          const errorMsg = `Error processing conference ${conference.conference_name}: ${error}`;
          console.error(`❌ ${errorMsg}`, error);
          errors.push(errorMsg);
          debugData.errors.push({
            conference: conference.conference_name,
            error: error instanceof Error ? error.message : String(error)
          });

          toast({
            title: 'Conference Error',
            description: `Failed to load data for ${conference.conference_name}`,
            variant: 'destructive'
          });
        }
      }

      debugData.totalMatchups = allMatchups.length;
      setRawApiData(debugData);
      setApiErrors(errors);
      setMatchups(allMatchups);

      console.log(`✅ Successfully loaded ${allMatchups.length} total matchups`);
      console.log(`🐛 Debug data:`, debugData);

    } catch (error) {
      const errorMsg = `Failed to fetch matchup data: ${error}`;
      console.error('❌ Error fetching matchup data:', error);
      setApiErrors((prev) => [...prev, errorMsg]);

      toast({
        title: 'API Error',
        description: 'Failed to load matchup data from Sleeper API.',
        variant: 'destructive'
      });
    }
  };

  // Helper method to determine matchup status with better logic
  const determineMatchupStatus = (selectedWeek: number, currentWeek: number, matchupsData: SleeperMatchup[]): 'live' | 'completed' | 'upcoming' => {
    // Get current year to determine if this is a historical season
    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = selectedSeason < currentYear;

    console.log(`🏈 Determining matchup status: week ${selectedWeek}, current week ${currentWeek}, historical: ${isHistoricalSeason}`);

    // For historical seasons, all matchups should be treated as completed
    if (isHistoricalSeason) {
      return 'completed';
    }

    // For current season, use normal logic
    if (selectedWeek > currentWeek) {
      return 'upcoming';
    }

    // Check if any matchup has points > 0
    const hasPoints = matchupsData.some((m) => m.points > 0);

    if (selectedWeek < currentWeek) {
      return hasPoints ? 'completed' : 'completed'; // Past weeks should always be completed
    }

    // Current week - check if scoring has started
    return hasPoints ? 'live' : 'upcoming';
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
            variant={debugMode ? "default" : "outline"}
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
            data-id="debug-toggle">
            <Bug className="h-4 w-4" data-id="453onopf2" />
            Debug {debugMode ? 'ON' : 'OFF'}
          </Button>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="iynipopcu">
            <Users className="h-4 w-4" data-id="5orje3dyb" />
            <span data-id="aq3kqzkdv">{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Week Status Indicator */}
      {weekStatus &&
      <Card className="border-l-4 border-l-blue-500" data-id="week-status-card">
          <CardContent className="py-3" data-id="1hu3ps9cx">
            <div className="flex items-center space-x-3" data-id="44tk574lj">
              {weekStatus.status === 'future' && <Clock className="h-5 w-5 text-blue-500" data-id="1mg9v2mh0" />}
              {weekStatus.status === 'current' && <Play className="h-5 w-5 text-green-500" data-id="wp2d5da65" />}
              {weekStatus.status === 'live' && <Pause className="h-5 w-5 text-yellow-500" data-id="s3g2adpnn" />}
              {weekStatus.status === 'completed' && <CheckCircle className="h-5 w-5 text-gray-500" data-id="7bauwa7o6" />}
              <div data-id="6j89tcn6m">
                <div className="font-medium" data-id="yf4eg2wh1">Week {weekStatus.week} Status</div>
                <div className="text-sm text-muted-foreground" data-id="6l9qm6dmg">{weekStatus.description}</div>
                {weekStatus.status === 'future' &&
              <div className="text-xs text-muted-foreground mt-1" data-id="s1tfi2gvp">
                    ⚠️ Points will not be available until games begin
                  </div>
              }
                {weekStatus.status === 'current' &&
              <div className="text-xs text-muted-foreground mt-1" data-id="8lff9lfjk">
                    🔴 Points may update in real-time during games
                  </div>
              }
                {weekStatus.status === 'completed' && selectedSeason < new Date().getFullYear() &&
              <div className="text-xs text-muted-foreground mt-1" data-id="historical-note">
                    📊 Historical season data - All scores are final
                  </div>
              }
              </div>
            </div>
          </CardContent>
        </Card>
      }

      {/* API Errors Display */}
      {apiErrors.length > 0 &&
      <Card className="border-l-4 border-l-red-500" data-id="api-errors-card">
          <CardHeader className="pb-2" data-id="tgg1478zv">
            <CardTitle className="text-sm flex items-center space-x-2" data-id="u1wew10pr">
              <AlertCircle className="h-4 w-4 text-red-500" data-id="oi1rg6n87" />
              <span data-id="s3sg3y1lz">API Errors ({apiErrors.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent data-id="094f0l3sf">
            <div className="space-y-1" data-id="df0kyi0u9">
              {apiErrors.map((error, index) =>
            <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded" data-id="vnepgef9l">
                  {error}
                </div>
            )}
            </div>
          </CardContent>
        </Card>
      }

      {/* Debug Mode Display */}
      {debugMode && rawApiData &&
      <Card className="border-l-4 border-l-purple-500" data-id="debug-data-card">
          <CardHeader className="pb-2" data-id="xriz8cgpq">
            <CardTitle className="text-sm flex items-center space-x-2" data-id="headjohza">
              <Bug className="h-4 w-4 text-purple-500" data-id="21po93eqa" />
              <span data-id="23s1ny0co">Debug Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent data-id="zb7irb3n2">
            <div className="space-y-4" data-id="4rs39f93y">
              <div className="text-sm" data-id="vr18929du">
                <strong data-id="e179e8v3j">Week Status:</strong> {rawApiData.weekStatus?.status} - {rawApiData.weekStatus?.description}
              </div>
              <div className="text-sm" data-id="q9a96zi3r">
                <strong data-id="dziiqvr2k">Total Conferences:</strong> {rawApiData.conferences.length}
              </div>
              <div className="text-sm" data-id="o9yddjlx6">
                <strong data-id="6ma52u14y">Total Matchups:</strong> {rawApiData.totalMatchups}
              </div>
              {rawApiData.errors.length > 0 &&
            <div className="text-sm" data-id="w4icl11p1">
                  <strong data-id="rvnpaaz53">Errors:</strong>
                  <pre className="mt-1 p-2 bg-red-50 rounded text-xs overflow-x-auto" data-id="acrayej7u">
                    {JSON.stringify(rawApiData.errors, null, 2)}
                  </pre>
                </div>
            }
              <details className="text-sm" data-id="zjs2zb6q6">
                <summary className="cursor-pointer font-medium" data-id="dgmvzm77t">Raw API Data</summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto max-h-96" data-id="1ar92ui0w">
                  {JSON.stringify(rawApiData, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      }

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
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : (team1.points ?? 0).toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1" data-id="jiqxzzdfi">
                            Raw: {team1.points ?? 'null'}
                          </div>
                        }
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
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : (team2.points ?? 0).toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1" data-id="wdwipokg2">
                            Raw: {team2.points ?? 'null'}
                          </div>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6" data-id="asgu6eh6p">
                    <div className="border-t pt-4 space-y-4" data-id="5bfhs7wve">
                      {/* Team Starting Lineups */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-id="ly97xjb46">
                        {/* Team 1 Starting Lineup */}
                        <StartingLineup
                          roster={team1.roster}
                          allPlayers={allPlayers}
                          teamName={team1.team?.team_name || team1.owner?.display_name || 'Team 1'}
                          playerPoints={team1.players_points}
                          startersPoints={team1.starters_points}
                        />

                        {/* Team 2 Starting Lineup */}
                        <StartingLineup
                          roster={team2.roster}
                          allPlayers={allPlayers}
                          teamName={team2.team?.team_name || team2.owner?.display_name || 'Team 2'}
                          playerPoints={team2.players_points}
                          startersPoints={team2.starters_points}
                        />
                      </div>

                      {/* Matchup Stats */}
                      {matchup.status !== 'upcoming' &&
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center" data-id="t1tca5g5j">
                          <div data-id="dbvfphcff">
                            <div className="text-sm text-muted-foreground" data-id="s1ubdscjr">Total Points</div>
                            <div className="font-semibold" data-id="msxumz9n2">
                              {((team1.points ?? 0) + (team2.points ?? 0)).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="edaqyar81">
                            <div className="text-sm text-muted-foreground" data-id="mpapjnwa1">Point Spread</div>
                            <div className="font-semibold" data-id="5aj8oqchi">
                              {Math.abs((team1.points ?? 0) - (team2.points ?? 0)).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="1wmv16xj6">
                            <div className="text-sm text-muted-foreground" data-id="r9vmtm8w8">High Score</div>
                            <div className="font-semibold" data-id="crev968qq">
                              {Math.max(team1.points ?? 0, team2.points ?? 0).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="964bpstih">
                            <div className="text-sm text-muted-foreground" data-id="0ab7hq11q">Status</div>
                            <div className="text-xs capitalize" data-id="e0u2yhiho">{matchup.status}</div>
                            {debugMode && matchup.rawData &&
                          <div className="text-xs text-muted-foreground mt-1" data-id="krewxtq9t">
                                Raw matchups: {matchup.rawData.matchupsData?.length || 0}
                              </div>
                          }
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