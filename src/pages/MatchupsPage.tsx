import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Swords, 
  ChevronDown, 
  Clock, 
  Trophy, 
  Users, 
  RefreshCw,
  Wifi,
  WifiOff,
  Star,
  TrendingUp
} from 'lucide-react';
import SleeperApiService, { ProcessedMatchupData } from '@/services/sleeperApi';

interface MatchupData {
  id: number;
  week: number;
  conference_id: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
}

interface TeamData {
  id: number;
  team_name: string;
  owner_name: string;
}

interface ConferenceData {
  id: number;
  conference_name: string;
  league_id: string;
}

interface TeamConferenceJunction {
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
}

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  
  // State management
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());
  const [matchupsData, setMatchupsData] = useState<ProcessedMatchupData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Database data
  const [dbMatchups, setDbMatchups] = useState<MatchupData[]>([]);
  const [dbTeams, setDbTeams] = useState<TeamData[]>([]);
  const [dbConferences, setDbConferences] = useState<ConferenceData[]>([]);
  const [dbJunctions, setDbJunctions] = useState<TeamConferenceJunction[]>([]);

  // Fetch database data
  const fetchDatabaseData = async () => {
    try {
      // Fetch matchups
      const matchupsResponse = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'week',
        IsAsc: true,
        Filters: selectedConference ? [
          { name: 'conference_id', op: 'Equal', value: selectedConference }
        ] : []
      });

      if (matchupsResponse.error) throw matchupsResponse.error;
      setDbMatchups(matchupsResponse.data.List);

      // Fetch teams
      const teamsResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (teamsResponse.error) throw teamsResponse.error;
      setDbTeams(teamsResponse.data.List);

      // Fetch conferences
      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: []
      });

      if (conferencesResponse.error) throw conferencesResponse.error;
      setDbConferences(conferencesResponse.data.List);

      // Fetch team-conference junctions
      const junctionsResponse = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_id',
        IsAsc: true,
        Filters: selectedConference ? [
          { name: 'conference_id', op: 'Equal', value: selectedConference }
        ] : []
      });

      if (junctionsResponse.error) throw junctionsResponse.error;
      setDbJunctions(junctionsResponse.data.List);

    } catch (error) {
      console.error('Error fetching database data:', error);
      toast({
        title: "Database Error",
        description: "Failed to fetch matchup data from database",
        variant: "destructive"
      });
    }
  };

  // Fetch live matchup data from Sleeper API
  const fetchLiveMatchups = async () => {
    if (!selectedConference || dbConferences.length === 0 || dbJunctions.length === 0) return;

    setLoading(true);
    try {
      // Find the selected conference
      const conference = dbConferences.find(c => c.id === selectedConference);
      if (!conference) {
        throw new Error('Conference not found');
      }

      // Create team data map for roster_id to team info mapping
      const teamDataMap = new Map<number, { teamId: number; teamName: string; ownerName: string }>();
      
      dbJunctions.forEach(junction => {
        if (junction.conference_id === selectedConference && junction.is_active) {
          const team = dbTeams.find(t => t.id === junction.team_id);
          if (team) {
            teamDataMap.set(parseInt(junction.roster_id), {
              teamId: team.id,
              teamName: team.team_name,
              ownerName: team.owner_name
            });
          }
        }
      });

      // Fetch and process matchup data
      const processedMatchups = await SleeperApiService.processMatchupData(
        conference.league_id,
        selectedWeek,
        teamDataMap
      );

      setMatchupsData(processedMatchups);
      setLastUpdate(new Date());
      setIsLive(true);

      console.log(`Fetched ${processedMatchups.length} live matchups for week ${selectedWeek}`);

    } catch (error) {
      console.error('Error fetching live matchups:', error);
      toast({
        title: "API Error",
        description: "Failed to fetch live matchup data from Sleeper API",
        variant: "destructive"
      });
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  // Toggle matchup expansion
  const toggleMatchupExpansion = (matchupId: string) => {
    const newExpanded = new Set(expandedMatchups);
    if (newExpanded.has(matchupId)) {
      newExpanded.delete(matchupId);
    } else {
      newExpanded.add(matchupId);
    }
    setExpandedMatchups(newExpanded);
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchLiveMatchups();
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && isLive && selectedConference) {
      const interval = setInterval(() => {
        fetchLiveMatchups();
      }, 45000); // Refresh every 45 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, isLive, selectedConference, selectedWeek]);

  // Initial data load
  useEffect(() => {
    fetchDatabaseData();
  }, [selectedConference]);

  // Load live data when week or conference changes
  useEffect(() => {
    if (dbConferences.length > 0 && dbJunctions.length > 0) {
      fetchLiveMatchups();
    }
  }, [selectedWeek, selectedConference, dbConferences.length, dbJunctions.length]);

  // Get filtered matchups from database for week selection
  const availableWeeks = [...new Set(dbMatchups.map(m => m.week))].sort((a, b) => a - b);

  // Position order for starters display
  const getPositionOrder = (position: string): number => {
    const order = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'K', 'DEF'];
    return order.indexOf(position) !== -1 ? order.indexOf(position) : 999;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Live Matchups</h1>
          {isLive && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Wifi className="h-3 w-3 mr-1" />
              Live
            </Badge>
          )}
          {!isLive && lastUpdate && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {selectedWeek} • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          }
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select 
            value={selectedWeek.toString()} 
            onValueChange={(value) => setSelectedWeek(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableWeeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week}</span>
                    {week === Math.max(...availableWeeks) && (
                      <Badge variant="outline" className="text-xs">Current</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || !selectedConference}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{matchupsData.length} matchups</span>
          </div>
          {lastUpdate && (
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* No Conference Selected */}
      {!selectedConference && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Please select a conference to view live matchups.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && selectedConference && (
        <Card>
          <CardContent className="py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading live matchup data...</p>
          </CardContent>
        </Card>
      )}

      {/* Matchups Grid */}
      {!loading && selectedConference && (
        <div className="grid gap-4">
          {matchupsData.map((matchup) => (
            <Card key={matchup.matchupId} className="hover:shadow-md transition-shadow">
              <Collapsible>
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(matchup.matchupId.toString())}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-lg">
                          Week {matchup.week} Matchup
                        </CardTitle>
                        <Badge className="bg-green-500 hover:bg-green-600">
                          {matchup.isLive ? 'Live' : 'Final'}
                        </Badge>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        expandedMatchups.has(matchup.matchupId.toString()) ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="pt-0">
                  {/* Matchup Summary */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Team 1 */}
                    <div className="text-right space-y-1">
                      <div className="font-semibold">{matchup.teams[0]?.teamName || 'Unknown Team'}</div>
                      <div className="text-sm text-muted-foreground">{matchup.teams[0]?.ownerName}</div>
                      <div className="text-2xl font-bold text-primary">
                        {matchup.teams[0]?.points.toFixed(1) || '0.0'}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center">
                      <div className="text-lg font-semibold text-muted-foreground">VS</div>
                      {matchup.teams[0] && matchup.teams[1] && matchup.teams[0].points > matchup.teams[1].points && (
                        <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" />
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="text-left space-y-1">
                      <div className="font-semibold">{matchup.teams[1]?.teamName || 'Unknown Team'}</div>
                      <div className="text-sm text-muted-foreground">{matchup.teams[1]?.ownerName}</div>
                      <div className="text-2xl font-bold text-primary">
                        {matchup.teams[1]?.points.toFixed(1) || '0.0'}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6">
                    <div className="border-t pt-4 space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {matchup.teams.map((team, teamIndex) => (
                          <Card key={teamIndex} className="border-2">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center justify-between">
                                <span>{team.teamName}</span>
                                <Badge variant="outline">{team.points.toFixed(1)} pts</Badge>
                              </CardTitle>
                              <CardDescription>{team.ownerName}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Starters */}
                              <div>
                                <h4 className="font-semibold text-sm mb-2 flex items-center">
                                  <Star className="h-4 w-4 mr-1" />
                                  Starting Lineup
                                </h4>
                                <div className="space-y-1">
                                  {team.starters
                                    .sort((a, b) => getPositionOrder(a.slotPosition) - getPositionOrder(b.slotPosition))
                                    .map((player, playerIndex) => (
                                    <div 
                                      key={playerIndex} 
                                      className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <Badge variant="outline" className="text-xs font-mono w-12 justify-center">
                                          {player.slotPosition}
                                        </Badge>
                                        <div>
                                          <div className="font-medium">{player.playerName}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {player.position} • {player.nflTeam}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="font-semibold">
                                        {player.points.toFixed(1)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Bench */}
                              {team.bench.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">Bench</h4>
                                  <div className="space-y-1">
                                    {team.bench.slice(0, 5).map((player, playerIndex) => (
                                      <div 
                                        key={playerIndex} 
                                        className="flex items-center justify-between p-2 bg-muted/10 rounded text-sm"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <Badge variant="secondary" className="text-xs w-12 justify-center">
                                            {player.position}
                                          </Badge>
                                          <div>
                                            <div className="font-medium">{player.playerName}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {player.nflTeam}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-muted-foreground">
                                          {player.points.toFixed(1)}
                                        </div>
                                      </div>
                                    ))}
                                    {team.bench.length > 5 && (
                                      <div className="text-xs text-muted-foreground text-center py-1">
                                        +{team.bench.length - 5} more players
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Matchup Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-sm text-muted-foreground">Total Points</div>
                          <div className="font-semibold">
                            {((matchup.teams[0]?.points || 0) + (matchup.teams[1]?.points || 0)).toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Point Spread</div>
                          <div className="font-semibold">
                            {Math.abs((matchup.teams[0]?.points || 0) - (matchup.teams[1]?.points || 0)).toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Last Updated</div>
                          <div className="text-xs">
                            {new Date(matchup.lastUpdate).toLocaleTimeString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Status</div>
                          <div className="text-xs">{matchup.isLive ? 'Live' : 'Final'}</div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>
          ))}

          {matchupsData.length === 0 && selectedConference && !loading && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No matchups found for Week {selectedWeek}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchupsPage;