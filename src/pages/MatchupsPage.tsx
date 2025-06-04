import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle, Bug, CheckCircle, Play, Pause, Database, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SleeperApiService, { SleeperMatchup, SleeperRoster, SleeperUser, SleeperPlayer } from '@/services/sleeperApi';
import StartingLineup from '@/components/StartingLineup';

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

interface DatabaseMatchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
  sleeper_matchup_id: string;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
  is_manual_override: boolean;
  status: string;
  matchup_date: string;
  notes: string;
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
    matchup_starters: string[]; // The actual starters for this specific matchup/week
  }>;
  status: 'live' | 'completed' | 'upcoming';
  isManualOverride?: boolean; // From database
  databaseMatchupId?: number; // Database matchup ID if exists
  overrideNotes?: string; // Notes from database override
  dataSource: 'database' | 'sleeper' | 'hybrid'; // Track data source
  rawData?: any; // For debug mode
}

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
  const [matchups, setMatchups] = useState<OrganizedMatchup[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [weekStatus, setWeekStatus] = useState<WeekStatus | null>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [rawApiData, setRawApiData] = useState<any>(null);
  const [teamConferenceMap, setTeamConferenceMap] = useState<Map<string, { teamId: number, rosterId: string }>>(new Map());
  const [dataSourceStats, setDataSourceStats] = useState<{
    database: number;
    sleeper: number;
    hybrid: number;
  }>({ database: 0, sleeper: 0, hybrid: 0 });

  // Fetch database matchups for the selected week and conferences
  const fetchDatabaseMatchups = async (conferenceIds: number[]): Promise<DatabaseMatchup[]> => {
    try {
      console.log('🗄️ Fetching database matchups...', { conferenceIds, selectedWeek });
      
      if (conferenceIds.length === 0) {
        console.log('No conference IDs provided, skipping database query');
        return [];
      }

      // Build filters for database query
      const filters = [
        {
          name: 'week',
          op: 'Equal',
          value: selectedWeek
        }
      ];

      // If we have specific conferences, filter by them
      if (conferenceIds.length === 1) {
        filters.push({
          name: 'conference_id',
          op: 'Equal',
          value: conferenceIds[0]
        });
      }

      const response = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const dbMatchups = response.data.List as DatabaseMatchup[];
      
      // Filter by conference IDs if we have multiple
      const filteredMatchups = conferenceIds.length > 1 
        ? dbMatchups.filter(m => conferenceIds.includes(m.conference_id))
        : dbMatchups;

      console.log(`✅ Found ${filteredMatchups.length} database matchups for week ${selectedWeek}`);
      console.log('Database matchups:', filteredMatchups.map(m => ({
        id: m.id,
        conference_id: m.conference_id,
        teams: `${m.team_1_id} vs ${m.team_2_id}`,
        scores: `${m.team_1_score} - ${m.team_2_score}`,
        is_manual_override: m.is_manual_override,
        status: m.status
      })));

      return filteredMatchups;
    } catch (error) {
      console.error('❌ Error fetching database matchups:', error);
      toast({
        title: 'Database Error',
        description: 'Failed to load matchup overrides from database.',
        variant: 'destructive'
      });
      return [];
    }
  };

  // Build team-conference mapping for ID translation
  const buildTeamConferenceMap = async (conferenceIds: number[]) => {
    try {
      console.log('🔗 Building team-conference mapping...', { conferenceIds });
      
      const filters = conferenceIds.length > 0 ? [
        conferenceIds.length === 1 ? {
          name: 'conference_id',
          op: 'Equal',
          value: conferenceIds[0]
        } : null
      ].filter(Boolean) : [];

      const response = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 500,
        OrderByField: 'id',
        IsAsc: true,
        Filters: filters
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const junctions = response.data.List;
      const map = new Map<string, { teamId: number, rosterId: string }>();
      
      junctions.forEach((junction: any) => {
        if (conferenceIds.length === 0 || conferenceIds.includes(junction.conference_id)) {
          // Map both ways: rosterId -> teamId and teamId -> rosterId
          map.set(`roster_${junction.roster_id}`, { 
            teamId: junction.team_id, 
            rosterId: junction.roster_id 
          });
          map.set(`team_${junction.team_id}`, { 
            teamId: junction.team_id, 
            rosterId: junction.roster_id 
          });
        }
      });

      setTeamConferenceMap(map);
      console.log(`✅ Built team-conference mapping with ${map.size} entries`);
      console.log('Sample mappings:', Array.from(map.entries()).slice(0, 5));
      
      return map;
    } catch (error) {
      console.error('❌ Error building team-conference map:', error);
      return new Map();
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

  // Enhanced fetchMatchupData with database integration
  const fetchMatchupData = async (conferenceData: Conference[], teamData: Team[]) => {
    try {
      console.log('🚀 Starting fetchMatchupData with database integration...');
      console.log(`📊 Conference count: ${conferenceData.length}`);
      console.log(`👥 Team count: ${teamData.length}`);
      console.log(`📅 Selected week: ${selectedWeek}`);
      console.log(`📅 Current week: ${currentWeek}`);

      setApiErrors([]);
      const errors: string[] = [];
      const sourceStats = { database: 0, sleeper: 0, hybrid: 0 };

      // Step 1: Fetch database matchups first
      const conferenceIds = conferenceData.map(c => c.id);
      const [databaseMatchups, teamMap] = await Promise.all([
        fetchDatabaseMatchups(conferenceIds),
        buildTeamConferenceMap(conferenceIds)
      ]);

      console.log(`🗃️ Database matchups found: ${databaseMatchups.length}`);
      console.log(`🔗 Team mappings created: ${teamMap.size}`);

      // Determine and set week status
      const status = determineWeekStatus(selectedWeek, currentWeek);
      setWeekStatus(status);
      console.log(`📋 Week status:`, status);

      // Use all the filtered conferences from the database query
      const targetConferences = conferenceData;

      if (targetConferences.length === 0) {
        console.warn('⚠️ No target conferences found');
        setMatchups([]);
        setDataSourceStats(sourceStats);
        return;
      }

      console.log('🔗 Fetching players data from Sleeper API...');
      // Fetch players data once
      const playersData = await SleeperApiService.fetchAllPlayers();
      setAllPlayers(playersData);
      console.log(`✅ Loaded ${Object.keys(playersData).length} players`);

      const allMatchups: OrganizedMatchup[] = [];
      const debugData: any = {
        conferences: [],
        totalMatchups: 0,
        errors: [],
        weekStatus: status,
        databaseMatchups: databaseMatchups.length,
        dataSourceStats: sourceStats
      };

      // Process each conference
      for (const conference of targetConferences) {
        try {
          console.log(`🏛️ Processing conference: ${conference.conference_name} (${conference.league_id})`);
          const conferenceDebugData: any = {
            conference: conference.conference_name,
            leagueId: conference.league_id,
            matchupsData: null,
            rostersData: null,
            usersData: null,
            organizedMatchups: null,
            databaseOverrides: null
          };

          // Find database matchups for this conference
          const conferenceDbMatchups = databaseMatchups.filter(dbm => dbm.conference_id === conference.id);
          conferenceDebugData.databaseOverrides = conferenceDbMatchups;
          
          console.log(`🗄 Found ${conferenceDbMatchups.length} database overrides for ${conference.conference_name}`);

          console.log(`🔄 Fetching league data for ${conference.conference_name}...`);
          // Fetch league data
          const [matchupsData, rostersData, usersData] = await Promise.all([
            SleeperApiService.fetchMatchups(conference.league_id, selectedWeek),
            SleeperApiService.fetchLeagueRosters(conference.league_id),
            SleeperApiService.fetchLeagueUsers(conference.league_id)
          ]);

          console.log(`📈 Raw matchup data for ${conference.conference_name}:`, {
            matchupsCount: matchupsData.length,
            rostersCount: rostersData.length,
            usersCount: usersData.length,
            sampleMatchup: matchupsData[0] || null
          });

          // Store debug data
          conferenceDebugData.matchupsData = matchupsData;
          conferenceDebugData.rostersData = rostersData;
          conferenceDebugData.usersData = usersData;

          // Check for points data availability
          const hasPointsData = matchupsData.some((m) => m.points > 0);
          const hasPlayersPoints = matchupsData.some((m) => m.players_points && Object.keys(m.players_points).length > 0);
          const hasStartersPoints = matchupsData.some((m) => m.starters_points && m.starters_points.length > 0);

          console.log(`🎯 Points data analysis for ${conference.conference_name}:`, {
            hasPointsData,
            hasPlayersPoints,
            hasStartersPoints,
            pointsRange: matchupsData.map((m) => m.points),
            playersPointsKeys: matchupsData.map((m) => Object.keys(m.players_points || {}).length),
            startersPointsLengths: matchupsData.map((m) => (m.starters_points || []).length)
          });

          // Organize matchups with database integration
          const organizedMatchups = SleeperApiService.organizeMatchups(
            matchupsData,
            rostersData,
            usersData
          );

          conferenceDebugData.organizedMatchups = organizedMatchups;
          console.log(`🎲 Organized ${organizedMatchups.length} matchups for ${conference.conference_name}`);

          // Convert to our format and add team data with database integration
          const conferenceMatchups: OrganizedMatchup[] = organizedMatchups.map((matchup) => {
            // Check if this matchup has a database override
            const dbOverride = conferenceDbMatchups.find(dbm => {
              // Try to match by sleeper_matchup_id first
              if (dbm.sleeper_matchup_id && matchup.matchup_id.toString() === dbm.sleeper_matchup_id) {
                return true;
              }
              
              // Fall back to team matching via junction table
              const team1Mapping = teamMap.get(`roster_${matchup.teams[0]?.roster_id}`);
              const team2Mapping = teamMap.get(`roster_${matchup.teams[1]?.roster_id}`);
              
              if (team1Mapping && team2Mapping) {
                return (
                  (dbm.team_1_id === team1Mapping.teamId && dbm.team_2_id === team2Mapping.teamId) ||
                  (dbm.team_1_id === team2Mapping.teamId && dbm.team_2_id === team1Mapping.teamId)
                );
              }
              
              return false;
            });

            let dataSource: 'database' | 'sleeper' | 'hybrid' = 'sleeper';
            let useDbScores = false;

            if (dbOverride) {
              if (dbOverride.is_manual_override) {
                dataSource = 'database';
                useDbScores = true;
                sourceStats.database++;
                console.log(`🗄️ Using database override for matchup ${matchup.matchup_id}:`, {
                  scores: `${dbOverride.team_1_score} - ${dbOverride.team_2_score}`,
                  notes: dbOverride.notes
                });
              } else {
                dataSource = 'hybrid';
                sourceStats.hybrid++;
                console.log(`⚡ Hybrid mode for matchup ${matchup.matchup_id} (database entry exists but not overridden)`);
              }
            } else {
              sourceStats.sleeper++;
            }

            const matchupWithData: OrganizedMatchup = {
              matchup_id: matchup.matchup_id,
              conference,
              teams: matchup.teams.map((team, index) => {
                // Find corresponding team from database
                const dbTeam = teamData.find((t) =>
                  team.owner && t.owner_id === team.owner.user_id
                );

                const matchupTeam = matchupsData.find((m) => m.roster_id === team.roster_id);

                // Override points if database override exists
                let finalPoints = team.points ?? 0;
                if (useDbScores && dbOverride) {
                  const teamMapping = teamMap.get(`roster_${team.roster_id}`);
                  if (teamMapping) {
                    if (dbOverride.team_1_id === teamMapping.teamId) {
                      finalPoints = dbOverride.team_1_score;
                    } else if (dbOverride.team_2_id === teamMapping.teamId) {
                      finalPoints = dbOverride.team_2_score;
                    }
                  }
                }

                console.log(`👤 Team data for roster ${team.roster_id}:`, {
                  points: team.points,
                  finalPoints,
                  useDbScores,
                  hasMatchupTeam: !!matchupTeam,
                  playersPointsCount: Object.keys(matchupTeam?.players_points || {}).length,
                  startersPointsCount: (matchupTeam?.starters_points || []).length,
                  dbTeamFound: !!dbTeam
                });

                return {
                  ...team,
                  team: dbTeam || null,
                  players_points: matchupTeam?.players_points || {},
                  starters_points: matchupTeam?.starters_points || [],
                  matchup_starters: matchupTeam?.starters || [], // Store the actual starters from matchup
                  points: finalPoints // Use database override if available
                };
              }),
              status: determineMatchupStatus(selectedWeek, currentWeek, matchupsData, dbOverride),
              isManualOverride: dbOverride?.is_manual_override || false,
              databaseMatchupId: dbOverride?.id,
              overrideNotes: dbOverride?.notes || '',
              dataSource,
              rawData: debugMode ? {
                matchupsData: matchupsData.filter((m) =>
                  matchup.teams.some((t) => t.roster_id === m.roster_id)
                ),
                status: status,
                dbOverride: dbOverride
              } : undefined
            };

            return matchupWithData;
          });

          allMatchups.push(...conferenceMatchups);
          debugData.conferences.push(conferenceDebugData);

        } catch (error) {
          const errorMsg = `Error processing conference ${conference.conference_name}: ${error}`;
          console.error(`❌ ${errorMsg}`, error);
          errors.push(errorMsg);
          debugData.errors.push({
            conference: conference.conference_name,
            error: error instanceof Error ? error.message : String(error)
          });

          toast({
            title: 'Conference Error',
            description: `Failed to load data for ${conference.conference_name}`,
            variant: 'destructive'
          });
        }
      }

      debugData.totalMatchups = allMatchups.length;
      setRawApiData(debugData);
      setApiErrors(errors);
      setMatchups(allMatchups);
      setDataSourceStats(sourceStats);

      console.log(`✅ Successfully loaded ${allMatchups.length} total matchups`);
      console.log(`📊 Data source breakdown:`, sourceStats);
      console.log(`🐛 Debug data:`, debugData);

    } catch (error) {
      const errorMsg = `Failed to fetch matchup data: ${error}`;
      console.error('❌ Error fetching matchup data:', error);
      setApiErrors((prev) => [...prev, errorMsg]);

      toast({
        title: 'API Error',
        description: 'Failed to load matchup data from Sleeper API.',
        variant: 'destructive'
      });
    }
  };

  // Helper method to determine matchup status with better logic and database integration
  const determineMatchupStatus = (
    selectedWeek: number, 
    currentWeek: number, 
    matchupsData: SleeperMatchup[], 
    dbOverride?: DatabaseMatchup
  ): 'live' | 'completed' | 'upcoming' => {
    // If database override exists and is manual, use its status
    if (dbOverride?.is_manual_override) {
      switch (dbOverride.status) {
        case 'complete':
        case 'completed':
          return 'completed';
        case 'live':
        case 'in_progress':
          return 'live';
        default:
          return 'upcoming';
      }
    }

    // Get current year to determine if this is a historical season
    const currentYear = new Date().getFullYear();
    const isHistoricalSeason = selectedSeason < currentYear;

    console.log(`🏈 Determining matchup status: week ${selectedWeek}, current week ${currentWeek}, historical: ${isHistoricalSeason}`);

    // For historical seasons, all matchups should be treated as completed
    if (isHistoricalSeason) {
      return 'completed';
    }

    // For current season, use normal logic
    if (selectedWeek > currentWeek) {
      return 'upcoming';
    }

    // Check if any matchup has points > 0
    const hasPoints = matchupsData.some((m) => m.points > 0);

    if (selectedWeek < currentWeek) {
      return hasPoints ? 'completed' : 'completed'; // Past weeks should always be completed
    }

    // Current week - check if scoring has started
    return hasPoints ? 'live' : 'upcoming';
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

  const getDataSourceBadge = (dataSource: 'database' | 'sleeper' | 'hybrid', isManualOverride?: boolean) => {
    if (dataSource === 'database' && isManualOverride) {
      return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700"><Database className="h-3 w-3 mr-1" />Override</Badge>;
    } else if (dataSource === 'hybrid') {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Zap className="h-3 w-3 mr-1" />Hybrid</Badge>;
    } else {
      return <Badge variant="outline" className="border-green-500 text-green-600"><Zap className="h-3 w-3 mr-1" />Live</Badge>;
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

      {/* Data Source Stats */}
      {(dataSourceStats.database > 0 || dataSourceStats.hybrid > 0) && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">Database Integration Active</div>
                  <div className="text-sm text-muted-foreground">
                    Manual overrides and database tracking enabled
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <Badge variant="default" className="bg-blue-600">
                    <Database className="h-3 w-3 mr-1" />
                    {dataSourceStats.database}
                  </Badge>
                  <span className="text-muted-foreground">Overrides</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    <Zap className="h-3 w-3 mr-1" />
                    {dataSourceStats.hybrid}
                  </Badge>
                  <span className="text-muted-foreground">Hybrid</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    <Zap className="h-3 w-3 mr-1" />
                    {dataSourceStats.sleeper}
                  </Badge>
                  <span className="text-muted-foreground">Live</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                <strong>Total Conferences:</strong> {rawApiData.conferences.length}
              </div>
              <div className="text-sm">
                <strong>Total Matchups:</strong> {rawApiData.totalMatchups}
              </div>
              <div className="text-sm">
                <strong>Database Matchups:</strong> {rawApiData.databaseMatchups}
              </div>
              <div className="text-sm">
                <strong>Data Sources:</strong> DB: {rawApiData.dataSourceStats.database}, Hybrid: {rawApiData.dataSourceStats.hybrid}, Live: {rawApiData.dataSourceStats.sleeper}
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
                        {getDataSourceBadge(matchup.dataSource, matchup.isManualOverride)}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                      expandedMatchups.has(`${matchup.conference.id}-${matchup.matchup_id}`) ? 'rotate-180' : ''
                      }`} />
                    </div>
                    {matchup.isManualOverride && matchup.overrideNotes && (
                      <div className="text-xs text-left text-muted-foreground bg-blue-50 p-2 rounded">
                        <strong>Admin Note:</strong> {matchup.overrideNotes}
                      </div>
                    )}
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
                            <div className="text-sm text-muted-foreground">Data Source</div>
                            <div className="text-xs capitalize">{matchup.dataSource}</div>
                            {debugMode && matchup.rawData &&
                          <div className="text-xs text-muted-foreground mt-1">
                                Raw matchups: {matchup.rawData.matchupsData?.length || 0}
                                {matchup.rawData.dbOverride && 
                                  <div>DB Override: {matchup.rawData.dbOverride.id}</div>
                                }
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