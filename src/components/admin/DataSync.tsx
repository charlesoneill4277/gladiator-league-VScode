import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock, Database, Users, Trophy } from 'lucide-react';

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

const DataSync: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);
  const [progress, setProgress] = useState(0);
  const [teamsProgress, setTeamsProgress] = useState(0);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [teamsSyncResults, setTeamsSyncResults] = useState<TeamSyncResult[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastTeamsSyncTime, setLastTeamsSyncTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSeasons();
    loadLastSyncTime();
    loadLastTeamsSyncTime();
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

  const syncJunctionData = async () => {
    if (!selectedSeasonId || conferences.length === 0) {
      toast({
        title: "No Data to Sync",
        description: "Please select a season with conferences to sync junction data",
        variant: "destructive"
      });
      return;
    }

    setSyncingTeams(true);
    setTeamsProgress(0);
    setTeamsSyncResults([]);

    const results: TeamSyncResult[] = [];
    const total = conferences.length;

    for (let i = 0; i < conferences.length; i++) {
      const conference = conferences[i];
      setTeamsProgress((i + 1) / total * 100);

      try {
        console.log(`Syncing junction data for league ${conference.league_id}...`);

        // Fetch rosters data from Sleeper API
        const rostersResponse = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/rosters`);
        if (!rostersResponse.ok) {
          throw new Error(`Rosters API returned ${rostersResponse.status}: ${rostersResponse.statusText}`);
        }
        const rostersData = await rostersResponse.json();
        console.log('Rosters API response for junction sync:', rostersData);

        let junctionRecordsCreated = 0;

        // Process each roster to create junction records
        console.log(`Processing ${rostersData.length} rosters for league ${conference.league_id}`);

        for (const roster of rostersData) {
          const ownerId = roster.owner_id;

          // Validate roster_id before processing
          if (!roster.roster_id) {
            console.warn(`Roster has no roster_id, skipping:`, roster);
            continue;
          }

          if (!ownerId) {
            console.warn(`Roster ${roster.roster_id} has no owner_id, skipping`);
            continue;
          }

          // Find the team with this owner_id
          const { data: existingTeams, error: searchError } = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{
              name: 'owner_id',
              op: 'Equal',
              value: ownerId
            }]
          });

          if (searchError) {
            console.error(`Error searching for team with owner_id ${ownerId}:`, searchError);
            throw searchError;
          }

          if (existingTeams?.List?.length > 0) {
            const team = existingTeams.List[0];
            const teamId = team.id;

            // Create or update team-conference junction record
            const junctionData = {
              team_id: teamId,
              conference_id: conference.id,
              roster_id: roster.roster_id.toString(),
              is_active: true,
              joined_date: new Date().toISOString()
            };

            console.log(`Processing junction for team_id: ${teamId}, conference_id: ${conference.id}, roster_id: ${roster.roster_id}`);

            // Check if junction record already exists (including roster_id in the unique constraint)
            const { data: existingJunction, error: junctionSearchError } = await window.ezsite.apis.tablePage(12853, {
              PageNo: 1,
              PageSize: 1,
              Filters: [
              { name: 'team_id', op: 'Equal', value: teamId },
              { name: 'conference_id', op: 'Equal', value: conference.id },
              { name: 'roster_id', op: 'Equal', value: roster.roster_id.toString() }]

            });

            if (junctionSearchError) {
              console.error(`Error searching for junction record:`, junctionSearchError);
              throw junctionSearchError;
            }

            if (existingJunction?.List?.length > 0) {
              // Update existing junction record
              const existingRecord = existingJunction.List[0];
              const updateJunctionData = { ...junctionData, ID: existingRecord.ID };
              const { error: updateJunctionError } = await window.ezsite.apis.tableUpdate(12853, updateJunctionData);
              if (updateJunctionError) {
                console.error(`Error updating junction record ID ${existingRecord.ID}:`, updateJunctionError);
                throw updateJunctionError;
              }
              console.log(`Updated junction record ID ${existingRecord.ID} for team ${teamId} with roster_id ${roster.roster_id}`);
            } else {
              // Create new junction record
              const { error: createJunctionError } = await window.ezsite.apis.tableCreate(12853, junctionData);
              if (createJunctionError) {
                console.error(`Error creating junction record:`, createJunctionError);
                throw createJunctionError;
              }
              junctionRecordsCreated++;
              console.log(`✓ Created new junction record for team ${teamId} with roster_id ${roster.roster_id}`);
            }
          } else {
            console.warn(`⚠️ No team found for owner_id ${ownerId}, skipping roster ${roster.roster_id}`);
          }
        }

        results.push({
          league_id: conference.league_id,
          success: true,
          teams_created: 0,
          junction_records_created: junctionRecordsCreated
        });

        console.log(`✓ Successfully synced junction data for league ${conference.league_id}: ${junctionRecordsCreated} records created/updated from ${rostersData.length} rosters`);

      } catch (error) {
        console.error(`❌ Error syncing junction data for league ${conference.league_id}:`, error);
        results.push({
          league_id: conference.league_id,
          success: false,
          error: error.toString(),
          teams_created: 0,
          junction_records_created: 0
        });
      }

      // Small delay between requests to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setTeamsSyncResults(results);
    setSyncingTeams(false);
    setTeamsProgress(100);

    // Update last sync time
    const now = new Date().toISOString();
    localStorage.setItem('last_teams_sync', now);
    setLastTeamsSyncTime(new Date(now).toLocaleString());

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalJunctionCreated = results.reduce((sum, r) => sum + r.junction_records_created, 0);

    toast({
      title: "Junction Sync Complete",
      description: `${successCount} leagues synced, ${totalJunctionCreated} connections created/updated`,
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

    const results: TeamSyncResult[] = [];
    const total = conferences.length;

    for (let i = 0; i < conferences.length; i++) {
      const conference = conferences[i];
      setTeamsProgress((i + 1) / total * 100);

      try {
        console.log(`Syncing teams for league ${conference.league_id}...`);

        // Fetch users data from Sleeper API
        const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/users`);
        if (!usersResponse.ok) {
          throw new Error(`Users API returned ${usersResponse.status}: ${usersResponse.statusText}`);
        }
        const usersData = await usersResponse.json();
        console.log('Users API response:', usersData);

        // Fetch rosters data from Sleeper API
        const rostersResponse = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}/rosters`);
        if (!rostersResponse.ok) {
          throw new Error(`Rosters API returned ${rostersResponse.status}: ${rostersResponse.statusText}`);
        }
        const rostersData = await rostersResponse.json();
        console.log('Rosters API response:', rostersData);

        let teamsCreated = 0;
        let junctionRecordsCreated = 0;

        // Create a map of owner_id to roster data for easier lookup
        const rosterMap = new Map();
        rostersData.forEach((roster: any) => {
          if (roster.owner_id) {
            rosterMap.set(roster.owner_id, roster);
          }
        });

        console.log(`Processing ${rostersData.length} rosters for league ${conference.league_id}`);
        console.log('Roster owner IDs:', rostersData.map((r: any) => r.owner_id));
        console.log('User IDs:', usersData.map((u: any) => u.user_id));

        // Process each roster to ensure proper mapping
        for (const roster of rostersData) {
          const ownerId = roster.owner_id;

          // Validate roster_id before processing
          if (!roster.roster_id) {
            console.warn(`Roster has no roster_id, skipping:`, roster);
            continue;
          }

          if (!ownerId) {
            console.warn(`Roster ${roster.roster_id} has no owner_id, skipping`);
            continue;
          }

          // Find the corresponding user data
          const user = usersData.find((u: any) => u.user_id === ownerId);

          // Create or update team record
          const teamData = {
            team_name: user?.metadata?.team_name || user?.display_name || user?.username || `Team ${roster.roster_id}`,
            owner_name: user?.display_name || user?.username || `Owner ${ownerId}`,
            owner_id: ownerId,
            team_logo_url: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : '',
            team_primary_color: '#1f2937',
            team_secondary_color: '#6b7280'
          };

          console.log(`Processing team for owner_id: ${ownerId}, roster_id: ${roster.roster_id}`);

          // Check if team already exists by owner_id
          const { data: existingTeams, error: searchError } = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{
              name: 'owner_id',
              op: 'Equal',
              value: ownerId
            }]
          });

          if (searchError) {
            console.error(`Error searching for team with owner_id ${ownerId}:`, searchError);
            throw searchError;
          }

          let teamId;
          if (existingTeams?.List?.length > 0) {
            // Update existing team
            const existingTeam = existingTeams.List[0];
            const updateData = { ...teamData, ID: existingTeam.id };
            const { error: updateError } = await window.ezsite.apis.tableUpdate(12852, updateData);
            if (updateError) {
              console.error(`Error updating team ID ${existingTeam.ID}:`, updateError);
              throw updateError;
            }
            teamId = existingTeam.id;
            console.log(`Updated team ${teamId} for owner ${ownerId}`);
          } else {
            // Create new team
            const { data: newTeam, error: createError } = await window.ezsite.apis.tableCreate(12852, teamData);
            if (createError) {
              console.error(`Error creating team for owner ${ownerId}:`, createError);
              throw createError;
            }
            teamId = newTeam.ID;
            teamsCreated++;
            console.log(`✓ Created team ${teamId} for owner ${ownerId}`);
          }

          // Create or update team-conference junction record with roster_id
          const junctionData = {
            team_id: teamId,
            conference_id: conference.id,
            roster_id: roster.roster_id.toString(),
            is_active: true,
            joined_date: new Date().toISOString()
          };

          console.log(`Creating/updating junction record for team_id: ${teamId}, conference_id: ${conference.id}, roster_id: ${roster.roster_id}`);

          // Check if junction record already exists (including roster_id in the unique constraint)
          const { data: existingJunction, error: junctionSearchError } = await window.ezsite.apis.tablePage(12853, {
            PageNo: 1,
            PageSize: 1,
            Filters: [
            { name: 'team_id', op: 'Equal', value: teamId },
            { name: 'conference_id', op: 'Equal', value: conference.id },
            { name: 'roster_id', op: 'Equal', value: roster.roster_id.toString() }]

          });

          if (junctionSearchError) {
            console.error(`Error searching for junction record:`, junctionSearchError);
            throw junctionSearchError;
          }

          if (existingJunction?.List?.length > 0) {
            // Update existing junction record
            const existingRecord = existingJunction.List[0];
            const updateJunctionData = { ...junctionData, ID: existingRecord.ID };
            const { error: updateJunctionError } = await window.ezsite.apis.tableUpdate(12853, updateJunctionData);
            if (updateJunctionError) {
              console.error(`Error updating junction record ID ${existingRecord.ID}:`, updateJunctionError);
              throw updateJunctionError;
            }
            console.log(`Updated junction record ID ${existingRecord.ID} for team ${teamId} with roster_id ${roster.roster_id}`);
          } else {
            // Create new junction record
            const { error: createJunctionError } = await window.ezsite.apis.tableCreate(12853, junctionData);
            if (createJunctionError) {
              console.error(`Error creating junction record:`, createJunctionError);
              throw createJunctionError;
            }
            junctionRecordsCreated++;
            console.log(`✓ Created junction record for team ${teamId} with roster_id ${roster.roster_id}`);
          }
        }

        results.push({
          league_id: conference.league_id,
          success: true,
          teams_created: teamsCreated,
          junction_records_created: junctionRecordsCreated
        });

        console.log(`✓ Successfully synced teams for league ${conference.league_id}: ${teamsCreated} teams created, ${junctionRecordsCreated} junction records created from ${rostersData.length} rosters`);

      } catch (error) {
        console.error(`❌ Error syncing teams for league ${conference.league_id}:`, error);
        results.push({
          league_id: conference.league_id,
          success: false,
          error: error.toString(),
          teams_created: 0,
          junction_records_created: 0
        });
      }

      // Small delay between requests to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setTeamsSyncResults(results);
    setSyncingTeams(false);
    setTeamsProgress(100);

    // Update last sync time
    const now = new Date().toISOString();
    localStorage.setItem('last_teams_sync', now);
    setLastTeamsSyncTime(new Date(now).toLocaleString());

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalTeamsCreated = results.reduce((sum, r) => sum + r.teams_created, 0);
    const totalJunctionCreated = results.reduce((sum, r) => sum + r.junction_records_created, 0);

    toast({
      title: "Teams Sync Complete",
      description: `${successCount} leagues synced, ${totalTeamsCreated} teams created, ${totalJunctionCreated} connections created`,
      variant: failureCount > 0 ? "destructive" : "default"
    });
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
            Sync conference and team data from Sleeper API to update database records
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

          {selectedSeason && conferences.length === 0 &&
          <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No conferences found for {selectedSeason.season_name}. 
                Please add leagues in the League Manager tab first.
              </AlertDescription>
            </Alert>
          }

          {selectedSeason && conferences.length > 0 &&
          <Tabs defaultValue="conferences" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="conferences" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Conference Sync
                </TabsTrigger>
                <TabsTrigger value="teams" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teams Sync
                </TabsTrigger>
              </TabsList>

              <TabsContent value="conferences">
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
                          <Download className="h-4 w-4 mr-2" />
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
                        Conferences - {selectedSeason.season_name}
                      </CardTitle>
                      <CardDescription>
                        {conferences.length} conference{conferences.length !== 1 ? 's' : ''} ready for synchronization
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Conference Name</TableHead>
                            <TableHead>League ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Logo</TableHead>
                            <TableHead>Sync Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conferences.map((conference) => {
                          const syncResult = syncResults.find((r) => r.league_id === conference.league_id);

                          return (
                            <TableRow key={conference.id}>
                                <TableCell className="font-medium">
                                  {conference.conference_name}
                                </TableCell>
                                <TableCell>
                                  <code className="text-sm bg-muted px-2 py-1 rounded">
                                    {conference.league_id}
                                  </code>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                conference.status === 'in_season' ? 'default' :
                                conference.status === 'complete' ? 'secondary' :
                                'outline'
                                }>
                                    {conference.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {conference.league_logo_url ?
                                <img
                                  src={conference.league_logo_url}
                                  alt="League logo"
                                  className="w-8 h-8 rounded-full" /> :
                                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                      <span className="text-xs text-muted-foreground">?</span>
                                    </div>
                                }
                                </TableCell>
                                <TableCell>
                                  {syncResult ?
                                syncResult.success ?
                                <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="text-sm">Synced</span>
                                      </div> :
                                <div className="flex items-center gap-2 text-red-600">
                                        <AlertCircle className="h-4 w-4" />
                                        <span className="text-sm">Failed</span>
                                      </div> :
                                <span className="text-sm text-muted-foreground">Ready</span>
                                }
                                </TableCell>
                              </TableRow>);
                        })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {syncResults.length > 0 &&
                <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Conference Sync Results</CardTitle>
                        <CardDescription>
                          Detailed results from the last conference synchronization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {syncResults.map((result, index) =>
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                {result.success ?
                          <CheckCircle className="h-5 w-5 text-green-600" /> :
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          }
                                <code className="text-sm">{result.league_id}</code>
                              </div>
                              <div className="text-sm">
                                {result.success ?
                          <span className="text-green-600">Success</span> :
                          <span className="text-red-600">{result.error}</span>
                          }
                              </div>
                            </div>
                      )}
                        </div>
                      </CardContent>
                    </Card>
                }
                </div>
              </TabsContent>

              <TabsContent value="teams">
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
                    <div className="flex gap-2">
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
                            Sync Teams Data
                          </>
                      }
                      </Button>
                      <Button
                      variant="outline"
                      onClick={syncJunctionData}
                      disabled={syncingTeams || !selectedSeasonId || conferences.length === 0}>
                        {syncingTeams ?
                      <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </> :
                      <>
                            <Trophy className="h-4 w-4 mr-2" />
                            Fix Junction Data
                          </>
                      }
                      </Button>
                    </div>
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
                        Teams Synchronization - {selectedSeason.season_name}
                      </CardTitle>
                      <CardDescription>
                        Sync team data and roster connections from Sleeper API for {conferences.length} conference{conferences.length !== 1 ? 's' : ''}. Use "Fix Junction Data" if rosters aren't properly mapped.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            <h4 className="font-semibold">Teams Data</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Syncs team names, owner information, and team logos from the Sleeper users endpoint
                          </p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Trophy className="h-5 w-5 text-green-600" />
                            <h4 className="font-semibold">Team Connections</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Creates connections between teams and conferences using roster IDs from the Sleeper rosters endpoint. Use "Fix Junction Data" to re-sync just the roster mappings if teams already exist.
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Conferences to Sync:</h4>
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

                  {teamsSyncResults.length > 0 &&
                <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Teams Sync Results</CardTitle>
                        <CardDescription>
                          Detailed results from the last teams synchronization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {teamsSyncResults.map((result, index) =>
                      <div key={index} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  {result.success ?
                            <CheckCircle className="h-5 w-5 text-green-600" /> :
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            }
                                  <code className="text-sm">{result.league_id}</code>
                                </div>
                                <div className="text-sm">
                                  {result.success ?
                            <span className="text-green-600">Success</span> :
                            <span className="text-red-600">Failed</span>
                            }
                                </div>
                              </div>
                              {result.success &&
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>Teams created: {result.teams_created}</span>
                                  <span>Connections created: {result.junction_records_created}</span>
                                </div>
                        }
                              {result.error &&
                        <div className="text-sm text-red-600 mt-1">
                                  {result.error}
                                </div>
                        }
                            </div>
                      )}
                        </div>
                      </CardContent>
                    </Card>
                }
                </div>
              </TabsContent>
            </Tabs>
          }
        </CardContent>
      </Card>
    </div>);

};

export default DataSync;