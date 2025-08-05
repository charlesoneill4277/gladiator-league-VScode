import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, ChevronUp, Clock, Trophy, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperPlayer } from '@/services/sleeperApi';
import SupabaseMatchupService, { OrganizedMatchup } from '@/services/supabaseMatchupService';
import MatchupCache from '@/services/matchupCache';
// Removed unused debug component imports
import { ConferenceBadge } from '@/components/ui/conference-badge';

// Minimal matchup interface for fast initial loading
interface MinimalMatchup {
  id: number;
  matchup_id: number;
  conference: { id: number; name: string };
  teams: { id: number; name: string; owner: string; points: number; roster_id: number; conference?: { id: number; name: string }; avatar?: string; team_logourl?: string }[];
  status: 'live' | 'completed' | 'upcoming';
  week: number;
  is_playoff: boolean;
  is_bye?: boolean;
  playoff_round_name?: string;
  manual_override?: boolean;
}

// Detailed matchup data loaded on-demand
interface DetailedMatchupData {
  players_points: Record<string, Record<string, number>>;
  starters: Record<string, string[]>;
  bench_players: Record<string, string[]>;
  rosters: Record<string, any>;
  users: Record<string, any>;
}

// Position color function to match TeamDetailPage styling
const getPositionColor = (position: string) => {
  switch (position) {
    case 'QB': return 'bg-red-100 text-red-800';
    case 'RB': return 'bg-green-100 text-green-800';
    case 'WR': return 'bg-blue-100 text-blue-800';
    case 'TE': return 'bg-yellow-100 text-yellow-800';
    case 'K': return 'bg-purple-100 text-purple-800';
    case 'DEF': return 'bg-gray-100 text-gray-800';
    case 'FLEX': return 'bg-orange-100 text-orange-800';
    case 'SUPER_FLEX': return 'bg-pink-100 text-pink-800';
    case 'SFLEX': return 'bg-pink-100 text-pink-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};



// Memoized matchup card component for better performance
const MatchupCard = React.memo<{
  matchup: MinimalMatchup;
  isExpanded: boolean;
  onToggleExpand: (matchupId: number) => void;
  detailedData?: DetailedMatchupData | null;
  allPlayers: Record<string, SleeperPlayer>;
  loading?: boolean;
  onViewDetails: (matchupId: number) => void;
}>(({ matchup, isExpanded, onToggleExpand, detailedData, allPlayers, loading, onViewDetails }) => {
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
                    <Badge className={`text-xs px-1 py-0 ${getPositionColor(position)}`}>
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

  // Check if this is an interconference matchup (manual override in regular season weeks 1-12)
  const isInterconference = matchup.manual_override && matchup.week >= 1 && matchup.week <= 12;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {matchup.playoff_round_name && (
              <CardTitle className="text-base">
                {matchup.playoff_round_name}
              </CardTitle>
            )}
            {isInterconference ? (
              <Badge 
                variant="outline" 
                className="text-xs bg-orange-100 text-orange-800 border-orange-300"
              >
                Interconference
              </Badge>
            ) : (
              <ConferenceBadge conferenceName={matchup.conference.name} size="sm" />
            )}
          </div>
          {getStatusBadge(matchup.status)}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Compact Matchup Summary */}
        <div className="grid grid-cols-5 gap-1 items-center">
          {/* Team 1 Info */}
          <div className="text-right">
            <div className="flex items-center justify-end space-x-2">
              {isInterconference && team1.conference && (
                <ConferenceBadge conferenceName={team1.conference.name} size="sm" />
              )}
              <Avatar className="h-8 w-8">
                <AvatarImage src={team1.team_logourl ? `https://sleepercdn.com/avatars/thumbs/${team1.team_logourl}` : team1.avatar} />
                <AvatarFallback className="text-xs">{team1.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="font-medium text-xs">{team1.name}</div>
                <div className="text-xs text-muted-foreground">{team1.owner}</div>
              </div>
            </div>
          </div>

          {/* Team 1 Score */}
          <div className="text-right">
            <div className={`text-base font-bold ${winningTeam?.id === team1.id ? 'text-green-600' : ''}`}>
              {matchup.status === 'upcoming' ? '--' : team1.points.toFixed(1)}
            </div>
          </div>

          {/* VS Divider */}
          <div className="text-center">
            <div className="text-xs font-medium text-muted-foreground">VS</div>
            {matchup.status === 'completed' && winningTeam && (
              <Trophy className="h-4 w-4 mx-auto mt-1 text-yellow-500" />
            )}
          </div>

          {/* Team 2 Score */}
          <div className="text-left">
            <div className={`text-base font-bold ${winningTeam?.id === team2?.id ? 'text-green-600' : ''}`}>
              {matchup.is_bye || !team2 
                ? 'BYE' 
                : matchup.status === 'upcoming' ? '--' : team2.points.toFixed(1)}
            </div>
          </div>

          {/* Team 2 Info */}
          <div className="text-left">
            {matchup.is_bye || !team2 ? (
              <div className="font-medium text-xs">BYE</div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <div className="font-medium text-xs">{team2.name}</div>
                  <div className="text-xs text-muted-foreground">{team2.owner}</div>
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={team2.team_logourl ? `https://sleepercdn.com/avatars/thumbs/${team2.team_logourl}` : team2.avatar} />
                  <AvatarFallback className="text-xs">{team2.name.charAt(0)}</AvatarFallback>
                </Avatar>
                {isInterconference && team2.conference && (
                  <ConferenceBadge conferenceName={team2.conference.name} size="sm" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expandable Roster Details */}
        {!matchup.is_bye && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent className="space-y-4">
              <div 
                className="border-t pt-4 cursor-pointer hover:bg-gray-50 transition-colors rounded-md p-2 -m-2"
                onClick={() => onToggleExpand(matchup.id)}
                title="Click to close Quick View"
              >
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
                
                {/* Click to close hint */}
                <div className="text-center mt-4 pt-2 border-t border-gray-200">
                  <p className="text-xs text-muted-foreground">Click anywhere to close Quick View</p>
                </div>
              </div>
            </CollapsibleContent>

            <div className="flex gap-2 mt-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onToggleExpand(matchup.id)}
                >
                  {isExpanded ? (
                    <>
                      Hide Details
                      <ChevronUp className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Quick View
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <Button
                variant="default"
                className="flex-1"
                onClick={() => onViewDetails(matchup.id)}
              >
                Full Details
              </Button>
            </div>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
});

MatchupCard.displayName = 'MatchupCard';

const MatchupsPage: React.FC = () => {
  const navigate = useNavigate();
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  
  if (renderCountRef.current % 10 === 0) {
    console.warn(`🚨 MatchupsPage render count: ${renderCountRef.current}`);
  }

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
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  
  // Ref to track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  
  // Ref to track matchup details to avoid dependency issues
  const matchupDetailsRef = useRef<Map<number, DetailedMatchupData>>(new Map());

  // Memoized season configuration
  const seasonConfig = useMemo(() => 
    seasonConfigs.find(s => s.year === selectedSeason),
    [seasonConfigs, selectedSeason]
  );

  // Load player data with caching
  const loadPlayerData = useCallback(async () => {
    try {
      console.log('🔄 Loading player data...');
      const startTime = performance.now();
      
      // Use the cached player loading from MatchupCache
      const players = await MatchupCache.getPlayers();
      
      console.log(`✅ Player data loaded in ${(performance.now() - startTime).toFixed(2)}ms`);
      setAllPlayers(players);
    } catch (error) {
      console.error('Error loading player data:', error);
      setAllPlayers({});
    }
  }, []);

  // Load minimal matchup data for fast initial rendering
  const fetchMatchups = useCallback(async () => {
    if (!selectedSeason || !seasonConfig || refreshing || isFetchingRef.current) {
      console.log('⚠️ Skipping matchup fetch - missing data or already refreshing');
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;
    setRefreshing(true);
    setApiErrors([]);

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

      // Use optimized minimal matchup loading
      const minimalMatchups = await SupabaseMatchupService.getMinimalMatchups(
        seasonId,
        selectedWeek,
        conferenceId
      );

      console.log(`✅ Loaded ${minimalMatchups.length} minimal matchups in ${(performance.now() - startTime).toFixed(2)}ms`);
      setMatchups(minimalMatchups);

      // Clear previous details when matchups change
      setMatchupDetails(new Map());
      matchupDetailsRef.current = new Map();
      setExpandedMatchups(new Set());

    } catch (error) {
      console.error('Error fetching matchups:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setApiErrors([errorMessage]);

      toast({
        title: 'Error Loading Matchups',
        description: `Failed to load matchup data: ${errorMessage}`,
        variant: 'destructive'
      });

      setMatchups([]);
    } finally {
      isFetchingRef.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedWeek, selectedConference, selectedSeason, seasonConfig, toast]);

  // Load detailed matchup data on-demand
  const loadMatchupDetails = useCallback(async (matchupId: number) => {
    if (!selectedSeason || !seasonConfig) {
      return; // Missing data
    }

    setLoadingDetails(prev => new Set(prev).add(matchupId));

    try {
      console.log(`🔍 Loading details for matchup ${matchupId}...`);
      const startTime = performance.now();

      const seasonId = typeof seasonConfig.seasonId === 'string' 
        ? parseInt(seasonConfig.seasonId) 
        : (seasonConfig.seasonId || selectedSeason);

      const details = await SupabaseMatchupService.getMatchupDetails(
        matchupId,
        seasonId,
        selectedWeek
      );

      if (details) {
        setMatchupDetails(prev => {
          const newMap = new Map(prev).set(matchupId, details);
          matchupDetailsRef.current = newMap;
          return newMap;
        });
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
  }, [selectedSeason, seasonConfig, selectedWeek]);

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

  // Toggle matchup expansion with lazy loading
  const toggleMatchupExpansion = useCallback((matchupId: number) => {
    const isCurrentlyExpanded = expandedMatchups.has(matchupId);
    
    if (isCurrentlyExpanded) {
      // Collapsing
      setExpandedMatchups(prev => {
        const newExpanded = new Set(prev);
        newExpanded.delete(matchupId);
        return newExpanded;
      });
    } else {
      // Expanding
      setExpandedMatchups(prev => {
        const newExpanded = new Set(prev);
        newExpanded.add(matchupId);
        return newExpanded;
      });
      
      // Load details if not already loaded (using ref to avoid dependency)
      if (!matchupDetailsRef.current.has(matchupId)) {
        loadMatchupDetails(matchupId);
      }
    }
  }, [expandedMatchups, loadMatchupDetails]);

  // Initialize data on mount
  useEffect(() => {
    loadCurrentWeek();
    loadPlayerData();
  }, []);

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
              MatchupCache.clearAll();
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

      {/* API Errors Display */}
      {apiErrors.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span>API Errors ({apiErrors.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {apiErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              ))}
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
            onViewDetails={(id) => navigate(`/matchups/${id}`)}
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

      {/* Debug components removed to reduce bundle size */}
    </div>
  );
};

export default MatchupsPage;