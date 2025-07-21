import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, ChevronUp, Clock, Trophy, Users, RefreshCw, AlertCircle, Bug, CheckCircle, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperPlayer } from '@/services/sleeperApi';
import { DatabaseService } from '@/services/databaseService';
import SupabaseMatchupService, { OrganizedMatchup } from '@/services/supabaseMatchupService';

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

type WeekStatus = {
  week: number;
  status: 'future' | 'current' | 'live' | 'completed';
  description: string;
};

// Helper function to get lineup positions (standard order)
const getLineupPositions = (): string[] => {
  return ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'];
};

// Helper function to format position names for display
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

// Helper function to get player info
const getPlayerInfo = (playerId: string, allPlayers: Record<string, SleeperPlayer>) => {
  const player = allPlayers[playerId];
  if (!player) return { name: 'Unknown Player', position: 'N/A', team: 'N/A' };
  
  return {
    name: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown',
    position: player.position || 'N/A',
    team: player.team || 'N/A'
  };
};

const MatchupsPage: React.FC = () => {
  console.log('🚀 MatchupsPage component mounting...');
  
  const { selectedSeason, selectedConference, currentSeasonConfig, seasonConfigs } = useApp();
  const { toast } = useToast();

  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());
  const [matchups, setMatchups] = useState<OrganizedMatchup[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  // Load matchup data
  const fetchMatchups = async () => {
    if (!selectedSeason || !currentSeasonConfig || refreshing) {
      console.log('⚠️ Skipping matchup fetch - missing data or already refreshing');
      setLoading(false);
      return;
    }

    setRefreshing(true);
    setApiErrors([]);

    try {
      console.log(`🎯 Fetching matchups for season ${selectedSeason}, week ${selectedWeek}, conference: ${selectedConference || 'all'}`);

      // Determine season ID and conference ID
      const seasonConfig = seasonConfigs.find(s => s.year === selectedSeason);
      if (!seasonConfig) {
        throw new Error(`Season ${selectedSeason} not found`);
      }

      const seasonId = typeof seasonConfig.seasonId === 'string' ? parseInt(seasonConfig.seasonId) : (seasonConfig.seasonId || selectedSeason);
      
      let conferenceId: number | undefined;
      if (selectedConference) {
        const targetConf = seasonConfig.conferences.find(c => c.id === selectedConference);
        conferenceId = targetConf?.dbConferenceId; // Use the actual database conference ID
        console.log(`🎯 Conference filter: ${selectedConference} -> DB conferenceId: ${conferenceId}`);
      }

      // Use the new hybrid matchup service
      const organizedMatchups = await SupabaseMatchupService.getHybridMatchups(
        seasonId,
        selectedWeek,
        conferenceId
      );

      console.log(`✅ Loaded ${organizedMatchups.length} matchups`);
      console.log('Conference filter applied:', { 
        selectedConference, 
        conferenceId, 
        matchupConferences: organizedMatchups.map(m => m.conference.conference_name) 
      });
      setMatchups(organizedMatchups);

      // Load additional players data if needed
      if (Object.keys(allPlayers).length === 0) {
        try {
          // Use the robust player fetching method that gets ALL players
          const allPlayersArray = await DatabaseService.getAllPlayersForMapping([
            { column: 'playing_status', operator: 'eq', value: 'Active' },
            { column: 'position', operator: 'in', value: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] }
          ]);
          
          // Convert to Sleeper format for compatibility
          const playersRecord: Record<string, SleeperPlayer> = {};
          allPlayersArray.forEach(player => {
            if (player.sleeper_id) {
              const nameParts = player.player_name.split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              
              playersRecord[player.sleeper_id] = {
                player_id: player.sleeper_id,
                first_name: firstName,
                last_name: lastName,
                position: player.position || '',
                team: player.nfl_team || '',
                jersey_number: player.number || 0,
                status: player.playing_status || '',
                injury_status: player.injury_status || '',
                age: player.age || 0,
                height: player.height?.toString() || '',
                weight: player.weight || 0,
                years_exp: 0,
                college: player.college || ''
              };
            }
          });
          
          setAllPlayers(playersRecord);
        } catch (error) {
          console.warn('Could not load players data:', error);
        }
      }

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
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Load current NFL week
  const loadCurrentWeek = async () => {
    try {
      console.log('🔄 Loading current NFL week...');
      const week = await SleeperApiService.getCurrentNFLWeek();
      console.log(`✅ Current NFL week: ${week}`);
      setCurrentWeek(week);
      setSelectedWeek(week);
    } catch (error) {
      console.error('Error getting current week:', error);
      // Fallback to week 1 if API fails
      setCurrentWeek(1);
      setSelectedWeek(1);
    }
  };

  // Get current NFL week on mount
  useEffect(() => {
    loadCurrentWeek();
  }, []);

  // Load data when component mounts or dependencies change
  useEffect(() => {
    if (selectedSeason && currentSeasonConfig) {
      setLoading(true);
      fetchMatchups();
    } else {
      setLoading(false);
    }
  }, [selectedWeek, selectedConference, selectedSeason, currentSeasonConfig]);

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

  const getWinningTeam = (matchup: OrganizedMatchup) => {
    if (matchup.status !== 'completed') return null;
    const [team1, team2] = matchup.teams;
    if (!team2) return team1; // Single team scenario
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
            onClick={() => fetchMatchups()}
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
        {[...matchups]
          .sort((a, b) => a.conference.conference_name.localeCompare(b.conference.conference_name))
          .map((matchup) => {
          const [team1, team2] = matchup.teams;
          const winningTeam = getWinningTeam(matchup);
          const matchupKey = `${matchup.conference.id}-${matchup.matchup_id}`;
          const isExpanded = expandedMatchups.has(matchupKey);

          return (
            <Card key={matchupKey} className="hover:shadow-md transition-shadow">
              {/* Compact Header */}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base">
                      {matchup.conference.conference_name}
                    </CardTitle>
                    {getStatusBadge(matchup.status)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMatchupExpansion(matchupKey)}
                    className="h-8 w-8 p-0"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Compact Matchup Summary */}
                <div className="grid grid-cols-3 gap-2 items-center">
                  {/* Team 1 */}
                  <div className="text-right space-y-1">
                    <div className="font-medium text-sm">
                      {team1.team?.team_name || team1.owner?.display_name || team1.owner?.username || 'Unknown Team'}
                    </div>
                    <div className={`text-lg font-bold ${winningTeam?.roster_id === team1.roster_id ? 'text-green-600' : ''}`}>
                      {matchup.status === 'upcoming' ? '--' : (team1.points ?? 0).toFixed(1)}
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
                      {team2?.team?.team_name || team2?.owner?.display_name || team2?.owner?.username || 'TBD'}
                    </div>
                    <div className={`text-lg font-bold ${winningTeam?.roster_id === team2?.roster_id ? 'text-green-600' : ''}`}>
                      {matchup.status === 'upcoming' ? '--' : (team2?.points ?? 0).toFixed(1)}
                    </div>
                  </div>
                </div>

                {/* Expandable Roster Details */}
                <Collapsible open={isExpanded}>
                  <CollapsibleContent className="space-y-4">
                    <div className="border-t pt-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Team 1 Roster */}
                        <div>
                          <h4 className="font-semibold text-sm mb-3 flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            {team1.team?.team_name || team1.owner?.display_name || 'Team 1'} Lineup
                          </h4>
                          {team1.roster ? (
                            <div className="space-y-3">
                              {/* Starters */}
                              <div>
                                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Starters</h5>
                                <div className="space-y-1">
                                  {team1.matchup_starters?.map((playerId, index) => {
                                    const playerInfo = getPlayerInfo(playerId, allPlayers);
                                    const points = team1.players_points?.[playerId] || 0;
                                    const lineupPositions = getLineupPositions();
                                    const position = lineupPositions[index] || 'FLEX';
                                    
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
                              {team1.roster.players && (
                                <div>
                                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bench</h5>
                                  <div className="space-y-1">
                                    {team1.roster.players
                                      .filter(playerId => !team1.matchup_starters?.includes(playerId))
                                      .map((playerId) => {
                                        const playerInfo = getPlayerInfo(playerId, allPlayers);
                                        const points = team1.players_points?.[playerId] || 0;
                                        
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
                          ) : (
                            <p className="text-sm text-muted-foreground">No roster data available</p>
                          )}
                        </div>

                        {/* Team 2 Roster */}
                        {team2 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-3 flex items-center">
                              <Users className="h-4 w-4 mr-2" />
                              {team2.team?.team_name || team2.owner?.display_name || 'Team 2'} Lineup
                            </h4>
                            {team2.roster ? (
                              <div className="space-y-3">
                                {/* Starters */}
                                <div>
                                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Starters</h5>
                                  <div className="space-y-1">
                                    {team2.matchup_starters?.map((playerId, index) => {
                                      const playerInfo = getPlayerInfo(playerId, allPlayers);
                                      const points = team2.players_points?.[playerId] || 0;
                                      const lineupPositions = getLineupPositions();
                                      const position = lineupPositions[index] || 'FLEX';
                                      
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
                                {team2.roster.players && (
                                  <div>
                                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bench</h5>
                                    <div className="space-y-1">
                                      {team2.roster.players
                                        .filter(playerId => !team2.matchup_starters?.includes(playerId))
                                        .map((playerId) => {
                                          const playerInfo = getPlayerInfo(playerId, allPlayers);
                                          const points = team2.players_points?.[playerId] || 0;
                                          
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
                            ) : (
                              <p className="text-sm text-muted-foreground">No roster data available</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}

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

export default MatchupsPage;