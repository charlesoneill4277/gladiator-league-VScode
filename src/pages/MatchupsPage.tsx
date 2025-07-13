import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle, Bug, CheckCircle, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperPlayer } from '@/services/sleeperApi';
import MatchupService, { OrganizedMatchup as ServiceOrganizedMatchup } from '@/services/matchupService';
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

// Use the interface from MatchupService but alias it for the component
type OrganizedMatchup = ServiceOrganizedMatchup;

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
        Filters: [{
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
      const conferencesFilters = [{
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

  // Fetch matchup data using the new MatchupService
  const fetchMatchupData = async (conferenceData: Conference[], teamData: Team[]) => {
    try {
      console.log('🚀 Starting fetchMatchupData with override support...');
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

      // Get current season ID
      const seasonsResponse = await window.ezsite.apis.tablePage('12818', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: [{ name: 'season_year', op: 'Equal', value: selectedSeason }]
      });

      if (seasonsResponse.error || !seasonsResponse.data.List || seasonsResponse.data.List.length === 0) {
        throw new Error('Season not found');
      }

      const currentSeason = seasonsResponse.data.List[0];
      console.log(`🗓️ Using season ID: ${currentSeason.id} for year ${selectedSeason}`);

      // Use the new MatchupService to fetch organized matchups with override support
      const organizedMatchups = await MatchupService.fetchOrganizedMatchups(
        targetConferences,
        teamData,
        selectedWeek,
        currentSeason.id,
        playersData
      );

      console.log(`✅ MatchupService returned ${organizedMatchups.length} matchups`);

      const debugData = {
        conferences: targetConferences.map((c) => ({
          conference: c.conference_name,
          leagueId: c.league_id,
          matchupsCount: organizedMatchups.filter((m) => m.conference.id === c.id).length
        })),
        totalMatchups: organizedMatchups.length,
        errors: [],
        weekStatus: status,
        useOverrideService: true
      };

      setRawApiData(debugData);
      setApiErrors(errors);
      setMatchups(organizedMatchups);

      console.log(`🎉 Successfully loaded ${organizedMatchups.length} total matchups using MatchupService`);

    } catch (error) {
      const errorMsg = `Failed to fetch matchup data: ${error}`;
      console.error('❌ Error fetching matchup data:', error);
      setApiErrors((prev) => [...prev, errorMsg]);

      toast({
        title: 'API Error',
        description: 'Failed to load matchup data.',
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
        return <Badge className="bg-green-500 hover:bg-green-600" data-id="e0dv5ji3x">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary" data-id="wwntc78j7">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline" data-id="cpfo7mk27">Upcoming</Badge>;
      default:
        return <Badge variant="secondary" data-id="ct7c4zhmj">{status}</Badge>;
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
      <div className="space-y-6" data-id="tzz472nak">
        <div className="flex items-center space-x-2" data-id="5elyljl9e">
          <Swords className="h-6 w-6 text-primary" data-id="tipmf8dg5" />
          <h1 className="text-3xl font-bold" data-id="8piimptxy">Matchups</h1>
        </div>
        <Card data-id="qwkzo4ylj">
          <CardContent className="py-8 text-center" data-id="kf8rxws9c">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" data-id="p29kjp6x5" />
            <p data-id="o8x1o4e4b">Loading matchup data...</p>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="space-y-6" data-id="bznstvnjt">
      {/* Page Header */}
      <div className="flex flex-col space-y-2" data-id="w81qhwjz9">
        <div className="flex items-center space-x-2" data-id="vtiz43b44">
          <Swords className="h-6 w-6 text-primary" data-id="tz9d5dqwq" />
          <h1 className="text-3xl font-bold" data-id="pmxrl2thl">Matchups</h1>
        </div>
        <p className="text-muted-foreground" data-id="kl696l74a">
          {selectedSeason} Season • Week {selectedWeek} • {
          selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name || 'Selected Conference' :
          conferences.length > 0 ? `${conferences.length} Conference${conferences.length !== 1 ? 's' : ''}` : 'All Conferences'
          }
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-id="f7xxssis8">
        <div className="flex items-center space-x-4" data-id="125ys6wco">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))} data-id="j3igcaiwp">
            <SelectTrigger className="w-32" data-id="ss8s60vlp">
              <SelectValue data-id="ig5sdnepw" />
            </SelectTrigger>
            <SelectContent data-id="lhhtlvud7">
              {Array.from({ length: 18 }, (_, i) => i + 1).map((week) =>
              <SelectItem key={week} value={week.toString()} data-id="1gkb8xwkq">
                  <div className="flex items-center space-x-2" data-id="vha6m1iau">
                    <span data-id="okxk86asi">Week {week}</span>
                    {week === currentWeek && <Badge variant="outline" className="text-xs" data-id="cbpjev49a">Current</Badge>}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {selectedWeek === currentWeek &&
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="x9m7t3ckd">
              <Clock className="h-4 w-4" data-id="5sp062vmj" />
              <span data-id="li4ffhv05">Current week</span>
            </div>
          }
        </div>

        <div className="flex items-center space-x-4" data-id="nn6k7tyf1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing} data-id="jrjw8rzfq">

            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} data-id="q3bfy7nzm" />
            Refresh
          </Button>
          
          <Button
            variant={debugMode ? "default" : "outline"}
            size="sm"
            onClick={() => setDebugMode(!debugMode)} data-id="7rfvgv5vw">

            <Bug className="h-4 w-4" data-id="sagck4sf7" />
            Debug {debugMode ? 'ON' : 'OFF'}
          </Button>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="kv6cp64ej">
            <Users className="h-4 w-4" data-id="997m34tb6" />
            <span data-id="dfpuz0sjp">{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Week Status Indicator */}
      {weekStatus &&
      <Card className="border-l-4 border-l-blue-500" data-id="jswil2o46">
          <CardContent className="py-3" data-id="z922umab1">
            <div className="flex items-center space-x-3" data-id="pt4wp2oaq">
              {weekStatus.status === 'future' && <Clock className="h-5 w-5 text-blue-500" data-id="jzy8iwqd2" />}
              {weekStatus.status === 'current' && <Play className="h-5 w-5 text-green-500" data-id="hefiq1xui" />}
              {weekStatus.status === 'live' && <Pause className="h-5 w-5 text-yellow-500" data-id="l9rd0dfuw" />}
              {weekStatus.status === 'completed' && <CheckCircle className="h-5 w-5 text-gray-500" data-id="5p1h2fq44" />}
              <div data-id="pm52q6ppe">
                <div className="font-medium" data-id="05f892apf">Week {weekStatus.week} Status</div>
                <div className="text-sm text-muted-foreground" data-id="8293zd6ka">{weekStatus.description}</div>
                {weekStatus.status === 'future' &&
              <div className="text-xs text-muted-foreground mt-1" data-id="40aec8f5q">
                    ⚠️ Points will not be available until games begin
                  </div>
              }
                {weekStatus.status === 'current' &&
              <div className="text-xs text-muted-foreground mt-1" data-id="7o5uotyq5">
                    🔴 Points may update in real-time during games
                  </div>
              }
                {weekStatus.status === 'completed' && selectedSeason < new Date().getFullYear() &&
              <div className="text-xs text-muted-foreground mt-1" data-id="ju1g9hidc">
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
      <Card className="border-l-4 border-l-red-500" data-id="hgbas33si">
          <CardHeader className="pb-2" data-id="rt9omhj0i">
            <CardTitle className="text-sm flex items-center space-x-2" data-id="6ou85qqug">
              <AlertCircle className="h-4 w-4 text-red-500" data-id="oo55a03jo" />
              <span data-id="3on9tazyg">API Errors ({apiErrors.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent data-id="p3wq9xfjz">
            <div className="space-y-1" data-id="e1b3s6cno">
              {apiErrors.map((error, index) =>
            <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded" data-id="do2bswc0a">
                  {error}
                </div>
            )}
            </div>
          </CardContent>
        </Card>
      }

      {/* Debug Mode Display */}
      {debugMode && rawApiData &&
      <Card className="border-l-4 border-l-purple-500" data-id="pmbix7yr2">
          <CardHeader className="pb-2" data-id="mnnkyi0wx">
            <CardTitle className="text-sm flex items-center space-x-2" data-id="4xsg4dt9q">
              <Bug className="h-4 w-4 text-purple-500" data-id="r1pac9195" />
              <span data-id="i45kcmi6k">Debug Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent data-id="bahwsvjog">
            <div className="space-y-4" data-id="819k7klab">
              <div className="text-sm" data-id="p5e27g165">
                <strong data-id="xuvfcvam7">Week Status:</strong> {rawApiData.weekStatus?.status} - {rawApiData.weekStatus?.description}
              </div>
              <div className="text-sm" data-id="snwx33r4x">
                <strong data-id="ftxxk61ko">Using Override Service:</strong> {rawApiData.useOverrideService ? 'Yes' : 'No'}
              </div>
              <div className="text-sm" data-id="qx41kymn8">
                <strong data-id="6wzfy346o">Total Conferences:</strong> {rawApiData.conferences.length}
              </div>
              <div className="text-sm" data-id="ci26fmdo1">
                <strong data-id="uy5ra6urw">Total Matchups:</strong> {rawApiData.totalMatchups}
              </div>
              {rawApiData.errors.length > 0 &&
            <div className="text-sm" data-id="i3x4axb2z">
                  <strong data-id="d7t1i1fly">Errors:</strong>
                  <pre className="mt-1 p-2 bg-red-50 rounded text-xs overflow-x-auto" data-id="069sjfp5w">
                    {JSON.stringify(rawApiData.errors, null, 2)}
                  </pre>
                </div>
            }
              <details className="text-sm" data-id="nlx157okq">
                <summary className="cursor-pointer font-medium" data-id="rofm6x1nw">Raw API Data</summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto max-h-96" data-id="obx2pshih">
                  {JSON.stringify(rawApiData, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      }

      {/* Matchups Grid */}
      <div className="grid gap-4" data-id="6sbslzdc9">
        {matchups.map((matchup) => {
          const [team1, team2] = matchup.teams;
          const winningTeam = getWinningTeam(matchup);

          return (
            <Card key={`${matchup.conference.id}-${matchup.matchup_id}`} className="hover:shadow-md transition-shadow" data-id="etjc9zd97">
              <Collapsible data-id="ip11rbs8u">
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(`${matchup.conference.id}-${matchup.matchup_id}`)} data-id="ftdztcby7">

                  <CardHeader className="pb-4" data-id="rds1l07iy">
                    <div className="flex items-center justify-between" data-id="o4u785bg2">
                      <div className="flex items-center space-x-2" data-id="e6nig3f8f">
                        <CardTitle className="text-lg" data-id="ybx5fddvc">
                          {matchup.conference.conference_name}
                        </CardTitle>
                        {getStatusBadge(matchup.status)}
                        {matchup.rawData?.isOverride &&
                        <Badge variant="outline" className="text-orange-600 border-orange-300" data-id="8a7una649">
                            Override
                          </Badge>
                        }
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                      expandedMatchups.has(`${matchup.conference.id}-${matchup.matchup_id}`) ? 'rotate-180' : ''}`
                      } data-id="j09kgv49h" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="pt-0" data-id="40fe8n1fw">
                  {/* Matchup Summary */}
                  <div className="grid grid-cols-3 gap-4 items-center" data-id="i7q8pulrx">
                    {/* Team 1 */}
                    <div className="text-right space-y-1" data-id="wa0b8gv81">
                      <div className="font-semibold" data-id="kcb10v9fd">
                        {team1.team?.team_name || team1.owner?.display_name || team1.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground" data-id="uy0yc3u8h">
                        {team1.team?.owner_name || team1.owner?.display_name || 'Unknown Owner'}
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team1.roster_id ? 'text-green-600' : ''}`} data-id="arahbbp67">
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : (team1.points ?? 0).toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1" data-id="yldshpkjb">
                            Raw: {team1.points ?? 'null'}
                          </div>
                        }
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center" data-id="ghtmrqiy4">
                      <div className="text-lg font-semibold text-muted-foreground" data-id="0bcyb0odk">VS</div>
                      {matchup.status === 'completed' && winningTeam &&
                      <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" data-id="jont2fp08" />
                      }
                    </div>

                    {/* Team 2 */}
                    <div className="text-left space-y-1" data-id="ahk41gwuq">
                      <div className="font-semibold" data-id="v411eejl0">
                        {team2.team?.team_name || team2.owner?.display_name || team2.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground" data-id="irjyowtcv">
                        {team2.team?.owner_name || team2.owner?.display_name || 'Unknown Owner'}
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team2.roster_id ? 'text-green-600' : ''}`} data-id="dhtjcdccu">
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : (team2.points ?? 0).toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1" data-id="ai7hr0aw3">
                            Raw: {team2.points ?? 'null'}
                          </div>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6" data-id="eerqsi8e1">
                    <div className="border-t pt-4 space-y-4" data-id="46y5on6xp">
                      {/* Team Starting Lineups */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-id="rd79ubuxt">
                        {/* Team 1 Starting Lineup */}
                        <StartingLineup
                          roster={team1.roster}
                          allPlayers={allPlayers}
                          teamName={team1.team?.team_name || team1.owner?.display_name || 'Team 1'}
                          playerPoints={team1.players_points}
                          startersPoints={team1.starters_points}
                          matchupStarters={team1.matchup_starters} data-id="a1jfe3js1" />


                        {/* Team 2 Starting Lineup */}
                        <StartingLineup
                          roster={team2.roster}
                          allPlayers={allPlayers}
                          teamName={team2.team?.team_name || team2.owner?.display_name || 'Team 2'}
                          playerPoints={team2.players_points}
                          startersPoints={team2.starters_points}
                          matchupStarters={team2.matchup_starters} data-id="ofxq25nn5" />

                      </div>

                      {/* Matchup Stats */}
                      {matchup.status !== 'upcoming' &&
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center" data-id="eew7lcqqp">
                          <div data-id="6xse4akid">
                            <div className="text-sm text-muted-foreground" data-id="se7b3uxp3">Total Points</div>
                            <div className="font-semibold" data-id="8k9ir30kv">
                              {((team1.points ?? 0) + (team2.points ?? 0)).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="eujoon99j">
                            <div className="text-sm text-muted-foreground" data-id="k81fyu8m1">Point Spread</div>
                            <div className="font-semibold" data-id="9ncd1rche">
                              {Math.abs((team1.points ?? 0) - (team2.points ?? 0)).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="0xf1lwujy">
                            <div className="text-sm text-muted-foreground" data-id="xzaguxk92">High Score</div>
                            <div className="font-semibold" data-id="57an52gtp">
                              {Math.max(team1.points ?? 0, team2.points ?? 0).toFixed(1)}
                            </div>
                          </div>
                          <div data-id="e6kn23hu6">
                            <div className="text-sm text-muted-foreground" data-id="r6uspzrkt">Status</div>
                            <div className="text-xs capitalize" data-id="1jv06uokt">{matchup.status}</div>
                            {debugMode && matchup.rawData &&
                          <div className="text-xs text-muted-foreground mt-1" data-id="dltawp3fb">
                                Override: {matchup.rawData.isOverride ? 'Yes' : 'No'}
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
        <Card data-id="6v5zymbil">
            <CardContent className="py-8 text-center" data-id="z15vlyvkx">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" data-id="8yvlr2luc" />
              <p className="text-muted-foreground" data-id="onosfwxm8">No matchups found for the selected filters.</p>
              {conferences.length === 0 &&
            <p className="text-sm text-muted-foreground mt-2" data-id="hv7663xwo">
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