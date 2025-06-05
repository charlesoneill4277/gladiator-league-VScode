import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle, Bug, CheckCircle, Play, Pause, Database, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { matchupDataPipeline, ProcessedMatchup, ProcessedTeamMatchupData } from '@/services/matchupDataPipeline';
import { hybridDataService } from '@/services/hybridDataService';
import enhancedMatchupService, { EnhancedMatchupResult } from '@/services/enhancedMatchupService';
import StartingLineup from '@/components/StartingLineup';

type WeekStatus = {
  week: number;
  status: 'future' | 'current' | 'live' | 'completed';
  description: string;
};

interface ExtendedProcessedMatchup extends ProcessedMatchup {
  conference?: {id: number;conference_name: string;};
  dataSource?: string;
  isManualOverride?: boolean;
}

interface EnhancedMatchupDisplay {
  matchupId: string;
  week: number;
  status: 'upcoming' | 'live' | 'completed';
  isInterConference: boolean;
  isManualOverride: boolean;
  team1: {
    teamName: string;
    ownerName: string;
    conferenceId: number;
    conferenceName: string;
    totalPoints: number;
    starters: Array<{
      position: string;
      playerName: string;
      points: number;
    }>;
  };
  team2: {
    teamName: string;
    ownerName: string;
    conferenceId: number;
    conferenceName: string;
    totalPoints: number;
    starters: Array<{
      position: string;
      playerName: string;
      points: number;
    }>;
  };
  winner?: 'team1' | 'team2' | null;
  dataQuality: {
    overallScore: number;
    issues: string[];
    warnings: string[];
  };
  conference?: {id: number;conference_name: string;};
  dataSource?: string;
}

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();

  const [selectedWeek, setSelectedWeek] = useState<number>(14);
  const [currentWeek, setCurrentWeek] = useState<number>(14);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());
  const [matchups, setMatchups] = useState<EnhancedMatchupDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [useEnhancedPipeline, setUseEnhancedPipeline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [weekStatus, setWeekStatus] = useState<WeekStatus | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [rawApiData, setRawApiData] = useState<any>(null);
  const [dataSourceStats, setDataSourceStats] = useState<{
    database: number;
    sleeper: number;
    hybrid: number;
  }>({ database: 0, sleeper: 0, hybrid: 0 });

  // Get current NFL week on mount
  useEffect(() => {
    const getCurrentWeek = async () => {
      try {
        // Fetch current week from API or use default
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        let week = 14; // Default

        // Simple week calculation based on date
        if (currentMonth >= 8 && currentMonth <= 11) {// Sep-Dec
          const weekOfYear = Math.floor((currentDate.getDate() +
          new Date(currentDate.getFullYear(), currentMonth, 1).getDay()) / 7);
          week = Math.min(18, Math.max(1, weekOfYear));
        }

        setCurrentWeek(week);
        setSelectedWeek(week);
      } catch (error) {
        console.error('Error getting current week:', error);
      }
    };

    getCurrentWeek();
  }, []);

  // Determine week status
  const determineWeekStatus = (week: number, currentWeek: number): WeekStatus => {
    console.log(`🔍 Determining status for week ${week}, current week: ${currentWeek}, selected season: ${selectedSeason}`);

    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = selectedSeason < currentYear;

    console.log(`📅 Season analysis: ${selectedSeason} (current year: ${currentYear}, historical: ${isHistoricalSeason})`);

    if (isHistoricalSeason) {
      return {
        week,
        status: 'completed',
        description: `Week ${week} - ${selectedSeason} Season (Historical)`
      };
    }

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

  // Fetch matchup data using enhanced pipeline
  const fetchMatchupData = async () => {
    try {
      console.log('🚀 Starting enhanced cross-conference matchup pipeline...');
      console.log(`📊 Selected week: ${selectedWeek}`);
      console.log(`📅 Current week: ${currentWeek}`);
      console.log(`🔄 Enhanced pipeline enabled: ${useEnhancedPipeline}`);

      setApiErrors([]);
      const errors: string[] = [];

      // Determine and set week status
      const status = determineWeekStatus(selectedWeek, currentWeek);
      setWeekStatus(status);
      console.log('📋 Week status:', status);

      let enhancedMatchups: EnhancedMatchupDisplay[] = [];

      if (useEnhancedPipeline) {
        // Use enhanced pipeline for database-driven matchups
        console.log('🎯 Using enhanced database-driven matchup pipeline...');
        
        const conferenceIds = selectedConference ? [selectedConference] : undefined;
        const enhancedResults = await enhancedMatchupService.getEnhancedMatchupsForWeek(
          selectedWeek,
          conferenceIds
        );

        // Convert to display format
        enhancedMatchups = enhancedResults.map((result) => ({
          matchupId: result.matchupId,
          week: result.week,
          status: result.status,
          isInterConference: result.isInterConference,
          isManualOverride: result.isManualOverride,
          team1: {
            teamName: result.team1.teamInfo.teamName,
            ownerName: result.team1.teamInfo.ownerName,
            conferenceId: result.team1.teamInfo.conferenceId,
            conferenceName: result.team1.teamInfo.conferenceName,
            totalPoints: result.team1.lineup.totalPoints,
            starters: result.team1.lineup.starters.map(s => ({
              position: s.position,
              playerName: s.playerName,
              points: s.points
            }))
          },
          team2: {
            teamName: result.team2.teamInfo.teamName,
            ownerName: result.team2.teamInfo.ownerName,
            conferenceId: result.team2.teamInfo.conferenceId,
            conferenceName: result.team2.teamInfo.conferenceName,
            totalPoints: result.team2.lineup.totalPoints,
            starters: result.team2.lineup.starters.map(s => ({
              position: s.position,
              playerName: s.playerName,
              points: s.points
            }))
          },
          winner: result.winner,
          dataQuality: {
            overallScore: result.dataQuality.overallScore,
            issues: result.dataQuality.issues,
            warnings: result.dataQuality.warnings
          },
          conference: {
            id: result.team1.teamInfo.conferenceId,
            conference_name: result.team1.teamInfo.conferenceName
          },
          dataSource: 'enhanced_database'
        }));

        console.log(`✅ Enhanced pipeline loaded ${enhancedMatchups.length} matchups`);

      } else {
        // Fallback to original pipeline
        console.log('🔄 Using fallback matchup pipeline...');
        
        const processedMatchups = await matchupDataPipeline.getMatchupsForWeek(selectedWeek);

        // Convert to enhanced display format
        enhancedMatchups = processedMatchups.map((matchup) => ({
          matchupId: matchup.matchupId,
          week: selectedWeek,
          status: matchup.status as 'upcoming' | 'live' | 'completed',
          isInterConference: matchup.team1.teamInfo.conferenceId !== matchup.team2.teamInfo.conferenceId,
          isManualOverride: false,
          team1: {
            teamName: matchup.team1.teamInfo.teamName,
            ownerName: matchup.team1.teamInfo.ownerName,
            conferenceId: matchup.team1.teamInfo.conferenceId,
            conferenceName: matchup.team1.teamInfo.conferenceName,
            totalPoints: matchup.team1.totalPoints,
            starters: matchup.team1.starters.map(s => ({
              position: s.position || 'N/A',
              playerName: s.playerName,
              points: s.points
            }))
          },
          team2: {
            teamName: matchup.team2.teamInfo.teamName,
            ownerName: matchup.team2.teamInfo.ownerName,
            conferenceId: matchup.team2.teamInfo.conferenceId,
            conferenceName: matchup.team2.teamInfo.conferenceName,
            totalPoints: matchup.team2.totalPoints,
            starters: matchup.team2.starters.map(s => ({
              position: s.position || 'N/A',
              playerName: s.playerName,
              points: s.points
            }))
          },
          winner: matchup.winner as 'team1' | 'team2' | null,
          dataQuality: {
            overallScore: 85, // Default score for fallback pipeline
            issues: [],
            warnings: []
          },
          conference: {
            id: matchup.team1.teamInfo.conferenceId,
            conference_name: matchup.team1.teamInfo.conferenceName
          },
          dataSource: 'fallback_hybrid'
        }));
      }

      // Calculate data source statistics
      const sourceStats = {
        database: enhancedMatchups.filter(m => m.dataSource === 'enhanced_database').length,
        sleeper: enhancedMatchups.filter(m => m.dataSource === 'fallback_hybrid').length,
        hybrid: enhancedMatchups.length
      };

      setDataSourceStats(sourceStats);
      setMatchups(enhancedMatchups);

      // Set debug data
      const debugData = {
        totalMatchups: enhancedMatchups.length,
        errors: [],
        weekStatus: status,
        dataSourceStats: sourceStats,
        interConferenceCount: enhancedMatchups.filter(m => m.isInterConference).length,
        manualOverrideCount: enhancedMatchups.filter(m => m.isManualOverride).length,
        pipelineUsed: useEnhancedPipeline ? 'enhanced_database' : 'fallback_hybrid',
        processedMatchups: enhancedMatchups.map((m) => ({
          id: m.matchupId,
          conference: m.conference?.conference_name,
          teams: [m.team1.teamName, m.team2.teamName],
          dataSource: m.dataSource,
          isManualOverride: m.isManualOverride,
          isInterConference: m.isInterConference,
          team1Points: m.team1.totalPoints,
          team2Points: m.team2.totalPoints,
          dataQuality: m.dataQuality.overallScore
        }))
      };

      setRawApiData(debugData);

      console.log(`✅ Successfully loaded ${enhancedMatchups.length} matchups`);
      console.log(`🌐 Inter-conference matchups: ${enhancedMatchups.filter(m => m.isInterConference).length}`);
      console.log(`🔧 Manual overrides: ${enhancedMatchups.filter(m => m.isManualOverride).length}`);
      console.log('📊 Data source stats:', sourceStats);

    } catch (error) {
      const errorMsg = `Failed to fetch matchup data: ${error}`;
      console.error('❌ Error fetching matchup data:', error);
      setApiErrors((prev) => [...prev, errorMsg]);

      toast({
        title: 'Data Error',
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
      case 'complete':
        return <Badge variant="secondary">Final</Badge>;
      case 'upcoming':
      case 'pending':
        return <Badge variant="outline">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlayerName = (playerId: string): string => {
    // Simple fallback for player names
    return `Player ${playerId}`;
  };

  const getWinningTeam = (matchup: EnhancedMatchupDisplay) => {
    if (matchup.status !== 'completed') return null;
    return matchup.winner;
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
            'All Conferences'
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
            variant={useEnhancedPipeline ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setUseEnhancedPipeline(!useEnhancedPipeline);
              loadData(true);
            }}>
            <Database className="h-4 w-4" />
            {useEnhancedPipeline ? 'Enhanced' : 'Fallback'}
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

      {/* Enhanced Data Source Summary */}
      {(dataSourceStats.database > 0 || dataSourceStats.hybrid > 0) &&
      <Card className="border-l-4 border-l-green-500">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium">
                    {useEnhancedPipeline ? 'Enhanced Cross-Conference Pipeline' : 'Legacy Matchup Pipeline'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {useEnhancedPipeline 
                      ? 'Database matchup assignments + Cross-conference Sleeper API support'
                      : 'Sleeper API only with basic processing'
                    }
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                {dataSourceStats.database > 0 &&
              <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>{dataSourceStats.database} Database</span>
                  </div>
              }
                {dataSourceStats.sleeper > 0 &&
              <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>{dataSourceStats.sleeper} Sleeper</span>
                  </div>
              }
                {rawApiData?.interConferenceCount > 0 &&
              <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span>{rawApiData.interConferenceCount} Inter-Conference</span>
                  </div>
              }
                {rawApiData?.manualOverrideCount > 0 &&
              <div className="flex items-center space-x-1">
                    <Database className="h-3 w-3 text-orange-500" />
                    <span>{rawApiData.manualOverrideCount} Override{rawApiData.manualOverrideCount !== 1 ? 's' : ''}</span>
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
                <strong>Total Matchups:</strong> {rawApiData.totalMatchups}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Enhanced Pipeline Data</summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto max-h-96">
                  {JSON.stringify({
                    ...rawApiData,
                    pipelineType: useEnhancedPipeline ? 'enhanced_database' : 'fallback_hybrid',
                    enhancedFeatures: useEnhancedPipeline ? [
                      'Cross-conference support',
                      'Database-driven team assignments', 
                      'Position validation',
                      'Data quality metrics'
                    ] : ['Basic Sleeper API processing']
                  }, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      }

      {/* Matchups Grid */}
      <div className="grid gap-4">
        {matchups.map((matchup) => {
          const winningTeam = getWinningTeam(matchup);
          const isInterConference = matchup.isInterConference;

          return (
            <Card key={`${matchup.matchupId}`}
            className={`hover:shadow-md transition-shadow ${
            isInterConference ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 via-white to-blue-50' : ''}`
            }>
              <Collapsible>
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(`${matchup.matchupId}`)}>

                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg">
                            {isInterConference ? 'Inter-Conference Matchup' : matchup.conference?.conference_name}
                          </CardTitle>
                          {isInterConference &&
                          <Badge className="text-xs bg-purple-600 hover:bg-purple-700 text-white">
                              <span className="animate-pulse">⚔️</span>
                              <span className="ml-1">Week {selectedWeek}</span>
                            </Badge>
                          }
                        </div>
                        
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
                      expandedMatchups.has(`${matchup.matchupId}`) ? 'rotate-180' : ''}`
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
                          {matchup.team1.teamName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {matchup.team1.ownerName}
                        </div>
                        {isInterConference &&
                        <div className="flex justify-end">
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              🏠 {matchup.team1.conferenceName}
                            </Badge>
                          </div>
                        }
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam === 'team1' ? 'text-green-600' : ''}`}>
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : matchup.team1.totalPoints.toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1">
                            Raw: {matchup.team1.totalPoints}
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
                          {matchup.team2.teamName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {matchup.team2.ownerName}
                        </div>
                        {isInterConference &&
                        <div className="flex justify-start">
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              🏠 {matchup.team2.conferenceName}
                            </Badge>
                          </div>
                        }
                      </div>
                      <div className={`text-2xl font-bold ${winningTeam === 'team2' ? 'text-green-600' : ''}`}>
                        {matchup.status === 'upcoming' && selectedSeason >= new Date().getFullYear() ? '--' : matchup.team2.totalPoints.toFixed(1)}
                        {debugMode &&
                        <div className="text-xs text-muted-foreground mt-1">
                            Raw: {matchup.team2.totalPoints}
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
                      {/* Team Starting Lineups */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Team 1 Lineup */}
                        <div className="p-4 border rounded-lg">
                          <div className="font-medium mb-2">{matchup.team1.teamName} Lineup</div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Starting Positions (QB, RB, RB, WR, WR, WR, TE, WRT, WRTQ):</div>
                            {matchup.team1.starters.map((starter, index) =>
                            <div key={index} className="flex justify-between items-center text-sm">
                                <div className="flex items-center space-x-2">
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs min-w-[45px] text-center"
                                  >
                                    {starter.position}
                                  </Badge>
                                  <span>{starter.playerName}</span>
                                </div>
                                <span className="font-medium">{starter.points.toFixed(1)}</span>
                              </div>
                            )}
                            <div className="pt-2 border-t text-sm font-medium">
                              Total: {matchup.team1.totalPoints.toFixed(1)} pts
                            </div>
                          </div>
                        </div>

                        {/* Team 2 Lineup */}
                        <div className="p-4 border rounded-lg">
                          <div className="font-medium mb-2">{matchup.team2.teamName} Lineup</div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Starting Positions (QB, RB, RB, WR, WR, WR, TE, WRT, WRTQ):</div>
                            {matchup.team2.starters.map((starter, index) =>
                            <div key={index} className="flex justify-between items-center text-sm">
                                <div className="flex items-center space-x-2">
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs min-w-[45px] text-center"
                                  >
                                    {starter.position}
                                  </Badge>
                                  <span>{starter.playerName}</span>
                                </div>
                                <span className="font-medium">{starter.points.toFixed(1)}</span>
                              </div>
                            )}
                            <div className="pt-2 border-t text-sm font-medium">
                              Total: {matchup.team2.totalPoints.toFixed(1)} pts
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Matchup Stats */}
                      {matchup.status !== 'upcoming' &&
                      <div className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">Total Points</div>
                              <div className="font-semibold">
                                {(matchup.team1.totalPoints + matchup.team2.totalPoints).toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Point Spread</div>
                              <div className="font-semibold">
                                {Math.abs(matchup.team1.totalPoints - matchup.team2.totalPoints).toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">High Score</div>
                              <div className="font-semibold">
                                {Math.max(matchup.team1.totalPoints, matchup.team2.totalPoints).toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Data Quality</div>
                              <div className={`text-xs font-medium ${
                                matchup.dataQuality.overallScore >= 90 ? 'text-green-600' :
                                matchup.dataQuality.overallScore >= 70 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {matchup.dataQuality.overallScore}%
                              </div>
                            </div>
                          </div>
                          
                          {/* Data Quality Details */}
                          {(matchup.dataQuality.issues.length > 0 || matchup.dataQuality.warnings.length > 0) &&
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="text-xs font-medium text-yellow-800 mb-1">Data Quality Notes:</div>
                              {matchup.dataQuality.issues.map((issue, index) =>
                            <div key={index} className="text-xs text-red-600 mb-1">• {issue}</div>
                            )}
                              {matchup.dataQuality.warnings.map((warning, index) =>
                            <div key={index} className="text-xs text-yellow-600 mb-1">• {warning}</div>
                            )}
                            </div>
                          }
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
              <p className="text-sm text-muted-foreground mt-2">
                Make sure matchups are configured in the database.
              </p>
            </CardContent>
          </Card>
        }
      </div>
    </div>);

};

export default MatchupsPage;