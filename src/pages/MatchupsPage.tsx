import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define interfaces for our data structures
interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  draft_id: string;
  status: string;
  league_logo_url: string;
}

interface Season {
  id: number;
  season_year: number;
  season_name: string;
  is_current_season: boolean;
}

interface TeamConferenceJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
  joined_date: string;
}

interface Matchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
}

interface Player {
  id: number;
  sleeper_player_id: string;
  player_name: string;
  position: string;
  team_id: number;
  nfl_team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
}

interface SleeperMatchupData {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
  players_points?: { [key: string]: number };
}

interface ProcessedMatchup {
  matchup: Matchup;
  conference: Conference;
  season: Season;
  team1: Team;
  team2: Team;
  team1RosterId: string;
  team2RosterId: string;
  team1SleeperData?: SleeperMatchupData;
  team2SleeperData?: SleeperMatchupData;
  team1Players?: Player[];
  team2Players?: Player[];
}

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';
const POSITION_ORDER = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'];

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference } = useApp();
  const { toast } = useToast();
  
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processedMatchups, setProcessedMatchups] = useState<ProcessedMatchup[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);

  // Table IDs from the schema
  const TABLE_IDS = {
    matchups: 13329,
    conferences: 12820,
    seasons: 12818,
    teams: 12852,
    teamConferencesJunction: 12853,
    players: 12870
  };

  const fetchTableData = async (tableId: number, filters: any[] = []) => {
    try {
      console.log(`Fetching data from table ${tableId} with filters:`, filters);
      const response = await window.ezsite.apis.tablePage(tableId, {
        PageNo: 1,
        PageSize: 1000, // Get all records
        OrderByField: "id",
        IsAsc: true,
        Filters: filters
      });
      
      if (response.error) throw new Error(response.error);
      console.log(`Table ${tableId} data:`, response.data?.List);
      return response.data?.List || [];
    } catch (error) {
      console.error(`Error fetching table ${tableId}:`, error);
      throw error;
    }
  };

  const fetchSleeperMatchupData = async (leagueId: string, week: number): Promise<SleeperMatchupData[]> => {
    try {
      console.log(`Fetching Sleeper data for league ${leagueId}, week ${week}`);
      const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/matchups/${week}`);
      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`Sleeper data for league ${leagueId}, week ${week}:`, data);
      return data || [];
    } catch (error) {
      console.error(`Error fetching Sleeper data for league ${leagueId}, week ${week}:`, error);
      return [];
    }
  };

  const processMatchupData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Starting matchup data processing...');

      // Step 1: Fetch all matchups
      const matchups: Matchup[] = await fetchTableData(TABLE_IDS.matchups);
      console.log('Fetched matchups:', matchups);

      if (matchups.length === 0) {
        setProcessedMatchups([]);
        setAvailableWeeks([]);
        return;
      }

      // Get unique weeks
      const weeks = [...new Set(matchups.map(m => m.week))].sort((a, b) => a - b);
      setAvailableWeeks(weeks);
      setCurrentWeek(Math.max(...weeks));

      // Step 2: Fetch conferences, seasons, teams, and junctions
      const [conferences, seasons, teams, junctions]: [Conference[], Season[], Team[], TeamConferenceJunction[]] = await Promise.all([
        fetchTableData(TABLE_IDS.conferences),
        fetchTableData(TABLE_IDS.seasons),
        fetchTableData(TABLE_IDS.teams),
        fetchTableData(TABLE_IDS.teamConferencesJunction)
      ]);

      console.log('Fetched base data:', { conferences, seasons, teams, junctions });

      // Step 3: Filter matchups by selected filters
      let filteredMatchups = matchups.filter(m => m.week === selectedWeek);
      
      if (selectedConference) {
        filteredMatchups = filteredMatchups.filter(m => m.conference_id === parseInt(selectedConference));
      }

      console.log('Filtered matchups:', filteredMatchups);

      // Step 4: Process each matchup
      const processed: ProcessedMatchup[] = [];

      for (const matchup of filteredMatchups) {
        console.log('Processing matchup:', matchup);

        // Find conference
        const conference = conferences.find(c => c.id === matchup.conference_id);
        if (!conference) {
          console.warn(`Conference not found for matchup ${matchup.id}`);
          continue;
        }

        // Find season
        const season = seasons.find(s => s.id === conference.season_id);
        if (!season) {
          console.warn(`Season not found for conference ${conference.id}`);
          continue;
        }

        // Find teams
        const team1 = teams.find(t => t.id === matchup.team_1_id);
        const team2 = teams.find(t => t.id === matchup.team_2_id);
        
        if (!team1 || !team2) {
          console.warn(`Teams not found for matchup ${matchup.id}`);
          continue;
        }

        // Find roster IDs from junction table
        const team1Junction = junctions.find(j => j.team_id === matchup.team_1_id && j.conference_id === matchup.conference_id);
        const team2Junction = junctions.find(j => j.team_id === matchup.team_2_id && j.conference_id === matchup.conference_id);

        if (!team1Junction || !team2Junction) {
          console.warn(`Roster IDs not found for matchup ${matchup.id}`);
          continue;
        }

        // Fetch Sleeper data
        let team1SleeperData: SleeperMatchupData | undefined;
        let team2SleeperData: SleeperMatchupData | undefined;

        try {
          const sleeperData = await fetchSleeperMatchupData(conference.league_id, matchup.week);
          team1SleeperData = sleeperData.find(d => d.roster_id.toString() === team1Junction.roster_id);
          team2SleeperData = sleeperData.find(d => d.roster_id.toString() === team2Junction.roster_id);
          console.log('Sleeper data found:', { team1SleeperData, team2SleeperData });
        } catch (error) {
          console.error(`Error fetching Sleeper data for matchup ${matchup.id}:`, error);
        }

        processed.push({
          matchup,
          conference,
          season,
          team1,
          team2,
          team1RosterId: team1Junction.roster_id,
          team2RosterId: team2Junction.roster_id,
          team1SleeperData,
          team2SleeperData
        });
      }

      console.log('Processed matchups:', processed);
      setProcessedMatchups(processed);

    } catch (error) {
      console.error('Error processing matchup data:', error);
      toast({
        title: "Error",
        description: "Failed to load matchup data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedWeek, selectedConference, toast]);

  useEffect(() => {
    processMatchupData();
  }, [processMatchupData]);

  const handleRefresh = () => {
    setRefreshing(true);
    processMatchupData();
  };

  const toggleMatchupExpansion = (matchupId: string) => {
    const newExpanded = new Set(expandedMatchups);
    if (newExpanded.has(matchupId)) {
      newExpanded.delete(matchupId);
    } else {
      newExpanded.add(matchupId);
    }
    setExpandedMatchups(newExpanded);
  };

  const getMatchupStatus = (processed: ProcessedMatchup) => {
    const { team1SleeperData, team2SleeperData } = processed;
    
    if (!team1SleeperData || !team2SleeperData) {
      return { status: 'upcoming', badge: <Badge variant="outline">Upcoming</Badge> };
    }

    const hasScores = (team1SleeperData.points > 0 || team2SleeperData.points > 0);
    
    if (hasScores) {
      return { status: 'live', badge: <Badge className="bg-green-500 hover:bg-green-600">Live</Badge> };
    }

    return { status: 'upcoming', badge: <Badge variant="outline">Upcoming</Badge> };
  };

  const renderRosterDetails = (processed: ProcessedMatchup, isTeam1: boolean) => {
    const team = isTeam1 ? processed.team1 : processed.team2;
    const sleeperData = isTeam1 ? processed.team1SleeperData : processed.team2SleeperData;

    if (!sleeperData) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{team.team_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No lineup data available
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            {team.team_name}
            <Badge variant="outline">{sleeperData.points.toFixed(1)} pts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">STARTERS</h4>
            <div className="space-y-1">
              {sleeperData.starters.map((playerId, index) => (
                <div key={playerId} className="flex justify-between text-sm">
                  <span>{POSITION_ORDER[index] || 'FLEX'}: Player {playerId}</span>
                  <span className="font-mono">
                    {sleeperData.players_points?.[playerId]?.toFixed(1) || '0.0'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {sleeperData.players.filter(p => !sleeperData.starters.includes(p)).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">BENCH</h4>
              <div className="space-y-1">
                {sleeperData.players
                  .filter(p => !sleeperData.starters.includes(p))
                  .slice(0, 5) // Show first 5 bench players
                  .map(playerId => (
                    <div key={playerId} className="flex justify-between text-sm text-muted-foreground">
                      <span>Player {playerId}</span>
                      <span className="font-mono">
                        {sleeperData.players_points?.[playerId]?.toFixed(1) || '0.0'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
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
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading matchup data...</p>
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
          Week {selectedWeek} • {processedMatchups.length > 0 && processedMatchups[0].season.season_name}
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
              {availableWeeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week}</span>
                    {week === currentWeek && <Badge variant="outline" className="text-xs">Current</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{processedMatchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Matchups Grid */}
      <div className="grid gap-4">
        {processedMatchups.map((processed) => {
          const { status, badge } = getMatchupStatus(processed);
          const matchupId = processed.matchup.id.toString();

          return (
            <Card key={matchupId} className="hover:shadow-md transition-shadow">
              <Collapsible>
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(matchupId)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-lg">
                          {processed.conference.conference_name}
                        </CardTitle>
                        {badge}
                        {processed.matchup.is_playoff && (
                          <Badge variant="secondary">Playoff</Badge>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        expandedMatchups.has(matchupId) ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="pt-0">
                  {/* Matchup Summary */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Team 1 */}
                    <div className="text-right space-y-1">
                      <div className="font-semibold">{processed.team1.team_name}</div>
                      <div className="text-sm text-muted-foreground">{processed.team1.owner_name}</div>
                      <div className="text-2xl font-bold">
                        {status === 'upcoming' || !processed.team1SleeperData ? '--' : processed.team1SleeperData.points.toFixed(1)}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center">
                      <div className="text-lg font-semibold text-muted-foreground">VS</div>
                      {status === 'completed' && (
                        <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" />
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="text-left space-y-1">
                      <div className="font-semibold">{processed.team2.team_name}</div>
                      <div className="text-sm text-muted-foreground">{processed.team2.owner_name}</div>
                      <div className="text-2xl font-bold">
                        {status === 'upcoming' || !processed.team2SleeperData ? '--' : processed.team2SleeperData.points.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6">
                    <div className="border-t pt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderRosterDetails(processed, true)}
                        {renderRosterDetails(processed, false)}
                      </div>

                      {/* Matchup Stats */}
                      {status !== 'upcoming' && processed.team1SleeperData && processed.team2SleeperData && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-sm text-muted-foreground">Total Points</div>
                            <div className="font-semibold">
                              {(processed.team1SleeperData.points + processed.team2SleeperData.points).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Point Spread</div>
                            <div className="font-semibold">
                              {Math.abs(processed.team1SleeperData.points - processed.team2SleeperData.points).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Matchup ID</div>
                            <div className="text-xs">{processed.team1SleeperData.matchup_id}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Status</div>
                            <div className="text-xs">{status}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>
          );
        })}

        {processedMatchups.length === 0 && !loading && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No matchups found for the selected filters.</p>
              <p className="text-sm text-muted-foreground mt-2">Try selecting a different week or conference.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MatchupsPage;