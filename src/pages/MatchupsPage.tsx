import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { Swords, Clock, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MatchupCard from '@/components/matchups/MatchupCard';
import SleeperMatchupService from '@/services/sleeperMatchupService';

interface DatabaseMatchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
}

interface DatabaseTeam {
  id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  team_logo_url: string;
  team_primary_color: string;
  team_secondary_color: string;
}

interface DatabaseConference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
  status: string;
  league_logo_url: string;
}

interface TeamJunction {
  id: number;
  team_id: number;
  conference_id: number;
  roster_id: string;
  is_active: boolean;
}

interface ProcessedMatchup {
  matchupId: number;
  conference: string;
  team1: {
    id: number;
    name: string;
    owner: string;
    roster_id: number;
    points: number;
    starters: string[];
    players: string[];
    players_points?: {[key: string]: number;};
  };
  team2: {
    id: number;
    name: string;
    owner: string;
    roster_id: number;
    points: number;
    starters: string[];
    players: string[];
    players_points?: {[key: string]: number;};
  };
  week: number;
  status: 'live' | 'completed' | 'upcoming';
  isPlayoff: boolean;
}

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [matchups, setMatchups] = useState<ProcessedMatchup[]>([]);
  const [loading, setLoading] = useState(false);
  const [conferences, setConferences] = useState<DatabaseConference[]>([]);
  const [teams, setTeams] = useState<DatabaseTeam[]>([]);
  const [teamJunctions, setTeamJunctions] = useState<TeamJunction[]>([]);

  const sleeperService = SleeperMatchupService.getInstance();

  // Initialize current week
  useEffect(() => {
    const initializeCurrentWeek = async () => {
      try {
        const week = await sleeperService.getCurrentNFLWeek();
        setCurrentWeek(week);
        setSelectedWeek(week);
      } catch (error) {
        console.error('Error getting current week:', error);
        setCurrentWeek(1);
        setSelectedWeek(1);
      }
    };

    initializeCurrentWeek();
  }, []);

  // Load base data
  useEffect(() => {
    loadBaseData();
  }, [selectedSeason]);

  // Load matchups when filters change
  useEffect(() => {
    if (conferences.length > 0 && teams.length > 0 && teamJunctions.length > 0) {
      loadMatchups();
    }
  }, [selectedWeek, selectedConference, conferences, teams, teamJunctions]);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting base data loading process...');
      console.log('Selected season:', selectedSeason);

      // Step 1: Load conferences for selected season
      console.log('📋 Step 1: Loading conferences for season', selectedSeason);
      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        Filters: [
        {
          name: 'season_id',
          op: 'Equal',
          value: selectedSeason
        }]
      });

      if (conferencesResponse.error) {
        console.error('❌ Failed to load conferences:', conferencesResponse.error);
        throw new Error(`Failed to load conferences: ${conferencesResponse.error}`);
      }

      const conferenceData = conferencesResponse.data?.List || [];
      console.log('✅ Conferences loaded:', conferenceData.length, 'conferences');
      console.log('Conference details:', conferenceData.map(c => ({ id: c.id, name: c.conference_name, league_id: c.league_id })));
      setConferences(conferenceData);

      // Data validation: Check if we have conferences
      if (conferenceData.length === 0) {
        console.warn('⚠️ No conferences found for season', selectedSeason);
        toast({
          title: 'No Conferences Found',
          description: `No conferences found for the ${selectedSeason} season. Please check your data.`,
          variant: 'destructive'
        });
        return;
      }

      // Step 2: Load all teams
      console.log('👥 Step 2: Loading teams...');
      const teamsResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100
      });

      if (teamsResponse.error) {
        console.error('❌ Failed to load teams:', teamsResponse.error);
        throw new Error(`Failed to load teams: ${teamsResponse.error}`);
      }

      const teamData = teamsResponse.data?.List || [];
      console.log('✅ Teams loaded:', teamData.length, 'teams');
      console.log('Team details:', teamData.map(t => ({ id: t.id, name: t.team_name, owner: t.owner_name })));
      setTeams(teamData);

      // Data validation: Check if we have teams
      if (teamData.length === 0) {
        console.warn('⚠️ No teams found');
        toast({
          title: 'No Teams Found',
          description: 'No teams found in the database. Please add teams first.',
          variant: 'destructive'
        });
        return;
      }

      // Step 3: Load team-conference junctions
      console.log('🔗 Step 3: Loading team-conference junctions...');
      const junctionsResponse = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
        {
          name: 'is_active',
          op: 'Equal',
          value: true
        }]
      });

      if (junctionsResponse.error) {
        console.error('❌ Failed to load team junctions:', junctionsResponse.error);
        throw new Error(`Failed to load team junctions: ${junctionsResponse.error}`);
      }

      const junctionData = junctionsResponse.data?.List || [];
      console.log('✅ Team junctions loaded:', junctionData.length, 'junctions');
      console.log('Junction details:', junctionData.map(j => ({ 
        team_id: j.team_id, 
        conference_id: j.conference_id, 
        roster_id: j.roster_id,
        is_active: j.is_active 
      })));
      setTeamJunctions(junctionData);

      // Data validation: Check if we have junctions
      if (junctionData.length === 0) {
        console.warn('⚠️ No team-conference junctions found');
        toast({
          title: 'No Team Assignments Found',
          description: 'No teams are assigned to conferences. Please set up team assignments first.',
          variant: 'destructive'
        });
        return;
      }

      console.log('🎉 Base data loading completed successfully!');
      console.log('Summary:', {
        conferences: conferenceData.length,
        teams: teamData.length,
        junctions: junctionData.length
      });

    } catch (error) {
      console.error('💥 Critical error loading base data:', error);
      toast({
        title: 'Critical Error Loading Data',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while loading data.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMatchups = async () => {
    try {
      setLoading(true);
      console.log('🏈 Starting matchup loading process...');
      console.log('Current parameters:', {
        selectedWeek,
        selectedConference,
        conferencesCount: conferences.length,
        teamsCount: teams.length,
        junctionsCount: teamJunctions.length
      });

      // Data validation before processing
      if (conferences.length === 0) {
        console.error('❌ Cannot load matchups: No conferences available');
        toast({
          title: 'No Data Available',
          description: 'No conferences are loaded. Please refresh the page.',
          variant: 'destructive'
        });
        return;
      }

      if (teams.length === 0) {
        console.error('❌ Cannot load matchups: No teams available');
        toast({
          title: 'No Data Available',
          description: 'No teams are loaded. Please refresh the page.',
          variant: 'destructive'
        });
        return;
      }

      if (teamJunctions.length === 0) {
        console.error('❌ Cannot load matchups: No team junctions available');
        toast({
          title: 'No Data Available',
          description: 'No team assignments are loaded. Please refresh the page.',
          variant: 'destructive'
        });
        return;
      }

      // Build filters for matchup query
      const filters = [
      {
        name: 'week',
        op: 'Equal',
        value: selectedWeek
      }];

      console.log('🔍 Building conference filter...');
      console.log('Selected conference ID:', selectedConference);
      console.log('Available AppContext conferences:', currentSeasonConfig.conferences.map(c => ({ id: c.id, name: c.name, leagueId: c.leagueId })));

      if (selectedConference) {
        // Find the AppContext conference to get its leagueId
        const appContextConf = currentSeasonConfig.conferences.find((c) => c.id === selectedConference);
        console.log('Found AppContext conference:', appContextConf);
        
        if (appContextConf) {
          // FIXED: Use leagueId instead of id to match with database conference
          const selectedConf = conferences.find((c) => c.league_id === appContextConf.leagueId);
          console.log('Looking for database conference with league_id:', appContextConf.leagueId);
          console.log('Available database conferences:', conferences.map(c => ({ id: c.id, name: c.conference_name, league_id: c.league_id })));
          console.log('Found database conference:', selectedConf);
          
          if (selectedConf) {
            filters.push({
              name: 'conference_id',
              op: 'Equal',
              value: selectedConf.id
            });
            console.log('✅ Conference filter added:', selectedConf.id);
          } else {
            console.warn('⚠️ Database conference not found for leagueId:', appContextConf.leagueId);
            toast({
              title: 'Conference Mapping Issue',
              description: `Cannot find database conference for ${appContextConf.name}. Please check data synchronization.`,
              variant: 'destructive'
            });
            return;
          }
        } else {
          console.error('❌ AppContext conference not found for ID:', selectedConference);
          toast({
            title: 'Conference Not Found',
            description: 'Selected conference not found in current season config.',
            variant: 'destructive'
          });
          return;
        }
      }

      console.log('📄 Final query filters:', filters);

      // Query matchups from database
      console.log('📊 Querying matchups from database...');
      const matchupsResponse = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 100,
        Filters: filters
      });

      if (matchupsResponse.error) {
        console.error('❌ Database query failed:', matchupsResponse.error);
        throw new Error(`Database query failed: ${matchupsResponse.error}`);
      }

      const dbMatchups: DatabaseMatchup[] = matchupsResponse.data?.List || [];
      console.log('✅ Database matchups retrieved:', dbMatchups.length, 'matchups');
      console.log('Matchup details:', dbMatchups.map(m => ({
        id: m.id,
        conference_id: m.conference_id,
        week: m.week,
        team_1_id: m.team_1_id,
        team_2_id: m.team_2_id,
        is_playoff: m.is_playoff
      })));

      if (dbMatchups.length === 0) {
        console.warn('⚠️ No matchups found for the selected criteria');
        setMatchups([]);
        return;
      }

      // Process each matchup
      console.log('🔄 Processing matchups...');
      const processedMatchups: ProcessedMatchup[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const dbMatchup of dbMatchups) {
        try {
          console.log(`🔎 Processing matchup ${dbMatchup.id}...`);
          const processedMatchup = await processMatchup(dbMatchup);
          if (processedMatchup) {
            processedMatchups.push(processedMatchup);
            successCount++;
            console.log(`✅ Matchup ${dbMatchup.id} processed successfully`);
          } else {
            errorCount++;
            console.warn(`⚠️ Matchup ${dbMatchup.id} returned null - skipping`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing matchup ${dbMatchup.id}:`, error);
        }
      }

      console.log('📊 Processing summary:', {
        total: dbMatchups.length,
        successful: successCount,
        errors: errorCount,
        final: processedMatchups.length
      });

      setMatchups(processedMatchups);

      if (errorCount > 0) {
        toast({
          title: 'Partial Loading Success',
          description: `${successCount} of ${dbMatchups.length} matchups loaded successfully. ${errorCount} failed to load.`,
          variant: 'default'
        });
      } else {
        console.log('🎉 All matchups processed successfully!');
      }

    } catch (error) {
      console.error('💥 Critical error loading matchups:', error);
      toast({
        title: 'Critical Error Loading Matchups',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while loading matchups.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const processMatchup = async (dbMatchup: DatabaseMatchup): Promise<ProcessedMatchup | null> => {
    try {
      console.log(`  🔍 Processing matchup ${dbMatchup.id} details:`, {
        conference_id: dbMatchup.conference_id,
        team_1_id: dbMatchup.team_1_id,
        team_2_id: dbMatchup.team_2_id,
        week: dbMatchup.week,
        is_playoff: dbMatchup.is_playoff
      });

      // Step 1: Get conference info
      const conference = conferences.find((c) => c.id === dbMatchup.conference_id);
      if (!conference) {
        console.error(`  ❌ Conference not found for ID ${dbMatchup.conference_id}`);
        console.log('  Available conferences:', conferences.map(c => ({ id: c.id, name: c.conference_name })));
        return null;
      }
      console.log(`  ✅ Conference found: ${conference.conference_name} (ID: ${conference.id}, League ID: ${conference.league_id})`);

      // Step 2: Get team info
      const team1 = teams.find((t) => t.id === dbMatchup.team_1_id);
      const team2 = teams.find((t) => t.id === dbMatchup.team_2_id);

      if (!team1) {
        console.error(`  ❌ Team 1 not found for ID ${dbMatchup.team_1_id}`);
        console.log('  Available teams:', teams.map(t => ({ id: t.id, name: t.team_name })));
        return null;
      }
      if (!team2) {
        console.error(`  ❌ Team 2 not found for ID ${dbMatchup.team_2_id}`);
        console.log('  Available teams:', teams.map(t => ({ id: t.id, name: t.team_name })));
        return null;
      }
      console.log(`  ✅ Teams found: ${team1.team_name} vs ${team2.team_name}`);

      // Step 3: Get roster IDs from junctions
      console.log(`  🔗 Looking for team junctions in conference ${conference.id}...`);
      const team1Junction = teamJunctions.find((tj) =>
        tj.team_id === team1.id && tj.conference_id === conference.id && tj.is_active
      );
      const team2Junction = teamJunctions.find((tj) =>
        tj.team_id === team2.id && tj.conference_id === conference.id && tj.is_active
      );

      if (!team1Junction) {
        console.error(`  ❌ Team 1 junction not found for team ${team1.id} in conference ${conference.id}`);
        console.log('  Available junctions for this conference:', 
          teamJunctions.filter(tj => tj.conference_id === conference.id).map(tj => ({
            team_id: tj.team_id,
            roster_id: tj.roster_id,
            is_active: tj.is_active
          }))
        );
        return null;
      }
      if (!team2Junction) {
        console.error(`  ❌ Team 2 junction not found for team ${team2.id} in conference ${conference.id}`);
        console.log('  Available junctions for this conference:', 
          teamJunctions.filter(tj => tj.conference_id === conference.id).map(tj => ({
            team_id: tj.team_id,
            roster_id: tj.roster_id,
            is_active: tj.is_active
          }))
        );
        return null;
      }
      console.log(`  ✅ Team junctions found: ${team1.team_name} (roster ${team1Junction.roster_id}) vs ${team2.team_name} (roster ${team2Junction.roster_id})`);

      // Step 4: Get Sleeper matchup data
      console.log(`  🏈 Fetching Sleeper data for league ${conference.league_id}, week ${selectedWeek}...`);
      let sleeperMatchups = [];
      try {
        sleeperMatchups = await sleeperService.getMatchupData(conference.league_id, selectedWeek);
        console.log(`  ✅ Sleeper data retrieved: ${sleeperMatchups.length} rosters`);
        console.log('  Sleeper roster IDs:', sleeperMatchups.map(sm => sm.roster_id));
      } catch (sleeperError) {
        console.error(`  ❌ Sleeper API error:`, sleeperError);
        // Continue with empty data - we can still show the matchup structure
        console.log('  ⚠️ Continuing with empty Sleeper data...');
      }

      const team1SleeperData = sleeperMatchups.find((sm) => sm.roster_id.toString() === team1Junction.roster_id);
      const team2SleeperData = sleeperMatchups.find((sm) => sm.roster_id.toString() === team2Junction.roster_id);

      if (!team1SleeperData) {
        console.warn(`  ⚠️ No Sleeper data found for ${team1.team_name} (roster ${team1Junction.roster_id})`);
      } else {
        console.log(`  ✅ ${team1.team_name} Sleeper data: ${team1SleeperData.points || 0} points`);
      }
      
      if (!team2SleeperData) {
        console.warn(`  ⚠️ No Sleeper data found for ${team2.team_name} (roster ${team2Junction.roster_id})`);
      } else {
        console.log(`  ✅ ${team2.team_name} Sleeper data: ${team2SleeperData.points || 0} points`);
      }

      // Step 5: Determine status
      let status: 'live' | 'completed' | 'upcoming' = 'upcoming';
      if (selectedWeek < currentWeek) {
        status = 'completed';
      } else if (selectedWeek === currentWeek) {
        status = 'live';
      }
      console.log(`  📅 Matchup status: ${status} (week ${selectedWeek} vs current ${currentWeek})`);

      // Step 6: Build processed matchup
      const processedMatchup: ProcessedMatchup = {
        matchupId: dbMatchup.id,
        conference: conference.conference_name,
        team1: {
          id: team1.id,
          name: team1.team_name,
          owner: team1.owner_name,
          roster_id: parseInt(team1Junction.roster_id),
          points: team1SleeperData?.points || 0,
          starters: team1SleeperData?.starters || [],
          players: team1SleeperData?.players || [],
          players_points: team1SleeperData?.players_points
        },
        team2: {
          id: team2.id,
          name: team2.team_name,
          owner: team2.owner_name,
          roster_id: parseInt(team2Junction.roster_id),
          points: team2SleeperData?.points || 0,
          starters: team2SleeperData?.starters || [],
          players: team2SleeperData?.players || [],
          players_points: team2SleeperData?.players_points
        },
        week: dbMatchup.week,
        status,
        isPlayoff: dbMatchup.is_playoff
      };

      console.log(
        `  🎉 Matchup ${dbMatchup.id} processed successfully: ` +
        `${processedMatchup.team1.name} (${processedMatchup.team1.points}) vs ` +
        `${processedMatchup.team2.name} (${processedMatchup.team2.points})`
      );

      return processedMatchup;
    } catch (error) {
      console.error(`  💥 Critical error processing matchup ${dbMatchup.id}:`, error);
      return null;
    }
  };

  const refreshMatchups = async () => {
    console.log('🔄 Manual refresh triggered');
    toast({
      title: 'Refreshing Data',
      description: 'Loading latest matchup data from all sources...'
    });
    
    try {
      // First reload base data to ensure we have the latest
      await Promise.all([
        loadBaseData(),
        // Small delay to ensure base data is loaded first
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
      
      // Then reload matchups
      await loadMatchups();
      
      toast({
        title: 'Refresh Complete',
        description: 'All data has been updated successfully.'
      });
    } catch (error) {
      console.error('💥 Error during refresh:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh data. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const getWeekOptions = () => {
    const weeks = [];
    for (let i = 1; i <= 18; i++) {
      weeks.push({
        week: i,
        status: i < currentWeek ? 'completed' : i === currentWeek ? 'current' : 'upcoming'
      });
    }
    return weeks;
  };

  const getSelectedConferenceName = () => {
    if (!selectedConference) return 'All Conferences';
    const conf = currentSeasonConfig.conferences.find((c) => c.id === selectedConference);
    return conf?.name || 'All Conferences';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {selectedWeek} • {getSelectedConferenceName()}
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
              {getWeekOptions().map((week) =>
              <SelectItem key={week.week} value={week.week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week.week}</span>
                    {week.status === 'current' && <Badge variant="outline" className="text-xs">Current</Badge>}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshMatchups}
            disabled={loading}>

            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {selectedWeek === currentWeek &&
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Live Week</span>
            </div>
          }
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading &&
      <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading matchups...</span>
        </div>
      }

      {/* Matchups Grid */}
      {!loading &&
      <div className="grid gap-4">
          {matchups.map((matchup) =>
        <MatchupCard
          key={`${matchup.matchupId}-${matchup.week}`}
          matchupId={matchup.matchupId}
          conference={matchup.conference}
          team1={matchup.team1}
          team2={matchup.team2}
          week={matchup.week}
          status={matchup.status}
          isPlayoff={matchup.isPlayoff} />

        )}

          {matchups.length === 0 && !loading &&
        <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No matchups found for the selected filters.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try selecting a different week or conference.
                </p>
              </CardContent>
            </Card>
        }
        </div>
      }
    </div>);

};

export default MatchupsPage;