import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle, Bug, CheckCircle, Play, Pause, Database, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperPlayer } from '@/services/sleeperApi';
import MatchupService, { HybridMatchup, Conference, Team } from '@/services/matchupService';
import StartingLineup from '@/components/StartingLineup';
import MatchupDebugDashboard from '@/components/MatchupDebugDashboard';
import { matchupDataFlowDebugger } from '@/services/matchupDataFlowDebugger';

// Types are now imported from matchupService

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
  const [matchups, setMatchups] = useState<HybridMatchup[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [teamConferenceMap, setTeamConferenceMap] = useState<Map<number, Conference>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [showDebugDashboard, setShowDebugDashboard] = useState(false);
  const [weekStatus, setWeekStatus] = useState<WeekStatus | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [rawApiData, setRawApiData] = useState<any>(null);
  const [dataSourceStats, setDataSourceStats] = useState<{
    database: number;
    sleeper: number;
    hybrid: number;
  }>({ database: 0, sleeper: 0, hybrid: 0 });

  // Data fetching methods have been moved to MatchupService

  // Fetch team-conference mappings to support inter-conference matchup detection
  const fetchTeamConferenceMappings = async (conferenceData: Conference[]) => {
    try {
      console.log('Fetching team-conference mappings for inter-conference detection...');

      const mappingResponse = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 500,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
        {
          name: 'is_active',
          op: 'Equal',
          value: true
        }]

      });

      if (mappingResponse.error) {
        throw new Error(mappingResponse.error);
      }

      const mappings = mappingResponse.data.List;
      const newTeamConferenceMap = new Map<number, Conference>();

      mappings.forEach((mapping: any) => {
        const conference = conferenceData.find((c) => c.id === mapping.conference_id);
        if (conference) {
          newTeamConferenceMap.set(mapping.team_id, conference);
        }
      });

      setTeamConferenceMap(newTeamConferenceMap);
      console.log(`✅ Built team-conference mapping for ${newTeamConferenceMap.size} teams`);
    } catch (error) {
      console.error('❌ Error fetching team-conference mappings:', error);
      // Don't throw - inter-conference detection will just be unavailable
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

      // Fetch team-conference mappings to support inter-conference detection
      await fetchTeamConferenceMappings(conferenceData);

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

  // Enhanced fetchMatchupData with hybrid service integration and debugging
  const fetchMatchupData = async (conferenceData: Conference[], teamData: Team[]) => {
    try {
      console.log('🚀 Starting hybrid matchup data fetch...');
      console.log(`📊 Conference count: ${conferenceData.length}`);
      console.log(`👥 Team count: ${teamData.length}`);
      console.log(`📅 Selected week: ${selectedWeek}`);
      console.log(`📅 Current week: ${currentWeek}`);

      // Enable debug mode in MatchupService if debug mode is active
      MatchupService.setDebugMode(debugMode);

      setApiErrors([]);
      const errors: string[] = [];

      // Determine and set week status
      const status = determineWeekStatus(selectedWeek, currentWeek);
      setWeekStatus(status);
      console.log(`📋 Week status:`, status);

      if (conferenceData.length === 0) {
        console.warn('⚠️ No conferences found');
        setMatchups([]);
        return;
      }

      console.log('🔗 Fetching players data from Sleeper API...');
      // Fetch players data once
      const playersData = await SleeperApiService.fetchAllPlayers();
      setAllPlayers(playersData);
      console.log(`✅ Loaded ${Object.keys(playersData).length} players`);

      // Use hybrid service to get matchups with season-aware filtering
      const hybridMatchups = await MatchupService.getHybridMatchups(
        conferenceData,
        teamData,
        selectedWeek,
        currentWeek,
        selectedSeason,
        playersData
      );

      // Calculate data source statistics - all matchups now use hybrid flow
      const sourceStats = {
        database: 0, // No longer used - all manual overrides use hybrid flow
        sleeper: hybridMatchups.filter((m) => m.dataSource === 'sleeper').length,
        hybrid: hybridMatchups.filter((m) => m.dataSource === 'hybrid').length
      };

      // Count manual score overrides within hybrid flow
      const manualOverrideCount = hybridMatchups.filter((m) => m.isManualOverride).length;

      setDataSourceStats(sourceStats);
      setMatchups(hybridMatchups);

      // Set debug data
      const debugData = {
        conferences: conferenceData.length,
        totalMatchups: hybridMatchups.length,
        errors: [],
        weekStatus: status,
        dataSourceStats: sourceStats,
        manualOverrideCount,
        hybridMatchups: hybridMatchups.map((m) => ({
          id: m.matchup_id,
          conference: m.conference.conference_name,
          teams: m.teams.map((t) => t.team?.team_name || t.owner?.display_name || 'Unknown'),
          dataSource: m.dataSource,
          isManualOverride: m.isManualOverride,
          isManualScoreOverride: m.rawData?.isManualScoreOverride || false
        }))
      };

      setRawApiData(debugData);

      console.log(`✅ Successfully loaded ${hybridMatchups.length} hybrid matchups`);
      console.log('📊 Data source stats:', sourceStats);
      console.log(`🔧 Manual score overrides: ${manualOverrideCount}`);
      console.log('🔄 All matchups now use Hybrid Data Flow (Database assignments + Sleeper API data)');

    } catch (error) {
      const errorMsg = `Failed to fetch hybrid matchup data: ${error}`;
      console.error('❌ Error fetching matchup data:', error);
      setApiErrors((prev) => [...prev, errorMsg]);

      toast({
        title: 'Data Error',
        description: 'Failed to load matchup data.',
        variant: 'destructive'
      });
    }
  };

  // Helper method has been moved to MatchupService

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
        return <Badge className="bg-green-500 hover:bg-green-600">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlayerName = (playerId: string): string => {
    const player = allPlayers[playerId];
    return SleeperApiService.getPlayerName(player);
  };

  const getWinningTeam = (matchup: HybridMatchup) => {
    if (matchup.status !== 'completed') return null;
    const [team1, team2] = matchup.teams;
    return team1.points > team2.points ? team1 : team2;
  };

  // Helper function to find team's conference data
  const findTeamConferenceData = (teamId: number, allConferences: Conference[]): Conference | null => {
    return teamConferenceMap.get(teamId) || null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p>Loading matchup data...</p>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">
            {selectedSeason} Season • Week {selectedWeek} • {
            selectedConference ?
            currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name || 'Selected Conference' :
            conferences.length > 0 ? `${conferences.length} Conference${conferences.length !== 1 ? 's' : ''}` : 'All Conferences'
            }
          </p>
          {/* Inter-conference week indicator */}
          {selectedWeek % 3 === 0 &&
          <div className="flex items-center space-x-2 text-sm">
              <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                ⚔️ Inter-Conference Week
              </Badge>
              <span className="text-purple-600 text-xs">
                Teams from different conferences may face each other this week
              </span>
            </div>
          }
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 18 }, (_, i) => i + 1).map((week) =>
              <SelectItem key={week} value={week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week}</span>
                    {week === currentWeek && <Badge variant="outline" className="text-xs">Current</Badge>}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {selectedWeek === currentWeek &&
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Current week</span>
            </div>
          }
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}>

            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant={debugMode ? "default" : "outline"}
            size="sm"
            onClick={() => setDebugMode(!debugMode)}>

            <Bug className="h-4 w-4" />
            Debug {debugMode ? 'ON' : 'OFF'}
          </Button>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Week Status Indicator */}
      {weekStatus &&
      <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-3">
            <div className="flex items-center space-x-3">
              {weekStatus.status === 'future' && <Clock className="h-5 w-5 text-blue-500" />}
              {weekStatus.status === 'current' && <Play className="h-5 w-5 text-green-500" />}
              {weekStatus.status === 'live' && <Pause className="h-5 w-5 text-yellow-500" />}
              {weekStatus.status === 'completed' && <CheckCircle className="h-5 w-5 text-gray-500" />}
              <div>
                <div className="font-medium">Week {weekStatus.week} Status</div>
                <div className="text-sm text-muted-foreground">{weekStatus.description}</div>
                {weekStatus.status === 'future' &&
              <div className="text-xs text-muted-foreground mt-1">
                    ⚠️ Points will not be available until games begin
                  </div>
              }
                {weekStatus.status === 'current' &&
              <div className="text-xs text-muted-foreground mt-1">
                    🔴 Points may update in real-time during games
                  </div>
              }
                {weekStatus.status === 'completed' && selectedSeason < new Date().getFullYear() &&
              <div className="text-xs text-muted-foreground mt-1">
                    📊 Historical season data - All scores are final
                  </div>
              }
              </div>
            </div>
          </CardContent>
        </Card>
      }

      {/* Data Source Summary - Updated for Unified Hybrid Flow */}
      {(dataSourceStats.sleeper > 0 || dataSourceStats.hybrid > 0) &&
      <Card className="border-l-4 border-l-green-500">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium">Unified Hybrid Data Flow</div>
                  <div className="text-sm text-muted-foreground">
                    All matchups use database team assignments + Sleeper API data
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                {dataSourceStats.hybrid > 0 &&
              <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>{dataSourceStats.hybrid} Hybrid</span>
                  </div>
              }
                {dataSourceStats.sleeper > 0 &&
              <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>{dataSourceStats.sleeper} Sleeper-Only</span>
                  </div>
              }
                {rawApiData?.manualOverrideCount > 0 &&
              <div className="flex items-center space-x-1">
                    <Database className="h-3 w-3 text-orange-500" />
                    <span>{rawApiData.manualOverrideCount} Score Override{rawApiData.manualOverrideCount !== 1 ? 's' : ''}</span>
                  </div>
              }
              </div>
            </div>
          </CardContent>
        </Card>
      }

      {/* API Errors Display */}
      {apiErrors.length > 0 &&
      <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span>API Errors ({apiErrors.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {apiErrors.map((error, index) =>
            <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
            )}
            </div>
          </CardContent>
        </Card>
      }

      {/* Debug Mode Display */}
      {debugMode && rawApiData &&
      <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Bug className="h-4 w-4 text-purple-500" />
              <span>Debug Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm">
                <strong>Week Status:</strong> {rawApiData.weekStatus?.status} - {rawApiData.weekStatus?.description}
              </div>
              <div className="text-sm">
                <strong>Total Conferences:</strong> {rawApiData.conferences.length}
              </div>
              <div className="text-sm">
                <strong>Total Matchups:</strong> {rawApiData.totalMatchups}
              </div>
              {rawApiData.errors.length > 0 &&
            <div className="text-sm">
                  <strong>Errors:</strong>
                  <pre className="mt-1 p-2 bg-red-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(rawApiData.errors, null, 2)}
                  </pre>
                </div>
            }
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Raw API Data</summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(rawApiData, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      }

      {/* Inter-Conference Matchups Summary */}
      {(() => {
        const interConferenceCount = matchups.filter((matchup) => {
          const [team1, team2] = matchup.teams;
          const team1Conference = team1.database_team_id ? findTeamConferenceData(team1.database_team_id, conferences) : null;
          const team2Conference = team2.database_team_id ? findTeamConferenceData(team2.database_team_id, conferences) : null;
          return team1Conference && team2Conference && team1Conference.id !== team2Conference.id;
        }).length;

        if (interConferenceCount > 0) {
          return (
            <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-blue-50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-full">
                      <span className="text-lg">⚔️</span>
                    </div>
                    <div>
                      <div className="font-medium text-purple-800">
                        {interConferenceCount} Inter-Conference Matchup{interConferenceCount !== 1 ? 's' : ''}
                      </div>
                      <div className="text-sm text-purple-600">
                        Teams from different conferences competing this week
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-purple-600 hover:bg-purple-700 text-white">
                      Week {selectedWeek}
                    </Badge>
                    {selectedWeek % 3 === 0 &&
                    <div className="text-xs text-purple-600 mt-1">
                        Scheduled Inter-Conference Week
                      </div>
                    }
                  </div>
                </div>
              </CardContent>
            </Card>);

        }
        return null;
      })()}

      {/* Matchups Grid */}
      <div className="grid gap-4">
        {matchups.map((matchup) => {
          const [team1, team2] = matchup.teams;
          const winningTeam = getWinningTeam(matchup);

          // Determine if this is an inter-conference matchup
          const team1Conference = team1.database_team_id ? findTeamConferenceData(team1.database_team_id, conferences) : null;
          const team2Conference = team2.database_team_id ? findTeamConferenceData(team2.database_team_id, conferences) : null;
          const isInterConference = team1Conference && team2Conference && team1Conference.id !== team2Conference.id;

          // Determine if it's a special inter-conference week (every 3rd week according to rules)
          const isInterConferenceWeek = selectedWeek % 3 === 0;

          return (
            <Card key={`${matchup.conference.id}-${matchup.matchup_id}`}
            className={`hover:shadow-md transition-shadow ${
            isInterConference ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 via-white to-blue-50' : ''}`
            }>
              <Collapsible>
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(`${matchup.conference.id}-${matchup.matchup_id}`)}>

                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg">
                            {isInterConference ? 'Inter-Conference Matchup' : matchup.conference.conference_name}
                          </CardTitle>
                          {isInterConference && isInterConferenceWeek &&
                          <Badge className="text-xs bg-purple-600 hover:bg-purple-700 text-white">
                              <span className="animate-pulse">⚔️</span>
                              <span className="ml-1">Week {selectedWeek}</span>
                            </Badge>
                          }
                          {isInterConference && !isInterConferenceWeek &&
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                              ⚠️ Special Matchup
                            </Badge>
                          }
                        </div>
                        
                        {/* Conference badges for inter-conference matchups */}
                        {isInterConference &&
                        <div className="flex items-center space-x-1">
                            <Badge variant="secondary" className="text-xs">
                              {team1Conference?.conference_name || 'Unknown'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">vs</span>
                            <Badge variant="secondary" className="text-xs">
                              {team2Conference?.conference_name || 'Unknown'}
                            </Badge>
                          </div>
                        }
                        
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(matchup.status)}
                          {matchup.isManualOverride &&
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              <Database className="h-3 w-3 mr-1" />
                              Score Override
                            </Badge>
                          }
                          {debugMode &&
                          <Badge variant="outline" className="text-xs">
                              {matchup.dataSource}
                            </Badge>
                          }
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                      expandedMatchups.has(`${matchup.conference.id}-${matchup.matchup_id}`) ? 'rotate-180' : ''}`
                      } />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="pt-0">
                  {/* Matchup Summary */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Team 1 */}
                    <div className="text-right space-y-1">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {team1.team?.team_name || team1.owner?.display_name || team1.owner?.username || 'Unknown Team'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {team1.team?.owner_name || team1.owner?.display_name || 'Unknown Owner'}
                        </div>
                        {/* Show team's conference badge for inter-conference matchups */}
                        {isInterConference && team1Conference &&
                        <div className="flex justify-end">
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              🏠 {team1Conference.conference_name}
                            </Badge>
                          </div>
                        }
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team1.roster_id ? 'text-green-600' : ''}`}>
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : (team1.points ?? 0).toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1">
                            Raw: {team1.points ?? 'null'}
                          </div>
                        }
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center">
                      <div className={`text-lg font-semibold ${
                      isInterConference ? 'text-purple-600' : 'text-muted-foreground'}`
                      }>
                        {isInterConference ? '⚔️' : 'VS'}
                      </div>
                      {isInterConference &&
                      <div className="text-xs text-purple-600 mt-1">
                          Cross-Conference
                        </div>
                      }
                      {matchup.status === 'completed' && winningTeam &&
                      <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" />
                      }
                    </div>

                    {/* Team 2 */}
                    <div className="text-left space-y-1">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {team2.team?.team_name || team2.owner?.display_name || team2.owner?.username || 'Unknown Team'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {team2.team?.owner_name || team2.owner?.display_name || 'Unknown Owner'}
                        </div>
                        {/* Show team's conference badge for inter-conference matchups */}
                        {isInterConference && team2Conference &&
                        <div className="flex justify-start">
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              🏠 {team2Conference.conference_name}
                            </Badge>
                          </div>
                        }
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam?.roster_id === team2.roster_id ? 'text-green-600' : ''}`}>
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : (team2.points ?? 0).toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1">
                            Raw: {team2.points ?? 'null'}
                          </div>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6">
                    <div className={`border-t pt-4 space-y-4 ${
                    isInterConference ? 'bg-gradient-to-r from-purple-25 via-white to-blue-25' : ''}`
                    }>
                      {/* Inter-conference matchup detailed info */}
                      {isInterConference &&
                      <div className="mb-4 p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-purple-800 flex items-center space-x-2">
                                <span className="text-lg">⚔️</span>
                                <span>Inter-Conference Battle</span>
                              </div>
                              <div className="text-sm text-purple-700 mt-1">
                                {team1Conference?.conference_name || 'Unknown'} vs {team2Conference?.conference_name || 'Unknown'}
                              </div>
                            </div>
                            <div className="text-right">
                              {isInterConferenceWeek ?
                            <Badge className="bg-purple-600 hover:bg-purple-700 text-white">
                                  Scheduled Week {selectedWeek}
                                </Badge> :

                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                  ⚠️ Special Matchup
                                </Badge>
                            }
                            </div>
                          </div>
                        </div>
                      }
                      {/* Team Starting Lineups */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Team 1 Starting Lineup */}
                        <StartingLineup
                          roster={team1.roster}
                          allPlayers={allPlayers}
                          teamName={team1.team?.team_name || team1.owner?.display_name || 'Team 1'}
                          playerPoints={team1.players_points}
                          startersPoints={team1.starters_points}
                          matchupStarters={team1.matchup_starters}
                          teamConference={team1Conference?.conference_name}
                          opponentConference={team2Conference?.conference_name}
                          isInterConference={isInterConference}
                          teamId={team1.database_team_id}
                          rosterId={team1.roster_id?.toString()}
                          ownerId={team1.owner?.user_id}
                          week={selectedWeek}
                          matchupId={`${matchup.conference.id}-${matchup.matchup_id}`} />

                        {/* Team 2 Starting Lineup */}
                        <StartingLineup
                          roster={team2.roster}
                          allPlayers={allPlayers}
                          teamName={team2.team?.team_name || team2.owner?.display_name || 'Team 2'}
                          playerPoints={team2.players_points}
                          startersPoints={team2.starters_points}
                          matchupStarters={team2.matchup_starters}
                          teamConference={team2Conference?.conference_name}
                          opponentConference={team1Conference?.conference_name}
                          isInterConference={isInterConference}
                          teamId={team2.database_team_id}
                          rosterId={team2.roster_id?.toString()}
                          ownerId={team2.owner?.user_id}
                          week={selectedWeek}
                          matchupId={`${matchup.conference.id}-${matchup.matchup_id}`} />

                      </div>

                      {/* Matchup Stats */}
                      {matchup.status !== 'upcoming' &&
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-sm text-muted-foreground">Total Points</div>
                            <div className="font-semibold">
                              {((team1.points ?? 0) + (team2.points ?? 0)).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Point Spread</div>
                            <div className="font-semibold">
                              {Math.abs((team1.points ?? 0) - (team2.points ?? 0)).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">High Score</div>
                            <div className="font-semibold">
                              {Math.max(team1.points ?? 0, team2.points ?? 0).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Data Source</div>
                            <div className="text-xs capitalize">{matchup.dataSource}</div>
                            {matchup.isManualOverride &&
                          <div className="text-xs text-orange-600 mt-1">
                                Score Override
                              </div>
                          }
                          </div>
                        </div>
                      }
                      
                      {/* Manual Override Notes */}
                      {matchup.overrideNotes && matchup.overrideNotes.trim() &&
                      <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <Database className="h-4 w-4 text-orange-600 mt-0.5" />
                            <div>
                              <div className="text-sm font-medium text-orange-800">Score Override Notes</div>
                              <div className="text-sm text-orange-700">{matchup.overrideNotes}</div>
                            </div>
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
        <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No matchups found for the selected filters.</p>
              {conferences.length === 0 &&
            <p className="text-sm text-muted-foreground mt-2">
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