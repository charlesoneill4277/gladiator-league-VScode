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

  // Fetch matchup data from Sleeper API
  const fetchMatchupData = async (conferenceData: Conference[], teamData: Team[]) => {
    try {
      console.log('Fetching matchup data from Sleeper API...');

      // Use all the filtered conferences from the database query
      // They are already filtered by season and optionally by specific conference
      const targetConferences = conferenceData;

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

          // Fetch league data - get rosters and users data
          const [rostersData, usersData] = await Promise.all([
          SleeperApiService.fetchLeagueRosters(conference.league_id),
          SleeperApiService.fetchLeagueUsers(conference.league_id)]
          );

          // Fetch matchup data for the selected week
          const matchupsData = await SleeperApiService.fetchMatchups(conference.league_id, selectedWeek);
          console.log(`Fetched ${matchupsData.length} matchups for week ${selectedWeek}`);

          // Log detailed points data for debugging
          console.log(`\n=== WEEK ${selectedWeek} MATCHUP DATA ===`);
          matchupsData.forEach((matchup) => {
            console.log(`Roster ${matchup.roster_id}:`, {
              points: matchup.points,
              matchup_id: matchup.matchup_id,
              has_starters: matchup.starters?.length || 0,
              has_players_points: Object.keys(matchup.players_points || {}).length,
              starters_points: matchup.starters_points?.reduce((sum, p) => sum + (p || 0), 0) || 0
            });
          });
          console.log(`=== END WEEK ${selectedWeek} DATA ===\n`);

          // Check if this week has any points data
          const hasAnyPoints = matchupsData.some((m) => m.points > 0);
          console.log(`Week ${selectedWeek} has points data: ${hasAnyPoints}`);

          if (!hasAnyPoints && selectedWeek <= currentWeek) {
            console.warn(`WARNING: Week ${selectedWeek} should have points data but none found!`);
          }

          // Organize matchups
          const organizedMatchups = SleeperApiService.organizeMatchups(
            matchupsData,
            rostersData,
            usersData
          );

          // Convert to our format and add team data
          const conferenceMatchups: OrganizedMatchup[] = organizedMatchups.map((matchup) => {
            const matchupTeams = matchup.teams.map((team) => {
              // Find corresponding team from database
              const dbTeam = teamData.find((t) =>
              team.owner && t.owner_id === team.owner.user_id
              );

              // PRIORITY FIX: Always use raw API data as primary source
              const rawMatchupData = matchupsData.find((m) => m.roster_id === team.roster_id);

              // Validate and log data sources
              const apiPoints = rawMatchupData?.points;
              const organizedPoints = team.points;
              const hasApiData = rawMatchupData !== undefined;
              const hasApiPoints = apiPoints !== undefined && apiPoints !== null;

              console.log(`\n=== TEAM ${team.roster_id} DATA MERGE ===`);
              console.log('Raw API data found:', hasApiData);
              console.log('API points value:', apiPoints);
              console.log('Organized points value:', organizedPoints);
              console.log('Using points from:', hasApiPoints ? 'API' : 'Organized');

              // Error handling: Log missing data scenarios
              if (!hasApiData) {
                console.warn(`WARNING: No raw API data found for roster ${team.roster_id}`);
              }
              if (hasApiData && !hasApiPoints) {
                console.warn(`WARNING: API data exists but points missing for roster ${team.roster_id}`);
              }

              // PRIORITY LOGIC: API data takes absolute priority
              const finalPoints = hasApiPoints ? apiPoints : organizedPoints || 0;
              const finalPlayersPoints = rawMatchupData?.players_points || team.players_points || {};
              const finalStartersPoints = rawMatchupData?.starters_points || team.starters_points || [];

              console.log('Final points value:', finalPoints);
              console.log('Final players_points keys:', Object.keys(finalPlayersPoints).length);
              console.log('Final starters_points length:', finalStartersPoints.length);
              console.log('=== END TEAM DATA MERGE ===\n');

              return {
                ...team,
                team: dbTeam || null,
                points: finalPoints,
                projected_points: team.projected_points,
                players_points: finalPlayersPoints,
                starters_points: finalStartersPoints
              };
            });

            // Enhanced status determination with better validation
            let matchupStatus: 'live' | 'completed' | 'upcoming';

            if (selectedWeek > currentWeek) {
              matchupStatus = 'upcoming';
              console.log(`Matchup ${matchup.matchup_id}: UPCOMING (week ${selectedWeek} > current ${currentWeek})`);
            } else {
              // Validate points data for this specific matchup
              const teamPointsData = matchupTeams.map((team) => ({
                roster_id: team.roster_id,
                points: team.points,
                hasValidPoints: team.points > 0
              }));

              const hasAnyPoints = teamPointsData.some((team) => team.hasValidPoints);
              const allTeamsHavePoints = teamPointsData.every((team) => team.hasValidPoints);

              console.log(`\n=== MATCHUP ${matchup.matchup_id} STATUS CHECK ===`);
              console.log('Team points data:', teamPointsData);
              console.log('Has any points:', hasAnyPoints);
              console.log('All teams have points:', allTeamsHavePoints);

              // Determine status based on points availability
              if (allTeamsHavePoints) {
                matchupStatus = 'completed';
                console.log('Status: COMPLETED (all teams have points)');
              } else if (hasAnyPoints) {
                matchupStatus = 'live';
                console.log('Status: LIVE (some teams have points)');
              } else {
                // Additional check: if it's a past week with no points, it might be an error
                if (selectedWeek < currentWeek) {
                  console.warn(`WARNING: Past week ${selectedWeek} has no points data!`);
                }
                matchupStatus = 'live';
                console.log('Status: LIVE (no points detected)');
              }
              console.log('=== END STATUS CHECK ===\n');
            }

            return {
              matchup_id: matchup.matchup_id,
              conference,
              teams: matchupTeams,
              status: matchupStatus
            };
          });

          // Final validation and error reporting for this conference
          const totalMatchups = conferenceMatchups.length;
          const completedMatchups = conferenceMatchups.filter((m) => m.status === 'completed').length;
          const liveMatchups = conferenceMatchups.filter((m) => m.status === 'live').length;
          const upcomingMatchups = conferenceMatchups.filter((m) => m.status === 'upcoming').length;

          console.log(`\n=== CONFERENCE ${conference.conference_name} SUMMARY ===`);
          console.log(`Total matchups: ${totalMatchups}`);
          console.log(`Completed: ${completedMatchups}, Live: ${liveMatchups}, Upcoming: ${upcomingMatchups}`);

          // Check for data anomalies
          if (selectedWeek <= currentWeek && completedMatchups === 0 && liveMatchups > 0) {
            console.warn(`ANOMALY: Week ${selectedWeek} should have completed games but all are live`);
          }

          if (selectedWeek < currentWeek && totalMatchups > 0 && completedMatchups === 0) {
            console.error(`ERROR: Past week ${selectedWeek} has no completed matchups!`);
            toast({
              title: 'Data Warning',
              description: `Week ${selectedWeek} appears to be missing points data`,
              variant: 'default'
            });
          }
          console.log('=== END CONFERENCE SUMMARY ===\n');

          allMatchups.push(...conferenceMatchups);

        } catch (error) {
          console.error(`Error processing conference ${conference.conference_name}:`, error);
          toast({
            title: 'Conference Error',
            description: `Failed to load data for ${conference.conference_name}`,
            variant: 'destructive'
          });
        }
      }

      // Final data quality report
      const totalMatchups = allMatchups.length;
      const completedCount = allMatchups.filter((m) => m.status === 'completed').length;
      const liveCount = allMatchups.filter((m) => m.status === 'live').length;
      const upcomingCount = allMatchups.filter((m) => m.status === 'upcoming').length;

      console.log(`\n=== FINAL MATCHUP DATA SUMMARY ===`);
      console.log(`Week: ${selectedWeek} (Current: ${currentWeek})`);
      console.log(`Total matchups loaded: ${totalMatchups}`);
      console.log(`Status breakdown - Completed: ${completedCount}, Live: ${liveCount}, Upcoming: ${upcomingCount}`);

      // Check for overall data quality issues
      const hasDataQualityIssues =
      selectedWeek < currentWeek && completedCount === 0 && totalMatchups > 0 || // Past week with no completed games
      selectedWeek === currentWeek && completedCount === 0 && liveCount === 0 && upcomingCount === 0 && totalMatchups > 0 // Current week with no active games
      ;

      if (hasDataQualityIssues) {
        console.error('CRITICAL: Data quality issues detected!');
        toast({
          title: 'Data Quality Issue',
          description: `Week ${selectedWeek} data may be incomplete. Check logs for details.`,
          variant: 'default'
        });
      } else {
        console.log('✓ Data quality looks good');
      }
      console.log('=== END SUMMARY ===\n');

      setMatchups(allMatchups);
      console.log(`Successfully loaded ${allMatchups.length} total matchups`);

    } catch (error) {
      console.error('Error fetching matchup data:', error);
      toast({
        title: 'API Error',
        description: 'Failed to load matchup data from Sleeper API.',
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
                  onClick={() => toggleMatchupExpansion(`${matchup.conference.id}-${matchup.matchup_id}`)}>

                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-lg">
                          {matchup.conference.conference_name}
                        </CardTitle>
                        {getStatusBadge(matchup.status)}
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
                              {team1.roster?.starters.map((playerId, index) =>
                              <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm">
                                  <span>{getPlayerName(playerId)}</span>
                                  <span className="font-medium">
                                    {team1.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              ) || <p className="text-muted-foreground text-sm">No lineup data available</p>}
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
                              {team2.roster?.starters.map((playerId, index) =>
                              <div key={`${playerId}-${index}`} className="flex justify-between items-center text-sm">
                                  <span>{getPlayerName(playerId)}</span>
                                  <span className="font-medium">
                                    {team2.starters_points[index]?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                              ) || <p className="text-muted-foreground text-sm">No lineup data available</p>}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Matchup Stats */}
                      {matchup.status !== 'upcoming' &&
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