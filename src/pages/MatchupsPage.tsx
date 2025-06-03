import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from '@/services/sleeperApi';

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
}

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

  // Fetch conferences and teams from database
  const fetchDatabaseData = async () => {
    try {
      console.log('Fetching conferences and teams from database...');
      
      // Fetch conferences
      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: []
      });

      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }

      const conferenceData = conferencesResponse.data.List;
      setConferences(conferenceData);
      console.log(`Loaded ${conferenceData.length} conferences`);

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
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Fetch matchup data from Sleeper API
  const fetchMatchupData = async (conferenceData: Conference[], teamData: Team[]) => {
    try {
      console.log('Fetching matchup data from Sleeper API...');
      
      // Filter conferences based on selection
      const targetConferences = selectedConference
        ? conferenceData.filter(c => c.id === selectedConference)
        : conferenceData;

      if (targetConferences.length === 0) {
        setMatchups([]);
        return;
      }

      // Fetch players data once
      const playersData = await SleeperApiService.fetchAllPlayers();
      setAllPlayers(playersData);

      const allMatchups: OrganizedMatchup[] = [];

      // Process each conference
      for (const conference of targetConferences) {
        try {
          console.log(`Processing conference: ${conference.conference_name} (${conference.league_id})`);
          
          // Fetch league data
          const [matchupsData, rostersData, usersData] = await Promise.all([
            SleeperApiService.fetchMatchups(conference.league_id, selectedWeek),
            SleeperApiService.fetchLeagueRosters(conference.league_id),
            SleeperApiService.fetchLeagueUsers(conference.league_id)
          ]);

          // Organize matchups
          const organizedMatchups = SleeperApiService.organizeMatchups(
            matchupsData,
            rostersData,
            usersData
          );

          // Convert to our format and add team data
          const conferenceMatchups: OrganizedMatchup[] = organizedMatchups.map((matchup) => ({
            matchup_id: matchup.matchup_id,
            conference,
            teams: matchup.teams.map((team) => {
              // Find corresponding team from database
              const dbTeam = teamData.find(t => 
                team.owner && t.owner_id === team.owner.user_id
              );

              const matchupTeam = matchupsData.find(m => m.roster_id === team.roster_id);

              return {
                ...team,
                team: dbTeam || null,
                players_points: matchupTeam?.players_points || {},
                starters_points: matchupTeam?.starters_points || []
              };
            }),
            status: selectedWeek <= currentWeek ? 
              (matchupsData.some(m => m.points > 0) ? 'completed' : 'live') : 
              'upcoming'
          }));

          allMatchups.push(...conferenceMatchups);
          
        } catch (error) {
          console.error(`Error processing conference ${conference.conference_name}:`, error);
          toast({
            title: 'Conference Error',
            description: `Failed to load data for ${conference.conference_name}`,
            variant: 'destructive',
          });
        }
      }

      setMatchups(allMatchups);
      console.log(`Loaded ${allMatchups.length} total matchups`);

    } catch (error) {
      console.error('Error fetching matchup data:', error);
      toast({
        title: 'API Error',
        description: 'Failed to load matchup data from Sleeper API.',
        variant: 'destructive',
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
  }, [selectedWeek, selectedConference]);

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

  const getWinningTeam = (matchup: OrganizedMatchup) => {
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
          {selectedSeason} Season • Week {selectedWeek} • {selectedConference ?
          conferences.find((c) => c.id === selectedConference)?.conference_name :
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
            onClick={() => loadData(true)}
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

      {/* Matchups Grid */}
      <div className="grid gap-4">
        {matchups.map((matchup) => {
          const [team1, team2] = matchup.teams;
          const winningTeam = getWinningTeam(matchup);
          
          return (
            <Card key={`${matchup.conference.id}-${matchup.matchup_id}`} className="hover:shadow-md transition-shadow">
              <Collapsible>
                <CollapsibleTrigger
                  className="w-full"
                  onClick={() => toggleMatchupExpansion(`${matchup.conference.id}-${matchup.matchup_id}`)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-lg">
                          {matchup.conference.conference_name}
                        </CardTitle>
                        {getStatusBadge(matchup.status)}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        expandedMatchups.has(`${matchup.conference.id}-${matchup.matchup_id}`) ? 'rotate-180' : ''
                      }`} />
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
                        {matchup.status === 'upcoming' ? '--' : team1.points.toFixed(1)}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center">
                      <div className="text-lg font-semibold text-muted-foreground">VS</div>
                      {matchup.status === 'completed' && winningTeam && (
                        <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" />
                      )}
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
                        {matchup.status === 'upcoming' ? '--' : team2.points.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="mt-6">
                    <div className="border-t pt-4 space-y-4">
                      {/* Team Rosters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Team 1 Roster */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                              {team1.team?.team_name || team1.owner?.display_name || 'Team 1'} Lineup
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {team1.roster?.starters.map((playerId, index) => (
                                <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm">
                                  <span>{getPlayerName(playerId)}</span>
                                  <span className="font-medium">
                                    {team1.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              )) || <p className="text-muted-foreground text-sm">No lineup data available</p>}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Team 2 Roster */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                              {team2.team?.team_name || team2.owner?.display_name || 'Team 2'} Lineup
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {team2.roster?.starters.map((playerId, index) => (
                                <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm">
                                  <span>{getPlayerName(playerId)}</span>
                                  <span className="font-medium">
                                    {team2.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              )) || <p className="text-muted-foreground text-sm">No lineup data available</p>}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Matchup Stats */}
                      {matchup.status !== 'upcoming' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-sm text-muted-foreground">Total Points</div>
                            <div className="font-semibold">
                              {(team1.points + team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Point Spread</div>
                            <div className="font-semibold">
                              {Math.abs(team1.points - team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">High Score</div>
                            <div className="font-semibold">
                              {Math.max(team1.points, team2.points).toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Status</div>
                            <div className="text-xs capitalize">{matchup.status}</div>
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

        {matchups.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No matchups found for the selected filters.</p>
              {conferences.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Make sure conferences are configured in the admin panel.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MatchupsPage;