import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock, Database, Users, Trophy, UserCheck, Target, Server, Calendar, Filter } from 'lucide-react';
import DraftService from '@/services/draftService';

interface Season {
  id: number;
  season_year: number;
  season_name: string;
  is_current_season: boolean;
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

interface SyncResult {
  league_id: string;
  success: boolean;
  error?: string;
  data?: any;
}

interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  co_owner_name?: string;
  co_owner_id?: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface TeamSyncResult {
  league_id: string;
  success: boolean;
  error?: string;
  teams_created: number;
  junction_records_created: number;
}

interface PlayerSyncResult {
  success: boolean;
  error?: string;
  players_created: number;
  players_updated: number;
}

interface MatchupSyncResult {
  success: boolean;
  error?: string;
  matchups_created: number;
  matchups_updated: number;
  leagues_processed: number;
  weeks_processed: number;
}

interface DraftSyncResult {
  success: boolean;
  error?: string;
  message: string;
  data?: any;
}

interface RosterSyncResult {
  success: boolean;
  error?: string;
  players_processed: number;
  rosters_created: number;
  rosters_updated: number;
  leagues_processed: number;
  weeks_processed: number;
}

const DataSync: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);
  const [syncingPlayers, setSyncingPlayers] = useState(false);
  const [syncingMatchups, setSyncingMatchups] = useState(false);
  const [syncingDraft, setSyncingDraft] = useState(false);
  const [syncingRosters, setSyncingRosters] = useState(false);
  const [progress, setProgress] = useState(0);
  const [teamsProgress, setTeamsProgress] = useState(0);
  const [playersProgress, setPlayersProgress] = useState(0);
  const [matchupsProgress, setMatchupsProgress] = useState(0);
  const [draftProgress, setDraftProgress] = useState(0);
  const [rostersProgress, setRostersProgress] = useState(0);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [teamsSyncResults, setTeamsSyncResults] = useState<TeamSyncResult[]>([]);
  const [playersSyncResult, setPlayersSyncResult] = useState<PlayerSyncResult | null>(null);
  const [matchupsSyncResult, setMatchupsSyncResult] = useState<MatchupSyncResult | null>(null);
  const [draftSyncResult, setDraftSyncResult] = useState<DraftSyncResult | null>(null);
  const [rostersSyncResult, setRostersSyncResult] = useState<RosterSyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastTeamsSyncTime, setLastTeamsSyncTime] = useState<string | null>(null);
  const [lastPlayersSyncTime, setLastPlayersSyncTime] = useState<string | null>(null);
  const [lastMatchupsSyncTime, setLastMatchupsSyncTime] = useState<string | null>(null);
  const [lastDraftSyncTime, setLastDraftSyncTime] = useState<string | null>(null);
  const [lastRostersSyncTime, setLastRostersSyncTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Player sync filters
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [selectedPositionFilter, setSelectedPositionFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Team Rosters sync filters
  const [rosterSyncMode, setRosterSyncMode] = useState<string>('all'); // 'all', 'range', 'specific'
  const [selectedStartWeek, setSelectedStartWeek] = useState<number>(1);
  const [selectedEndWeek, setSelectedEndWeek] = useState<number>(17);
  const [selectedSpecificWeeks, setSelectedSpecificWeeks] = useState<number[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadSeasons();
    loadLastSyncTime();
    loadLastTeamsSyncTime();
    loadLastPlayersSyncTime();
    loadLastMatchupsSyncTime();
    loadLastDraftSyncTime();
    loadLastRostersSyncTime();
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadConferences();
    }
  }, [selectedSeasonId]);

  const loadSeasons = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'season_year',
        IsAsc: false
      });

      if (error) throw error;

      const seasonsList = data?.List || [];
      setSeasons(seasonsList);

      // Auto-select current season or most recent
      const currentSeason = seasonsList.find((s: Season) => s.is_current_season);
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id);
      } else if (seasonsList.length > 0) {
        setSelectedSeasonId(seasonsList[0].id);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
      toast({
        title: "Error",
        description: `Failed to load seasons: ${error}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadConferences = async () => {
    if (!selectedSeasonId) return;

    try {
      const { data, error } = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: [
        {
          name: 'season_id',
          op: 'Equal',
          value: selectedSeasonId
        }]

      });

      if (error) throw error;
      setConferences(data?.List || []);
    } catch (error) {
      console.error('Error loading conferences:', error);
      toast({
        title: "Error",
        description: `Failed to load conferences: ${error}`,
        variant: "destructive"
      });
    }
  };

  const loadLastSyncTime = () => {
    const lastSync = localStorage.getItem('last_data_sync');
    if (lastSync) {
      setLastSyncTime(new Date(lastSync).toLocaleString());
    }
  };

  const loadLastTeamsSyncTime = () => {
    const lastSync = localStorage.getItem('last_teams_sync');
    if (lastSync) {
      setLastTeamsSyncTime(new Date(lastSync).toLocaleString());
    }
  };

  const loadLastPlayersSyncTime = () => {
    const lastSync = localStorage.getItem('last_players_sync');
    if (lastSync) {
      setLastPlayersSyncTime(new Date(lastSync).toLocaleString());
    }
  };

  const loadLastMatchupsSyncTime = () => {
    const lastSync = localStorage.getItem('last_matchups_sync');
    if (lastSync) {
      setLastMatchupsSyncTime(new Date(lastSync).toLocaleString());
    }
  };

  const loadLastDraftSyncTime = () => {
    const lastSync = localStorage.getItem('last_draft_sync');
    if (lastSync) {
      setLastDraftSyncTime(new Date(lastSync).toLocaleString());
    }
  };

  const loadLastRostersSyncTime = () => {
    const lastSync = localStorage.getItem('last_rosters_sync');
    if (lastSync) {
      setLastRostersSyncTime(new Date(lastSync).toLocaleString());
    }
  };

  const loadTeams = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true
      });

      if (error) throw error;
      setTeams(data?.List || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const getWeeksToProcess = (): number[] => {
    switch (rosterSyncMode) {
      case 'range':
        const weeks: number[] = [];
        for (let week = selectedStartWeek; week <= selectedEndWeek; week++) {
          weeks.push(week);
        }
        return weeks;
      case 'specific':
        return [...selectedSpecificWeeks];
      case 'all':
      default:
        return Array.from({ length: 17 }, (_, i) => i + 1); // weeks 1-17
    }
  };

  const handleSpecificWeekToggle = (week: number) => {
    setSelectedSpecificWeeks((prev) => {
      if (prev.includes(week)) {
        return prev.filter((w) => w !== week);
      } else {
        return [...prev, week].sort((a, b) => a - b);
      }
    });
  };

  const selectAllWeeks = () => {
    setSelectedSpecificWeeks(Array.from({ length: 17 }, (_, i) => i + 1));
  };

  const clearAllWeeks = () => {
    setSelectedSpecificWeeks([]);
  };

  // Validation for week range
  React.useEffect(() => {
    if (selectedStartWeek > selectedEndWeek) {
      setSelectedEndWeek(selectedStartWeek);
    }
  }, [selectedStartWeek, selectedEndWeek]);


  const syncRostersData = async () => {
    if (!selectedSeasonId || conferences.length === 0) {
      toast({
        title: "No Data to Sync",
        description: "Please select a season with conferences to sync rosters",
        variant: "destructive"
      });
      return;
    }

    const weeksToProcess = getWeeksToProcess();
    if (weeksToProcess.length === 0) {
      toast({
        title: "No Weeks Selected",
        description: "Please select at least one week to sync",
        variant: "destructive"
      });
      return;
    }

    setSyncingRosters(true);
    setRostersProgress(0);
    setRostersSyncResult(null);

    try {
      console.log('Starting team rosters sync from Sleeper API...');
      console.log(`Syncing weeks: ${weeksToProcess.join(', ')}`);
      setRostersProgress(5);

      let playersProcessed = 0;
      let rostersCreated = 0;
      let rostersUpdated = 0;
      let leaguesProcessed = 0;
      let weeksProcessed = 0;
      const totalOperations = conferences.length * weeksToProcess.length;
      let operationCount = 0;

      for (const conference of conferences) {
        try {
          console.log(`Processing rosters for league ${conference.league_id}...`);

          // Process selected weeks for this league
          for (const week of weeksToProcess) {

            try {
              console.log(`Fetching roster data for league ${conference.league_id}, week ${week}...`);

              // Fetch matchups data from Sleeper API to get roster information
              const response = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/matchups/${week}`);
              if (!response.ok) {
                if (response.status === 404) {
                  console.log(`No matchups found for league ${conference.league_id}, week ${week} (404 - may not exist yet)`);
                  continue;
                }
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
              }

              const matchupsData = await response.json();
              console.log(`Received ${matchupsData.length} roster entries for league ${conference.league_id}, week ${week}`);

              if (!Array.isArray(matchupsData) || matchupsData.length === 0) {
                console.log(`No matchup data available for league ${conference.league_id}, week ${week}`);
                continue;
              }

              // Process each roster entry
              for (const entry of matchupsData) {
                if (!entry.roster_id || !entry.players || !Array.isArray(entry.players)) {
                  console.warn('Skipping entry with missing roster_id or players array:', entry);
                  continue;
                }

                // Get team ID from roster ID using the junction table
                const teamId = await getTeamIdFromRosterId(entry.roster_id, conference.id);
                if (!teamId) {
                  console.warn(`Could not find team ID for roster_id ${entry.roster_id} in conference ${conference.id}`);
                  continue;
                }

                // Process each player in the roster
                for (const playerSleeperIdStr of entry.players) {
                  if (!playerSleeperIdStr) continue;

                  try {
                    // Find the player in our database by sleeper_player_id
                    const { data: existingPlayers, error: searchError } = await window.ezsite.apis.tablePage(12870, {
                      PageNo: 1,
                      PageSize: 1,
                      Filters: [{
                        name: 'sleeper_player_id',
                        op: 'Equal',
                        value: playerSleeperIdStr
                      }]
                    });

                    if (searchError) {
                      console.error(`Error searching for player ${playerSleeperIdStr}:`, searchError);
                      continue;
                    }

                    if (existingPlayers?.List?.length > 0) {
                      const player = existingPlayers.List[0];
                      const playerId = player.id;

                      // Check if roster record already exists
                      const { data: existingRoster, error: rosterSearchError } = await window.ezsite.apis.tablePage(27886, {
                        PageNo: 1,
                        PageSize: 1,
                        Filters: [
                        { name: 'team_id', op: 'Equal', value: teamId },
                        { name: 'player_id', op: 'Equal', value: playerId },
                        { name: 'season_id', op: 'Equal', value: selectedSeasonId },
                        { name: 'week', op: 'Equal', value: week }]

                      });

                      if (rosterSearchError) {
                        console.error('Error searching for existing roster record:', rosterSearchError);
                        continue;
                      }

                      const rosterData = {
                        team_id: teamId,
                        player_id: playerId,
                        season_id: selectedSeasonId,
                        week: week
                      };

                      if (existingRoster?.List?.length > 0) {
                        // Update existing roster record
                        const existingRecord = existingRoster.List[0];
                        const updateData = { ...rosterData, ID: existingRecord.id };
                        const { error: updateError } = await window.ezsite.apis.tableUpdate(27886, updateData);
                        if (updateError) {
                          console.error('Error updating roster record:', updateError);
                        } else {
                          rostersUpdated++;
                          playersProcessed++;
                        }
                      } else {
                        // Create new roster record
                        const { error: createError } = await window.ezsite.apis.tableCreate(27886, rosterData);
                        if (createError) {
                          console.error('Error creating roster record:', createError);
                        } else {
                          rostersCreated++;
                          playersProcessed++;
                        }
                      }
                    } else {
                      console.warn(`Player with sleeper_player_id ${playerSleeperIdStr} not found in database`);
                    }
                  } catch (error) {
                    console.error(`Error processing player ${playerSleeperIdStr}:`, error);
                  }
                }
              }

              weeksProcessed++;

              // Small delay between week requests
              await new Promise((resolve) => setTimeout(resolve, 100));

            } catch (error) {
              console.error(`Error processing week ${week} for league ${conference.league_id}:`, error);
            }

            // Update progress
            operationCount++;
            const progressPercent = 5 + operationCount / totalOperations * 90;
            setRostersProgress(progressPercent);
          }

          leaguesProcessed++;
          console.log(`✓ Completed processing rosters for league ${conference.league_id}`);

          // Small delay between league requests
          await new Promise((resolve) => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`Error processing league ${conference.league_id}:`, error);
        }
      }

      setRostersSyncResult({
        success: true,
        players_processed: playersProcessed,
        rosters_created: rostersCreated,
        rosters_updated: rostersUpdated,
        leagues_processed: leaguesProcessed,
        weeks_processed: weeksProcessed
      });

      console.log(`✓ Successfully synced rosters: ${rostersCreated} created, ${rostersUpdated} updated, ${playersProcessed} total player assignments`);

      // Update last sync time
      const now = new Date().toISOString();
      localStorage.setItem('last_rosters_sync', now);
      setLastRostersSyncTime(new Date(now).toLocaleString());

      toast({
        title: "Team Rosters Sync Complete",
        description: `${rostersCreated} rosters created, ${rostersUpdated} updated across ${leaguesProcessed} leagues`,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ Error syncing rosters:', error);
      setRostersSyncResult({
        success: false,
        error: error.toString(),
        players_processed: 0,
        rosters_created: 0,
        rosters_updated: 0,
        leagues_processed: 0,
        weeks_processed: 0
      });

      toast({
        title: "Team Rosters Sync Failed",
        description: `Failed to sync rosters: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSyncingRosters(false);
      setRostersProgress(100);
    }
  };

  // Helper function to get team_id from roster_id using the junction table
  const getTeamIdFromRosterId = async (rosterId: string, conferenceId: number): Promise<number | null> => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: 'roster_id', op: 'Equal', value: rosterId },
        { name: 'conference_id', op: 'Equal', value: conferenceId },
        { name: 'is_active', op: 'Equal', value: true }]

      });

      if (error) {
        console.error(`Error finding team for roster_id ${rosterId}:`, error);
        return null;
      }

      if (data?.List?.length > 0) {
        return data.List[0].team_id;
      }

      console.warn(`No team found for roster_id ${rosterId} in conference ${conferenceId}`);
      return null;
    } catch (error) {
      console.error(`Error in getTeamIdFromRosterId:`, error);
      return null;
    }
  };

  // [Keep all the other existing sync functions unchanged - syncConferenceData, syncTeamsData, etc.]
  const syncConferenceData = async () => {
    if (!selectedSeasonId || conferences.length === 0) {
      toast({
        title: "No Data to Sync",
        description: "Please select a season with conferences to sync",
        variant: "destructive"
      });
      return;
    }

    setSyncing(true);
    setProgress(0);
    setSyncResults([]);

    const results: SyncResult[] = [];
    const total = conferences.length;

    for (let i = 0; i < conferences.length; i++) {
      const conference = conferences[i];
      setProgress((i + 1) / total * 100);

      try {
        console.log(`Syncing league ${conference.league_id}...`);

        // Fetch data from Sleeper API
        const response = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}`);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const leagueData = await response.json();
        console.log('Sleeper API response:', leagueData);

        // Map the API data to our conference fields
        const updatedConference = {
          ID: conference.id,
          conference_name: leagueData.name || conference.conference_name,
          league_id: leagueData.league_id || conference.league_id,
          season_id: conference.season_id,
          draft_id: leagueData.draft_id || conference.draft_id,
          status: leagueData.status || conference.status,
          league_logo_url: leagueData.avatar ?
          `https://sleepercdn.com/avatars/thumbs/${leagueData.avatar}` :
          conference.league_logo_url
        };

        // Update the conference in the database
        const { error: updateError } = await window.ezsite.apis.tableUpdate(12820, updatedConference);

        if (updateError) throw updateError;

        results.push({
          league_id: conference.league_id,
          success: true,
          data: leagueData
        });

        console.log(`Successfully synced league ${conference.league_id}`);

      } catch (error) {
        console.error(`Error syncing league ${conference.league_id}:`, error);
        results.push({
          league_id: conference.league_id,
          success: false,
          error: error.toString()
        });
      }

      // Small delay between requests to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setSyncResults(results);
    setSyncing(false);
    setProgress(100);

    // Update last sync time
    const now = new Date().toISOString();
    localStorage.setItem('last_data_sync', now);
    setLastSyncTime(new Date(now).toLocaleString());

    // Reload conferences to show updated data
    loadConferences();

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    toast({
      title: "Data Sync Complete",
      description: `${successCount} successful, ${failureCount} failed`,
      variant: failureCount > 0 ? "destructive" : "default"
    });
  };

  const syncTeamsData = async () => {
    if (!selectedSeasonId || conferences.length === 0) {
      toast({
        title: "No Data to Sync",
        description: "Please select a season with conferences to sync teams",
        variant: "destructive"
      });
      return;
    }

    setSyncingTeams(true);
    setTeamsProgress(0);
    setTeamsSyncResults([]);

    try {
      console.log('Starting teams sync from Sleeper API...');
      setTeamsProgress(5);

      const results: TeamSyncResult[] = [];
      const total = conferences.length;
      let teamsCreated = 0;
      let junctionRecordsCreated = 0;

      for (let i = 0; i < conferences.length; i++) {
        const conference = conferences[i];
        setTeamsProgress(5 + i / total * 90);

        try {
          console.log(`Processing teams for league ${conference.league_id}...`);

          // Fetch league data from Sleeper API
          const [leagueData, rostersData, usersData] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${conference.league_id}`),
          fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/users`)]
          );

          if (!leagueData.ok || !rostersData.ok || !usersData.ok) {
            throw new Error(`API request failed for league ${conference.league_id}`);
          }

          const [league, rosters, users] = await Promise.all([
          leagueData.json(),
          rostersData.json(),
          usersData.json()]
          );

          console.log(`Fetched ${rosters.length} rosters and ${users.length} users for league ${conference.league_id}`);

          // Process each roster to create teams
          for (const roster of rosters) {
            const user = users.find((u) => u.user_id === roster.owner_id);
            if (!user) {
              console.warn(`No user found for roster ${roster.roster_id}`);
              continue;
            }

            const teamData = {
              team_name: user.metadata?.team_name || user.display_name || user.username,
              owner_name: user.display_name || user.username,
              owner_id: user.user_id,
              co_owner_name: '',
              co_owner_id: '',
              team_logo_url: user.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : '',
              team_primary_color: '#1f2937',
              team_secondary_color: '#6b7280'
            };

            // Check if team already exists
            const { data: existingTeam, error: searchError } = await window.ezsite.apis.tablePage(12852, {
              PageNo: 1,
              PageSize: 1,
              Filters: [{
                name: 'owner_id',
                op: 'Equal',
                value: user.user_id
              }]
            });

            if (searchError) {
              console.error(`Error searching for existing team:`, searchError);
              continue;
            }

            let teamId;
            if (existingTeam?.List?.length > 0) {
              // Update existing team
              const existingRecord = existingTeam.List[0];
              const updateData = { ...teamData, ID: existingRecord.id };
              const { error: updateError } = await window.ezsite.apis.tableUpdate(12852, updateData);
              if (updateError) {
                console.error('Error updating team:', updateError);
                continue;
              }
              teamId = existingRecord.id;
            } else {
              // Create new team
              const { error: createError } = await window.ezsite.apis.tableCreate(12852, teamData);
              if (createError) {
                console.error('Error creating team:', createError);
                continue;
              }

              // Get the newly created team ID
              const { data: newTeamData, error: newTeamError } = await window.ezsite.apis.tablePage(12852, {
                PageNo: 1,
                PageSize: 1,
                Filters: [{
                  name: 'owner_id',
                  op: 'Equal',
                  value: user.user_id
                }]
              });

              if (newTeamError || !newTeamData?.List?.length) {
                console.error('Error retrieving new team ID');
                continue;
              }

              teamId = newTeamData.List[0].id;
              teamsCreated++;
            }

            // Create or update junction record
            const junctionData = {
              team_id: teamId,
              conference_id: conference.id,
              roster_id: roster.roster_id.toString(),
              is_active: true,
              joined_date: new Date().toISOString()
            };

            const { data: existingJunction, error: junctionSearchError } = await window.ezsite.apis.tablePage(12853, {
              PageNo: 1,
              PageSize: 1,
              Filters: [
              { name: 'team_id', op: 'Equal', value: teamId },
              { name: 'conference_id', op: 'Equal', value: conference.id }]

            });

            if (junctionSearchError) {
              console.error('Error searching for existing junction:', junctionSearchError);
              continue;
            }

            if (existingJunction?.List?.length > 0) {
              // Update existing junction
              const existingRecord = existingJunction.List[0];
              const updateData = { ...junctionData, ID: existingRecord.id };
              const { error: updateError } = await window.ezsite.apis.tableUpdate(12853, updateData);
              if (updateError) {
                console.error('Error updating junction:', updateError);
              }
            } else {
              // Create new junction
              const { error: createError } = await window.ezsite.apis.tableCreate(12853, junctionData);
              if (createError) {
                console.error('Error creating junction:', createError);
              } else {
                junctionRecordsCreated++;
              }
            }
          }

          results.push({
            league_id: conference.league_id,
            success: true,
            teams_created: teamsCreated,
            junction_records_created: junctionRecordsCreated
          });

          console.log(`✓ Completed teams sync for league ${conference.league_id}`);

        } catch (error) {
          console.error(`Error syncing teams for league ${conference.league_id}:`, error);
          results.push({
            league_id: conference.league_id,
            success: false,
            error: error.toString(),
            teams_created: 0,
            junction_records_created: 0
          });
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      setTeamsSyncResults(results);
      setTeamsProgress(100);

      // Update last sync time
      const now = new Date().toISOString();
      localStorage.setItem('last_teams_sync', now);
      setLastTeamsSyncTime(new Date(now).toLocaleString());

      // Reload teams to show updated data
      loadTeams();

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      toast({
        title: "Teams Sync Complete",
        description: `${successCount} successful, ${failureCount} failed`,
        variant: failureCount > 0 ? "destructive" : "default"
      });

    } catch (error) {
      console.error('❌ Error syncing teams:', error);
      toast({
        title: "Teams Sync Failed",
        description: `Failed to sync teams: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSyncingTeams(false);
    }
  };

  const syncPlayersData = async () => {
    setSyncingPlayers(true);
    setPlayersProgress(0);
    setPlayersSyncResult(null);

    try {
      console.log('Starting players sync from Sleeper API...');
      setPlayersProgress(5);

      // Fetch all players from Sleeper API
      const response = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const playersData = await response.json();
      const playerIds = Object.keys(playersData);
      console.log(`Fetched ${playerIds.length} players from Sleeper API`);

      setPlayersProgress(20);

      let playersCreated = 0;
      let playersUpdated = 0;
      const total = playerIds.length;

      for (let i = 0; i < playerIds.length; i++) {
        const playerId = playerIds[i];
        const playerData = playersData[playerId];

        if (!playerData) continue;

        // Calculate progress
        const progress = 20 + i / total * 75;
        setPlayersProgress(progress);

        try {
          // Check if player already exists
          const { data: existingPlayer, error: searchError } = await window.ezsite.apis.tablePage(12870, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{
              name: 'sleeper_player_id',
              op: 'Equal',
              value: playerId
            }]
          });

          if (searchError) {
            console.error(`Error searching for player ${playerId}:`, searchError);
            continue;
          }

          const playerRecord = {
            sleeper_player_id: playerId,
            player_name: `${playerData.first_name || ''} ${playerData.last_name || ''}`.trim() || 'Unknown Player',
            position: playerData.position || 'UNK',
            team_id: 0, // Fantasy team ID - will be set when assigned to roster
            nfl_team: playerData.team || 'FA',
            jersey_number: playerData.jersey_number || 0,
            status: playerData.status || 'Active',
            injury_status: playerData.injury_status || 'Healthy',
            age: playerData.age || 0,
            height: playerData.height || '',
            weight: playerData.weight || 0,
            years_experience: playerData.years_exp || 0,
            depth_chart_position: playerData.depth_chart_position || 1,
            college: playerData.college || '',
            is_current_data: true,
            last_updated: new Date().toISOString(),
            data_version: 1
          };

          if (existingPlayer?.List?.length > 0) {
            // Update existing player
            const existingRecord = existingPlayer.List[0];
            const updateData = { ...playerRecord, ID: existingRecord.id };
            const { error: updateError } = await window.ezsite.apis.tableUpdate(12870, updateData);
            if (updateError) {
              console.error(`Error updating player ${playerId}:`, updateError);
            } else {
              playersUpdated++;
            }
          } else {
            // Create new player
            const { error: createError } = await window.ezsite.apis.tableCreate(12870, playerRecord);
            if (createError) {
              console.error(`Error creating player ${playerId}:`, createError);
            } else {
              playersCreated++;
            }
          }

        } catch (error) {
          console.error(`Error processing player ${playerId}:`, error);
        }

        // Small delay every 100 players to prevent rate limiting
        if (i % 100 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      setPlayersSyncResult({
        success: true,
        players_created: playersCreated,
        players_updated: playersUpdated
      });

      console.log(`✓ Successfully synced players: ${playersCreated} created, ${playersUpdated} updated`);

      // Update last sync time
      const now = new Date().toISOString();
      localStorage.setItem('last_players_sync', now);
      setLastPlayersSyncTime(new Date(now).toLocaleString());

      toast({
        title: "Players Sync Complete",
        description: `${playersCreated} players created, ${playersUpdated} updated`,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ Error syncing players:', error);
      setPlayersSyncResult({
        success: false,
        error: error.toString(),
        players_created: 0,
        players_updated: 0
      });

      toast({
        title: "Players Sync Failed",
        description: `Failed to sync players: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSyncingPlayers(false);
      setPlayersProgress(100);
    }
  };

  const syncMatchupsData = async () => {
    if (!selectedSeasonId || conferences.length === 0) {
      toast({
        title: "No Data to Sync",
        description: "Please select a season with conferences to sync matchups",
        variant: "destructive"
      });
      return;
    }

    setSyncingMatchups(true);
    setMatchupsProgress(0);
    setMatchupsSyncResult(null);

    try {
      console.log('Starting matchups sync from Sleeper API...');
      setMatchupsProgress(5);

      let matchupsCreated = 0;
      let matchupsUpdated = 0;
      let leaguesProcessed = 0;
      let weeksProcessed = 0;

      const totalOperations = conferences.length * 17; // 17 weeks per season
      let operationCount = 0;

      for (const conference of conferences) {
        try {
          console.log(`Processing matchups for league ${conference.league_id}...`);

          // Process all 17 weeks
          for (let week = 1; week <= 17; week++) {
            try {
              console.log(`Fetching matchups for league ${conference.league_id}, week ${week}...`);

              // Fetch matchups from Sleeper API
              const response = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/matchups/${week}`);
              if (!response.ok) {
                if (response.status === 404) {
                  console.log(`No matchups found for league ${conference.league_id}, week ${week} (404)`);
                  continue;
                }
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
              }

              const matchupsData = await response.json();
              console.log(`Received ${matchupsData.length} matchup entries for league ${conference.league_id}, week ${week}`);

              if (!Array.isArray(matchupsData) || matchupsData.length === 0) {
                console.log(`No matchup data available for league ${conference.league_id}, week ${week}`);
                continue;
              }

              // Group matchups by matchup_id
              const matchupGroups = new Map();
              matchupsData.forEach((entry) => {
                if (!matchupGroups.has(entry.matchup_id)) {
                  matchupGroups.set(entry.matchup_id, []);
                }
                matchupGroups.get(entry.matchup_id).push(entry);
              });

              // Process each matchup pair
              for (const [matchupId, matchupPair] of matchupGroups.entries()) {
                if (matchupPair.length !== 2) {
                  console.warn(`Skipping incomplete matchup ${matchupId} - only ${matchupPair.length} teams`);
                  continue;
                }

                const [team1Data, team2Data] = matchupPair;

                // Get team IDs from roster IDs
                const team1Id = await getTeamIdFromRosterId(team1Data.roster_id.toString(), conference.id);
                const team2Id = await getTeamIdFromRosterId(team2Data.roster_id.toString(), conference.id);

                if (!team1Id || !team2Id) {
                  console.warn(`Could not find team IDs for matchup ${matchupId}`);
                  continue;
                }

                // Determine winner
                let winnerId = 0;
                if (team1Data.points > team2Data.points) {
                  winnerId = team1Id;
                } else if (team2Data.points > team1Data.points) {
                  winnerId = team2Id;
                }

                const matchupData = {
                  conference_id: conference.id,
                  week: week,
                  team_1_id: team1Id,
                  team_2_id: team2Id,
                  is_playoff: week > 14, // Weeks 15-17 are typically playoffs
                  sleeper_matchup_id: matchupId.toString(),
                  team_1_score: team1Data.points || 0,
                  team_2_score: team2Data.points || 0,
                  winner_id: winnerId,
                  is_manual_override: false,
                  status: team1Data.points > 0 || team2Data.points > 0 ? 'complete' : 'pending',
                  matchup_date: new Date().toISOString(),
                  notes: ''
                };

                // Check if matchup already exists
                const { data: existingMatchup, error: searchError } = await window.ezsite.apis.tablePage(13329, {
                  PageNo: 1,
                  PageSize: 1,
                  Filters: [
                  { name: 'conference_id', op: 'Equal', value: conference.id },
                  { name: 'week', op: 'Equal', value: week },
                  { name: 'sleeper_matchup_id', op: 'Equal', value: matchupId.toString() }]

                });

                if (searchError) {
                  console.error('Error searching for existing matchup:', searchError);
                  continue;
                }

                if (existingMatchup?.List?.length > 0) {
                  // Update existing matchup
                  const existingRecord = existingMatchup.List[0];
                  const updateData = { ...matchupData, ID: existingRecord.id };
                  const { error: updateError } = await window.ezsite.apis.tableUpdate(13329, updateData);
                  if (updateError) {
                    console.error('Error updating matchup:', updateError);
                  } else {
                    matchupsUpdated++;
                  }
                } else {
                  // Create new matchup
                  const { error: createError } = await window.ezsite.apis.tableCreate(13329, matchupData);
                  if (createError) {
                    console.error('Error creating matchup:', createError);
                  } else {
                    matchupsCreated++;
                  }
                }
              }

              weeksProcessed++;

              // Small delay between week requests
              await new Promise((resolve) => setTimeout(resolve, 100));

            } catch (error) {
              console.error(`Error processing week ${week} for league ${conference.league_id}:`, error);
            }

            // Update progress
            operationCount++;
            const progressPercent = 5 + operationCount / totalOperations * 90;
            setMatchupsProgress(progressPercent);
          }

          leaguesProcessed++;
          console.log(`✓ Completed matchups sync for league ${conference.league_id}`);

          // Small delay between league requests
          await new Promise((resolve) => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`Error processing league ${conference.league_id}:`, error);
        }
      }

      setMatchupsSyncResult({
        success: true,
        matchups_created: matchupsCreated,
        matchups_updated: matchupsUpdated,
        leagues_processed: leaguesProcessed,
        weeks_processed: weeksProcessed
      });

      console.log(`✓ Successfully synced matchups: ${matchupsCreated} created, ${matchupsUpdated} updated`);

      // Update last sync time
      const now = new Date().toISOString();
      localStorage.setItem('last_matchups_sync', now);
      setLastMatchupsSyncTime(new Date(now).toLocaleString());

      toast({
        title: "Matchups Sync Complete",
        description: `${matchupsCreated} matchups created, ${matchupsUpdated} updated across ${leaguesProcessed} leagues`,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ Error syncing matchups:', error);
      setMatchupsSyncResult({
        success: false,
        error: error.toString(),
        matchups_created: 0,
        matchups_updated: 0,
        leagues_processed: 0,
        weeks_processed: 0
      });

      toast({
        title: "Matchups Sync Failed",
        description: `Failed to sync matchups: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSyncingMatchups(false);
      setMatchupsProgress(100);
    }
  };

  const syncDraftData = async () => {
    setSyncingDraft(true);
    setDraftProgress(0);
    setDraftSyncResult(null);

    try {
      console.log('Starting draft sync from Sleeper API...');
      setDraftProgress(5);

      const result = await DraftService.fetchAndStoreDraftResults();

      setDraftProgress(100);

      if (result.success) {
        setDraftSyncResult({
          success: true,
          message: result.message,
          data: result.data
        });

        // Update last sync time
        const now = new Date().toISOString();
        localStorage.setItem('last_draft_sync', now);
        setLastDraftSyncTime(new Date(now).toLocaleString());

        toast({
          title: "Draft Sync Complete",
          description: result.message,
          variant: "default"
        });
      } else {
        setDraftSyncResult({
          success: false,
          error: result.message,
          message: result.message
        });

        toast({
          title: "Draft Sync Failed",
          description: result.message,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('❌ Error syncing draft:', error);
      setDraftSyncResult({
        success: false,
        error: error.toString(),
        message: `Draft sync failed: ${error}`
      });

      toast({
        title: "Draft Sync Failed",
        description: `Failed to sync draft: ${error}`,
        variant: "destructive"
      });
    } finally {
      setSyncingDraft(false);
    }
  };

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>);

  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Synchronization
          </CardTitle>
          <CardDescription>
            Sync conference, team, and player data from Sleeper API to update database records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select
                  value={selectedSeasonId?.toString() || ''}
                  onValueChange={(value) => setSelectedSeasonId(parseInt(value))}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) =>
                    <SelectItem key={season.id} value={season.id.toString()}>
                        {season.season_name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {selectedSeason &&
          <>
            {conferences.length === 0 &&
            <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No conferences found for {selectedSeason.season_name}. 
                  Conference and Team sync require leagues to be added first, but Player sync can be performed independently.
                </AlertDescription>
              </Alert>
            }
            
            <Tabs defaultValue={conferences.length > 0 ? "conferences" : "players"} className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="conferences" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Conference Sync
                </TabsTrigger>
                <TabsTrigger value="teams" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teams Sync
                </TabsTrigger>
                <TabsTrigger value="matchups" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Matchups Sync
                </TabsTrigger>
                <TabsTrigger value="draft" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Draft Sync
                </TabsTrigger>
                <TabsTrigger value="rosters" className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Team Rosters
                </TabsTrigger>
                <TabsTrigger value="players" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Players Sync
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rosters">
                {conferences.length === 0 ?
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No conferences available for team rosters synchronization. Please add leagues in the League Manager tab first.
                    </AlertDescription>
                  </Alert> :

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {lastRostersSyncTime &&
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Last rosters sync: {lastRostersSyncTime}
                        </div>
                      }
                    </div>
                    <Button
                      onClick={syncRostersData}
                      disabled={syncingRosters || !selectedSeasonId || conferences.length === 0}>
                      {syncingRosters ?
                      <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </> :
                      <>
                          <Server className="h-4 w-4 mr-2" />
                          Sync Team Rosters
                        </>
                      }
                    </Button>
                  </div>

                  {/* Week Filtering Controls */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Week Filtering Options
                      </CardTitle>
                      <CardDescription>
                        Choose which weeks to sync for team rosters data
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Select value={rosterSyncMode} onValueChange={setRosterSyncMode}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select sync mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Weeks (1-17)</SelectItem>
                            <SelectItem value="range">Week Range</SelectItem>
                            <SelectItem value="specific">Specific Weeks</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {rosterSyncMode === 'range' &&
                        <div className="flex items-center gap-2">
                            <span className="text-sm">From week:</span>
                            <Select
                            value={selectedStartWeek.toString()}
                            onValueChange={(value) => setSelectedStartWeek(parseInt(value))}>

                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 17 }, (_, i) => i + 1).map((week) =>
                              <SelectItem key={week} value={week.toString()}>{week}</SelectItem>
                              )}
                              </SelectContent>
                            </Select>
                            <span className="text-sm">to week:</span>
                            <Select
                            value={selectedEndWeek.toString()}
                            onValueChange={(value) => setSelectedEndWeek(parseInt(value))}>

                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 17 }, (_, i) => i + 1).filter((week) => week >= selectedStartWeek).map((week) =>
                              <SelectItem key={week} value={week.toString()}>{week}</SelectItem>
                              )}
                              </SelectContent>
                            </Select>
                          </div>
                        }
                      </div>

                      {rosterSyncMode === 'specific' &&
                      <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={selectAllWeeks}
                            className="text-xs">

                              Select All
                            </Button>
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={clearAllWeeks}
                            className="text-xs">

                              Clear All
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {selectedSpecificWeeks.length} weeks selected
                            </span>
                          </div>
                          <div className="grid grid-cols-9 gap-2">
                            {Array.from({ length: 17 }, (_, i) => i + 1).map((week) =>
                          <div key={week} className="flex items-center space-x-1">
                                <Checkbox
                              id={`week-${week}`}
                              checked={selectedSpecificWeeks.includes(week)}
                              onCheckedChange={() => handleSpecificWeekToggle(week)} />

                                <label
                              htmlFor={`week-${week}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">

                                  {week}
                                </label>
                              </div>
                          )}
                          </div>
                        </div>
                      }

                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Sync Summary</span>
                        </div>
                        <div className="text-sm text-blue-700">
                          {(() => {
                            const weeks = getWeeksToProcess();
                            return `Will sync ${weeks.length} week${weeks.length !== 1 ? 's' : ''} (${weeks.join(', ')}) across ${conferences.length} conference${conferences.length !== 1 ? 's' : ''} = ${weeks.length * conferences.length} total operations`;
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>


                  {syncingRosters &&
                  <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Synchronizing team rosters...</span>
                        <span className="text-sm text-muted-foreground">{Math.round(rostersProgress)}%</span>
                      </div>
                      <Progress value={rostersProgress} className="w-full" />
                    </div>
                  }

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Team Rosters Synchronization - {selectedSeason.season_name}
                      </CardTitle>
                      <CardDescription>
                        Sync weekly team roster data from Sleeper API using matchups endpoint for {conferences.length} conference{conferences.length !== 1 ? 's' : ''} across selected weeks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Server className="h-5 w-5 text-blue-600" />
                            <h4 className="font-semibold">Roster Data</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Fetches weekly roster information including:
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Player assignments to teams by week</li>
                            <li>• Active roster compositions</li>
                            <li>• Team-player relationships over time</li>
                            <li>• Historical roster tracking</li>
                          </ul>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Database className="h-5 w-5 text-green-600" />
                            <h4 className="font-semibold">Data Mapping</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Uses existing data for accurate mapping:
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Maps roster_id to team_id via junction table</li>
                            <li>• Maps sleeper_player_id to player_id</li>
                            <li>• Creates weekly roster assignments</li>
                            <li>• Processes {conferences.length * 17} total operations</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2">Sync Process Overview:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-sm font-medium text-blue-800">Step 1: API Calls</div>
                            <div className="text-xs text-blue-600">Fetch matchups for each league & week</div>
                          </div>
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-sm font-medium text-yellow-800">Step 2: Data Mapping</div>
                            <div className="text-xs text-yellow-600">Map roster_id & player_id to database</div>
                          </div>
                          <div className="p-3 bg-green-50 border border-green-200 rounded">
                            <div className="text-sm font-medium text-green-800">Step 3: Store Rosters</div>
                            <div className="text-xs text-green-600">Save weekly roster assignments</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Conferences to Process:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {conferences.map((conference) =>
                          <div key={conference.id} className="flex items-center gap-2 p-2 border rounded">
                              <Badge variant="outline" className="text-xs">
                                {conference.league_id}
                              </Badge>
                              <span className="text-sm truncate">{conference.conference_name}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Total operations: {conferences.length} leagues × {getWeeksToProcess().length} weeks = {conferences.length * getWeeksToProcess().length} API calls
                        </div>
                      </div>
                      
                      <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Note:</strong> This sync processes team rosters for the selected weeks across all conferences using the matchups endpoint. 
                          The "players" array from each matchup entry contains all players on that team's roster for that specific week. 
                          Weeks that don't exist yet (future weeks) will be skipped automatically.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  {rostersSyncResult &&
                  <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Team Rosters Sync Results</CardTitle>
                        <CardDescription>
                          Results from the last team rosters synchronization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {rostersSyncResult.success ?
                            <CheckCircle className="h-5 w-5 text-green-600" /> :
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            }
                              <span className="font-medium">Team Rosters Synchronization</span>
                            </div>
                            <div className="text-sm">
                              {rostersSyncResult.success ?
                            <span className="text-green-600">Success</span> :
                            <span className="text-red-600">Failed</span>
                            }
                            </div>
                          </div>
                          {rostersSyncResult.success &&
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Created:</span>
                                <div className="text-lg font-semibold text-green-600">{rostersSyncResult.rosters_created}</div>
                              </div>
                              <div>
                                <span className="font-medium">Updated:</span>
                                <div className="text-lg font-semibold text-blue-600">{rostersSyncResult.rosters_updated}</div>
                              </div>
                              <div>
                                <span className="font-medium">Players:</span>
                                <div className="text-lg font-semibold text-purple-600">{rostersSyncResult.players_processed}</div>
                              </div>
                              <div>
                                <span className="font-medium">Leagues:</span>
                                <div className="text-lg font-semibold text-orange-600">{rostersSyncResult.leagues_processed}</div>
                              </div>
                              <div>
                                <span className="font-medium">Weeks:</span>
                                <div className="text-lg font-semibold text-teal-600">{rostersSyncResult.weeks_processed}</div>
                              </div>
                            </div>
                        }
                          {rostersSyncResult.error &&
                        <div className="text-sm text-red-600 mt-1">
                              {rostersSyncResult.error}
                            </div>
                        }
                        </div>
                      </CardContent>
                    </Card>
                  }
                </div>
                }
              </TabsContent>

              <TabsContent value="conferences">
                {conferences.length === 0 ?
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No conferences available. Please add leagues in the League Manager tab first.
                    </AlertDescription>
                  </Alert> :

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {lastSyncTime &&
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Last sync: {lastSyncTime}
                          </div>
                      }
                      </div>
                      <Button
                      onClick={syncConferenceData}
                      disabled={syncing || !selectedSeasonId || conferences.length === 0}>

                        {syncing ?
                      <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </> :

                      <>
                            <Trophy className="h-4 w-4 mr-2" />
                            Sync Conference Data
                          </>
                      }
                      </Button>
                    </div>

                    {syncing &&
                  <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Synchronizing conferences...</span>
                          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                      </div>
                  }

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Conference Synchronization - {selectedSeason?.season_name}
                        </CardTitle>
                        <CardDescription>
                          Sync conference data from Sleeper API to update league information
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2">Conferences to Process:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {conferences.map((conference) =>
                          <div key={conference.id} className="flex items-center gap-2 p-2 border rounded">
                                <Badge variant="outline" className="text-xs">
                                  {conference.league_id}
                                </Badge>
                                <span className="text-sm truncate">{conference.conference_name}</span>
                              </div>
                          )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {syncResults.length > 0 &&
                  <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Sync Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>League ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {syncResults.map((result, index) =>
                          <TableRow key={index}>
                                  <TableCell className="font-medium">{result.league_id}</TableCell>
                                  <TableCell>
                                    {result.success ?
                              <Badge variant="default">Success</Badge> :

                              <Badge variant="destructive">Failed</Badge>
                              }
                                  </TableCell>
                                  <TableCell>
                                    {result.success ?
                              <span className="text-green-600">Updated successfully</span> :

                              <span className="text-red-600">{result.error}</span>
                              }
                                  </TableCell>
                                </TableRow>
                          )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                  }
                  </div>
                }
              </TabsContent>

              <TabsContent value="teams">
                {conferences.length === 0 ?
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No conferences available for team synchronization. Please add leagues in the League Manager tab first.
                    </AlertDescription>
                  </Alert> :

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {lastTeamsSyncTime &&
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Last teams sync: {lastTeamsSyncTime}
                          </div>
                      }
                      </div>
                      <Button
                      onClick={syncTeamsData}
                      disabled={syncingTeams || !selectedSeasonId || conferences.length === 0}>

                        {syncingTeams ?
                      <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </> :

                      <>
                            <Users className="h-4 w-4 mr-2" />
                            Sync Teams
                          </>
                      }
                      </Button>
                    </div>

                    {syncingTeams &&
                  <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Synchronizing teams...</span>
                          <span className="text-sm text-muted-foreground">{Math.round(teamsProgress)}%</span>
                        </div>
                        <Progress value={teamsProgress} className="w-full" />
                      </div>
                  }

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Teams Synchronization - {selectedSeason?.season_name}
                        </CardTitle>
                        <CardDescription>
                          Sync team data from Sleeper API including owners, team names, and roster mappings
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-5 w-5 text-blue-600" />
                              <h4 className="font-semibold">Team Data</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Creates teams and junction records:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• Team names and owner information</li>
                              <li>• Avatar/logo URLs</li>
                              <li>• Roster ID mappings</li>
                              <li>• Conference relationships</li>
                            </ul>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Database className="h-5 w-5 text-green-600" />
                              <h4 className="font-semibold">Data Structure</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Updates database tables:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• Teams table (team info)</li>
                              <li>• Junction table (team-conference mapping)</li>
                              <li>• Roster ID associations</li>
                              <li>• Active status tracking</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {teamsSyncResults.length > 0 &&
                  <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Teams Sync Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>League ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Teams Created</TableHead>
                                <TableHead>Junction Records</TableHead>
                                <TableHead>Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {teamsSyncResults.map((result, index) =>
                          <TableRow key={index}>
                                  <TableCell className="font-medium">{result.league_id}</TableCell>
                                  <TableCell>
                                    {result.success ?
                              <Badge variant="default">Success</Badge> :

                              <Badge variant="destructive">Failed</Badge>
                              }
                                  </TableCell>
                                  <TableCell>
                                    {result.success ? result.teams_created : 0}
                                  </TableCell>
                                  <TableCell>
                                    {result.success ? result.junction_records_created : 0}
                                  </TableCell>
                                  <TableCell>
                                    {result.success ?
                              <span className="text-green-600">Updated successfully</span> :

                              <span className="text-red-600">{result.error}</span>
                              }
                                  </TableCell>
                                </TableRow>
                          )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                  }
                  </div>
                }
              </TabsContent>

              <TabsContent value="matchups">
                {conferences.length === 0 ?
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No conferences available for matchup synchronization. Please add leagues in the League Manager tab first.
                    </AlertDescription>
                  </Alert> :

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {lastMatchupsSyncTime &&
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Last matchups sync: {lastMatchupsSyncTime}
                          </div>
                      }
                      </div>
                      <Button
                      onClick={syncMatchupsData}
                      disabled={syncingMatchups || !selectedSeasonId || conferences.length === 0}>

                        {syncingMatchups ?
                      <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </> :

                      <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync Matchups
                          </>
                      }
                      </Button>
                    </div>

                    {syncingMatchups &&
                  <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Synchronizing matchups...</span>
                          <span className="text-sm text-muted-foreground">{Math.round(matchupsProgress)}%</span>
                        </div>
                        <Progress value={matchupsProgress} className="w-full" />
                      </div>
                  }

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Matchups Synchronization - {selectedSeason?.season_name}
                        </CardTitle>
                        <CardDescription>
                          Sync matchup data from Sleeper API for all weeks across all conferences
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <RefreshCw className="h-5 w-5 text-blue-600" />
                              <h4 className="font-semibold">Matchup Data</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Processes matchup information:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• Team matchups for all weeks</li>
                              <li>• Scores and results</li>
                              <li>• Winner determination</li>
                              <li>• Playoff vs regular season</li>
                            </ul>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-5 w-5 text-green-600" />
                              <h4 className="font-semibold">Season Coverage</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Covers the entire season:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• Weeks 1-17 for each conference</li>
                              <li>• Regular season and playoffs</li>
                              <li>• {conferences.length * 17} total operations</li>
                              <li>• Automatic status detection</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {matchupsSyncResult &&
                  <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Matchups Sync Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                {matchupsSyncResult.success ?
                            <CheckCircle className="h-5 w-5 text-green-600" /> :

                            <AlertCircle className="h-5 w-5 text-red-600" />
                            }
                                <span className="font-medium">Matchups Synchronization</span>
                              </div>
                              <div className="text-sm">
                                {matchupsSyncResult.success ?
                            <span className="text-green-600">Success</span> :

                            <span className="text-red-600">Failed</span>
                            }
                              </div>
                            </div>
                            {matchupsSyncResult.success &&
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                                <div>
                                  <span className="font-medium">Created:</span>
                                  <div className="text-lg font-semibold text-green-600">{matchupsSyncResult.matchups_created}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Updated:</span>
                                  <div className="text-lg font-semibold text-blue-600">{matchupsSyncResult.matchups_updated}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Leagues:</span>
                                  <div className="text-lg font-semibold text-orange-600">{matchupsSyncResult.leagues_processed}</div>
                                </div>
                                <div>
                                  <span className="font-medium">Weeks:</span>
                                  <div className="text-lg font-semibold text-purple-600">{matchupsSyncResult.weeks_processed}</div>
                                </div>
                              </div>
                        }
                            {matchupsSyncResult.error &&
                        <div className="text-sm text-red-600 mt-1">
                                {matchupsSyncResult.error}
                              </div>
                        }
                          </div>
                        </CardContent>
                      </Card>
                  }
                  </div>
                }
              </TabsContent>

              <TabsContent value="draft">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {lastDraftSyncTime &&
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Last draft sync: {lastDraftSyncTime}
                        </div>
                      }
                    </div>
                    <Button
                      onClick={syncDraftData}
                      disabled={syncingDraft}>

                      {syncingDraft ?
                      <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </> :

                      <>
                          <Target className="h-4 w-4 mr-2" />
                          Sync Draft Results
                        </>
                      }
                    </Button>
                  </div>

                  {syncingDraft &&
                  <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Synchronizing draft results...</span>
                        <span className="text-sm text-muted-foreground">{Math.round(draftProgress)}%</span>
                      </div>
                      <Progress value={draftProgress} className="w-full" />
                    </div>
                  }

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Draft Results Synchronization
                      </CardTitle>
                      <CardDescription>
                        Sync draft results from Sleeper API for all conferences and seasons
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-5 w-5 text-blue-600" />
                            <h4 className="font-semibold">Draft Data</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Processes draft information:
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Draft picks by round and position</li>
                            <li>• Player information and positions</li>
                            <li>• Team assignments</li>
                            <li>• Historical draft tracking</li>
                          </ul>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Database className="h-5 w-5 text-green-600" />
                            <h4 className="font-semibold">Data Processing</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Updates draft results table:
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Maps roster IDs to team IDs</li>
                            <li>• Processes all conferences</li>
                            <li>• Handles multiple seasons</li>
                            <li>• Clears and refreshes data</li>
                          </ul>
                        </div>
                      </div>
                      
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Note:</strong> This sync processes draft results for all conferences and seasons. 
                          It will clear existing draft data and repopulate it with the latest information from Sleeper API.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  {draftSyncResult &&
                  <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Draft Sync Results</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {draftSyncResult.success ?
                            <CheckCircle className="h-5 w-5 text-green-600" /> :

                            <AlertCircle className="h-5 w-5 text-red-600" />
                            }
                              <span className="font-medium">Draft Synchronization</span>
                            </div>
                            <div className="text-sm">
                              {draftSyncResult.success ?
                            <span className="text-green-600">Success</span> :

                            <span className="text-red-600">Failed</span>
                            }
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {draftSyncResult.message}
                          </div>
                          {draftSyncResult.error &&
                        <div className="text-sm text-red-600 mt-1">
                              {draftSyncResult.error}
                            </div>
                        }
                        </div>
                      </CardContent>
                    </Card>
                  }
                </div>
              </TabsContent>

              <TabsContent value="players">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {lastPlayersSyncTime &&
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Last players sync: {lastPlayersSyncTime}
                        </div>
                      }
                    </div>
                    <Button
                      onClick={syncPlayersData}
                      disabled={syncingPlayers}>

                      {syncingPlayers ?
                      <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </> :

                      <>
                          <UserCheck className="h-4 w-4 mr-2" />
                          Sync Players
                        </>
                      }
                    </Button>
                  </div>

                  {syncingPlayers &&
                  <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Synchronizing players...</span>
                        <span className="text-sm text-muted-foreground">{Math.round(playersProgress)}%</span>
                      </div>
                      <Progress value={playersProgress} className="w-full" />
                    </div>
                  }

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Players Synchronization
                      </CardTitle>
                      <CardDescription>
                        Sync all NFL players data from Sleeper API - this operation is independent of conferences
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <UserCheck className="h-5 w-5 text-blue-600" />
                            <h4 className="font-semibold">Player Data</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Syncs comprehensive player information:
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Names and positions</li>
                            <li>• NFL team affiliations</li>
                            <li>• Physical attributes</li>
                            <li>• Injury status</li>
                            <li>• College and experience</li>
                          </ul>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Database className="h-5 w-5 text-green-600" />
                            <h4 className="font-semibold">Data Management</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Updates player database:
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Creates new player records</li>
                            <li>• Updates existing player info</li>
                            <li>• Maintains Sleeper ID mappings</li>
                            <li>• Processes thousands of players</li>
                          </ul>
                        </div>
                      </div>
                      
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Note:</strong> This sync processes all NFL players from Sleeper API. 
                          It can take several minutes to complete and will update or create thousands of player records.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  {playersSyncResult &&
                  <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Players Sync Results</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {playersSyncResult.success ?
                            <CheckCircle className="h-5 w-5 text-green-600" /> :

                            <AlertCircle className="h-5 w-5 text-red-600" />
                            }
                              <span className="font-medium">Players Synchronization</span>
                            </div>
                            <div className="text-sm">
                              {playersSyncResult.success ?
                            <span className="text-green-600">Success</span> :

                            <span className="text-red-600">Failed</span>
                            }
                            </div>
                          </div>
                          {playersSyncResult.success &&
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Created:</span>
                                <div className="text-lg font-semibold text-green-600">{playersSyncResult.players_created}</div>
                              </div>
                              <div>
                                <span className="font-medium">Updated:</span>
                                <div className="text-lg font-semibold text-blue-600">{playersSyncResult.players_updated}</div>
                              </div>
                            </div>
                        }
                          {playersSyncResult.error &&
                        <div className="text-sm text-red-600 mt-1">
                              {playersSyncResult.error}
                            </div>
                        }
                        </div>
                      </CardContent>
                    </Card>
                  }
                </div>
              </TabsContent>

            </Tabs>
          </>
          }
        </CardContent>
      </Card>
    </div>);

};

export default DataSync;