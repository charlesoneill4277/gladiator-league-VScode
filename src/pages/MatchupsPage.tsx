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
import MatchupService, { EnrichedMatchup, Conference, TeamWithConference } from '@/services/matchupService';
import StartingLineup from '@/components/StartingLineup';

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
  const [teams, setTeams] = useState<TeamWithConference[]>([]);
  const [matchups, setMatchups] = useState<EnrichedMatchup[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [weekStatus, setWeekStatus] = useState<WeekStatus | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [rawApiData, setRawApiData] = useState<any>(null);

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
  const fetchMatchupData = async () => {
    try {
      console.log('🚀 Starting fetchMatchupData with MatchupService...');
      
      setApiErrors([]);
      
      // Determine and set week status
      const status = determineWeekStatus(selectedWeek, currentWeek);
      setWeekStatus(status);
      console.log(`📋 Week status:`, status);

      // Use MatchupService to get enriched matchups
      const result = await MatchupService.getMatchupsForDisplay({
        selectedSeason,
        selectedConference,
        selectedWeek,
        currentWeek,
        currentSeasonConfig
      });

      // Update state with results
      setConferences(result.conferences);
      setTeams(result.teams);
      setMatchups(result.matchups);
      setAllPlayers(result.allPlayers);
      setApiErrors(result.errors);

      console.log(`✅ Successfully loaded ${result.matchups.length} enriched matchups`);
      console.log(`📊 Conferences: ${result.conferences.length}, Teams: ${result.teams.length}`);

      // Update debug data
      if (debugMode) {
        setRawApiData({
          matchups: result.matchups,
          conferences: result.conferences,
          teams: result.teams,
          totalMatchups: result.matchups.length,
          errors: result.errors,
          weekStatus: status
        });
      }

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

      await fetchMatchupData();

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

  const getWinningTeam = (matchup: EnrichedMatchup) => {
    if (matchup.status !== 'completed') return null;
    const [team1, team2] = matchup.teams;
    return team1.points > team2.points ? team1 : team2;
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {selectedWeek} • {
          selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name || 'Selected Conference' :
          conferences.length > 0 ? `${conferences.length} Conference${conferences.length !== 1 ? 's' : ''}` : 'All Conferences'
          }
        </p>
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
                <strong>Total Conferences:</strong> {rawApiData.conferences?.length || 0}
              </div>
              <div className="text-sm">
                <strong>Total Matchups:</strong> {rawApiData.totalMatchups || 0}
              </div>
              {rawApiData.errors?.length > 0 &&
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

      {/* Matchups Grid */}
      <div className="grid gap-4">
        {matchups.map((matchup) => {
          const [team1, team2] = matchup.teams;
          const winningTeam = getWinningTeam(matchup);

          return (
            <Card 
              key={`${matchup.database_id}`} 
              className={`hover:shadow-md transition-shadow ${matchup.is_manual_override ? 'border-l-4 border-l-orange-400' : ''}`}
            >
              <Collapsible>
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(`${matchup.database_id}`)}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-lg">
                          {matchup.conference.conference_name}
                        </CardTitle>
                        {getStatusBadge(matchup.status)}
                        {matchup.is_manual_override && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Override
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                      expandedMatchups.has(`${matchup.database_id}`) ? 'rotate-180' : ''}`
                      } />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="pt-0">
                  {/* Matchup Summary */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Team 1 */}
                    <div className="text-right space-y-1">
                      <div className="font-semibold">
                        {team1.team?.team_name || team1.owner?.display_name || team1.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {team1.team?.owner_name || team1.owner?.display_name || 'Unknown Owner'}
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
                      <div className="text-lg font-semibold text-muted-foreground">VS</div>
                      {matchup.status === 'completed' && winningTeam &&
                      <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" />
                      }
                    </div>

                    {/* Team 2 */}
                    <div className="text-left space-y-1">
                      <div className="font-semibold">
                        {team2.team?.team_name || team2.owner?.display_name || team2.owner?.username || 'Unknown Team'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {team2.team?.owner_name || team2.owner?.display_name || 'Unknown Owner'}
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
                    <div className="border-t pt-4 space-y-4">
                      {/* Team Starting Lineups */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Team 1 Starting Lineup */}
                        <StartingLineup
                          roster={team1.roster}
                          allPlayers={allPlayers}
                          teamName={team1.team?.team_name || team1.owner?.display_name || 'Team 1'}
                          playerPoints={team1.players_points}
                          startersPoints={team1.starters_points}
                          matchupStarters={team1.matchup_starters} />

                        {/* Team 2 Starting Lineup */}
                        <StartingLineup
                          roster={team2.roster}
                          allPlayers={allPlayers}
                          teamName={team2.team?.team_name || team2.owner?.display_name || 'Team 2'}
                          playerPoints={team2.players_points}
                          startersPoints={team2.starters_points}
                          matchupStarters={team2.matchup_starters} />
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
                            <div className="text-sm text-muted-foreground">Status</div>
                            <div className="text-xs capitalize">{matchup.status}</div>
                            {debugMode &&
                          <div className="text-xs text-muted-foreground mt-1">
                                DB ID: {matchup.database_id}
                              </div>
                          }
                          </div>
                        </div>
                      }
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>
          );
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
    </div>
  );
};

export default MatchupsPage;
