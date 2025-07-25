import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, ChevronUp, Clock, Trophy, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperPlayer } from '@/services/sleeperApi';
import OptimizedMatchupService, { MinimalMatchup, DetailedMatchupData } from '@/services/optimizedMatchupService';

// Memoized matchup card component for better performance
const MatchupCard = React.memo<{
  matchup: MinimalMatchup;
  isExpanded: boolean;
  onToggleExpand: (matchupId: number) => void;
  detailedData?: DetailedMatchupData | null;
  allPlayers: Record<string, SleeperPlayer>;
  loading?: boolean;
}>(({ matchup, isExpanded, onToggleExpand, detailedData, allPlayers, loading }) => {
  const [team1, team2] = matchup.teams;
  const winningTeam = matchup.status === 'completed' 
    ? (team1.points > (team2?.points || 0) ? team1 : team2)
    : null;

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

  const formatPosition = (position: string): string => {
    const positions: Record<string, string> = {
      'QB': 'QB',
      'RB': 'RB',
      'WR': 'WR',
      'TE': 'TE',
      'FLEX': 'W/R/T',
      'SUPER_FLEX': 'Q/W/R/T',
      'K': 'K',
      'DEF': 'DEF'
    };
    return positions[position] || position;
  };

  const getPlayerInfo = (playerId: string) => {
    const player = allPlayers[playerId];
    if (!player) return { name: 'Unknown Player', position: 'N/A', team: 'N/A' };

    return {
      name: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown',
      position: player.position || 'N/A',
      team: player.team || 'N/A'
    };
  };

  const renderTeamRoster = (teamId: string, teamName: string) => {
    if (!detailedData) return <div className="text-sm text-muted-foreground">Loading roster...</div>;

    const starters = detailedData.starters[teamId] || [];
    const playersPoints = detailedData.players_points[teamId] || {};
    const benchPlayers = detailedData.bench_players[teamId] || [];

    return (
      <div className="space-y-3">
        {/* Starters */}
        <div>
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Starters</h5>
          <div className="space-y-1">
            {starters.map((playerId, index) => {
              const playerInfo = getPlayerInfo(playerId);
              const points = playersPoints[playerId] || 0;
              const position = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'][index] || 'FLEX';

              return (
                <div key={`${playerId}-${index}`} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {formatPosition(position)}
                    </Badge>
                    <span className="font-medium">{playerInfo.name}</span>
                    <span className="text-muted-foreground">({playerInfo.position} - {playerInfo.team})</span>
                  </div>
                  <span className="font-bold">{points.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        {benchPlayers.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bench</h5>
            <div className="space-y-1">
              {benchPlayers.map((playerId) => {
                const playerInfo = getPlayerInfo(playerId);
                const points = playersPoints[playerId] || 0;

                return (
                  <div key={playerId} className="flex justify-between items-center py-1 px-2 bg-gray-25 rounded text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{playerInfo.name}</span>
                      <span className="text-muted-foreground">({playerInfo.position} - {playerInfo.team})</span>
                    </div>
                    <span className="text-muted-foreground">{points.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-base">
            {matchup.playoff_round_name || matchup.conference.name}
          </CardTitle>
          {getStatusBadge(matchup.status)}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Compact Matchup Summary */}
        <div className="grid grid-cols-3 gap-2 items-center">
          {/* Team 1 */}
          <div className="text-right space-y-1">
            <div className="font-medium text-sm">{team1.name}</div>
            <div className={`text-lg font-bold ${winningTeam?.id === team1.id ? 'text-green-600' : ''}`}>
              {matchup.status === 'upcoming' ? '--' : team1.points.toFixed(1)}
            </div>
          </div>

          {/* VS Divider */}
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">VS</div>
            {matchup.status === 'completed' && winningTeam && (
              <Trophy className="h-4 w-4 mx-auto mt-1 text-yellow-500" />
            )}
          </div>

          {/* Team 2 */}
          <div className="text-left space-y-1">
            <div className="font-medium text-sm">
              {matchup.is_bye || !team2 ? 'BYE' : team2.name}
            </div>
            <div className={`text-lg font-bold ${winningTeam?.id === team2?.id ? 'text-green-600' : ''}`}>
              {matchup.is_bye || !team2 
                ? 'BYE' 
                : matchup.status === 'upcoming' ? '--' : team2.points.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Expandable Roster Details */}
        {!matchup.is_bye && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent className="space-y-4">
              <div className="border-t pt-4">
                {loading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">Loading roster details...</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Team 1 Roster */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        {team1.name} Lineup
                      </h4>
                      {renderTeamRoster(team1.id.toString(), team1.name)}
                    </div>

                    {/* Team 2 Roster */}
                    {team2 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-3 flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          {team2.name} Lineup
                        </h4>
                        {renderTeamRoster(team2.id.toString(), team2.name)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>

            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => onToggleExpand(matchup.id)}
              >
                {isExpanded ? (
                  <>
                    Hide Details
                    <ChevronUp className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    View Details
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
});

MatchupCard.displayName = 'MatchupCard';

const OptimizedMatchupsPage: React.FC = () => {
  console.log('🚀 OptimizedMatchupsPage component mounting...');

  const { selectedSeason, selectedConference, currentSeasonConfig, seasonConfigs } = useApp();
  const { toast } = useToast();

  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<number>>(new Set());
  const [matchups, setMatchups] = useState<MinimalMatchup[]>([]);
  const [matchupDetails, setMatchupDetails] = useState<Map<number, DetailedMatchupData>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Memoized season configuration
  const seasonConfig = useMemo(() => 
    seasonConfigs.find(s => s.year === selectedSeason),
    [seasonConfigs, selectedSeason]
  );

  // Load current NFL week
  const loadCurrentWeek = useCallback(async () => {
    try {
      console.log('🔄 Loading current NFL week...');
      const week = await SleeperApiService.getCurrentNFLWeek();
      console.log(`✅ Current NFL week: ${week}`);
      setCurrentWeek(week);
      setSelectedWeek(week);
    } catch (error) {
      console.error('Error getting current week:', error);
      setCurrentWeek(1);
      setSelectedWeek(1);
    }
  }, []);

  // Load player data with caching
  const loadPlayerData = useCallback(async () => {
    try {
      console.log('🔄 Loading player data...');
      const startTime = performance.now();
      
      // Use the optimized service's cached player loading
      const players = await OptimizedMatchupService['MatchupDataCache']?.getPlayers() || {};
      
      console.log(`✅ Player data loaded in ${(performance.now() - startTime).toFixed(2)}ms`);
      setAllPlayers(players);
    } catch (error) {
      console.error('Error loading player data:', error);
      // Fallback to empty object
      setAllPlayers({});
    }
  }, []);

  // Load minimal matchup data
  const fetchMatchups = useCallback(async () => {
    if (!selectedSeason || !seasonConfig || refreshing) {
      console.log('⚠️ Skipping matchup fetch - missing data or already refreshing');
      setLoading(false);
      return;
    }

    setRefreshing(true);

    try {
      console.log(`🎯 Fetching optimized matchups for season ${selectedSeason}, week ${selectedWeek}`);
      const startTime = performance.now();

      // Determine season ID and conference ID
      const seasonId = typeof seasonConfig.seasonId === 'string' 
        ? parseInt(seasonConfig.seasonId) 
        : (seasonConfig.seasonId || selectedSeason);

      let conferenceId: number | undefined;
      if (selectedConference) {
        const targetConf = seasonConfig.conferences.find(c => c.id === selectedConference);
        conferenceId = targetConf?.dbConferenceId;
        console.log(`🎯 Conference filter: ${selectedConference} -> DB conferenceId: ${conferenceId}`);
      }

      // Use optimized service for fast initial load
      const minimalMatchups = await OptimizedMatchupService.getMinimalMatchups(
        seasonId,
        selectedWeek,
        conferenceId
      );

      console.log(`✅ Loaded ${minimalMatchups.length} minimal matchups in ${(performance.now() - startTime).toFixed(2)}ms`);
      setMatchups(minimalMatchups);

      // Clear previous details when matchups change
      setMatchupDetails(new Map());
      setExpandedMatchups(new Set());

    } catch (error) {
      console.error('Error fetching matchups:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      toast({
        title: 'Error Loading Matchups',
        description: `Failed to load matchup data: ${errorMessage}`,
        variant: 'destructive'
      });

      setMatchups([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedWeek, selectedConference, selectedSeason, seasonConfig, refreshing, toast]);

  // Load detailed matchup data on-demand
  const loadMatchupDetails = useCallback(async (matchupId: number) => {
    if (!selectedSeason || !seasonConfig || matchupDetails.has(matchupId)) {
      return; // Already loaded or missing data
    }

    setLoadingDetails(prev => new Set(prev).add(matchupId));

    try {
      console.log(`🔍 Loading details for matchup ${matchupId}...`);
      const startTime = performance.now();

      const seasonId = typeof seasonConfig.seasonId === 'string' 
        ? parseInt(seasonConfig.seasonId) 
        : (seasonConfig.seasonId || selectedSeason);

      const details = await OptimizedMatchupService.getMatchupDetails(
        matchupId,
        seasonId,
        selectedWeek
      );

      if (details) {
        setMatchupDetails(prev => new Map(prev).set(matchupId, details));
        console.log(`✅ Matchup ${matchupId} details loaded in ${(performance.now() - startTime).toFixed(2)}ms`);
      }

    } catch (error) {
      console.error(`Error loading details for matchup ${matchupId}:`, error);
    } finally {
      setLoadingDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchupId);
        return newSet;
      });
    }
  }, [selectedSeason, seasonConfig, selectedWeek, matchupDetails]);

  // Toggle matchup expansion with lazy loading
  const toggleMatchupExpansion = useCallback((matchupId: number) => {
    const newExpanded = new Set(expandedMatchups);
    
    if (newExpanded.has(matchupId)) {
      newExpanded.delete(matchupId);
    } else {
      newExpanded.add(matchupId);
      // Load details when expanding
      loadMatchupDetails(matchupId);
    }
    
    setExpandedMatchups(newExpanded);
  }, [expandedMatchups, loadMatchupDetails]);

  // Initialize data on mount
  useEffect(() => {
    loadCurrentWeek();
    loadPlayerData();
  }, [loadCurrentWeek, loadPlayerData]);

  // Load matchups when dependencies change
  useEffect(() => {
    if (selectedSeason && seasonConfig) {
      setLoading(true);
      fetchMatchups();
    } else {
      setLoading(false);
    }
  }, [selectedWeek, selectedConference, selectedSeason, seasonConfig, fetchMatchups]);

  // Memoized sorted matchups for better performance
  const sortedMatchups = useMemo(() => 
    [...matchups].sort((a, b) => a.conference.name.localeCompare(b.conference.name)),
    [matchups]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups (Optimized)</h1>
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
          <h1 className="text-3xl font-bold">Matchups (Optimized)</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {selectedWeek} • {
            selectedConference ?
              seasonConfig?.conferences.find((c) => c.id === selectedConference)?.name || 'Selected Conference' :
              'All Conferences'
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
              {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week}</span>
                    {week === currentWeek && <Badge variant="outline" className="text-xs">Current</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedWeek === currentWeek && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Current week</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              OptimizedMatchupService.clearCache();
              fetchMatchups();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Performance Stats (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-2">
            <div className="text-xs text-muted-foreground">
              Cache Stats: {JSON.stringify(OptimizedMatchupService.getCacheStats())}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matchups Grid */}
      <div className="grid gap-3">
        {sortedMatchups.map((matchup) => (
          <MatchupCard
            key={matchup.id}
            matchup={matchup}
            isExpanded={expandedMatchups.has(matchup.id)}
            onToggleExpand={toggleMatchupExpansion}
            detailedData={matchupDetails.get(matchup.id)}
            allPlayers={allPlayers}
            loading={loadingDetails.has(matchup.id)}
          />
        ))}

        {matchups.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No matchups found for the selected filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OptimizedMatchupsPage;