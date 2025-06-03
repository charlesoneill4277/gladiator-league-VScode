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
    players_points?: { [key: string]: number };
  };
  team2: {
    id: number;
    name: string;
    owner: string;
    roster_id: number;
    points: number;
    starters: string[];
    players: string[];
    players_points?: { [key: string]: number };
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

      // Load conferences for selected season
      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        Filters: [
          {
            name: 'season_id',
            op: 'Equal',
            value: selectedSeason
          }
        ]
      });

      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }

      const conferenceData = conferencesResponse.data?.List || [];
      setConferences(conferenceData);

      // Load all teams
      const teamsResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100
      });

      if (teamsResponse.error) {
        throw new Error(teamsResponse.error);
      }

      const teamData = teamsResponse.data?.List || [];
      setTeams(teamData);

      // Load team-conference junctions
      const junctionsResponse = await window.ezsite.apis.tablePage('12853', {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
          {
            name: 'is_active',
            op: 'Equal',
            value: true
          }
        ]
      });

      if (junctionsResponse.error) {
        throw new Error(junctionsResponse.error);
      }

      const junctionData = junctionsResponse.data?.List || [];
      setTeamJunctions(junctionData);

    } catch (error) {
      console.error('Error loading base data:', error);
      toast({
        title: 'Error Loading Data',
        description: 'Failed to load teams and conferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMatchups = async () => {
    try {
      setLoading(true);

      // Get matchups from database for selected week and conference
      const filters = [
        {
          name: 'week',
          op: 'Equal',
          value: selectedWeek
        }
      ];

      if (selectedConference) {
        const selectedConf = conferences.find(c => c.conference_name === selectedConference);
        if (selectedConf) {
          filters.push({
            name: 'conference_id',
            op: 'Equal',
            value: selectedConf.id
          });
        }
      }

      const matchupsResponse = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 100,
        Filters: filters
      });

      if (matchupsResponse.error) {
        throw new Error(matchupsResponse.error);
      }

      const dbMatchups: DatabaseMatchup[] = matchupsResponse.data?.List || [];
      
      // Process each matchup
      const processedMatchups: ProcessedMatchup[] = [];

      for (const dbMatchup of dbMatchups) {
        try {
          const processedMatchup = await processMatchup(dbMatchup);
          if (processedMatchup) {
            processedMatchups.push(processedMatchup);
          }
        } catch (error) {
          console.error(`Error processing matchup ${dbMatchup.id}:`, error);
        }
      }

      setMatchups(processedMatchups);

    } catch (error) {
      console.error('Error loading matchups:', error);
      toast({
        title: 'Error Loading Matchups',
        description: 'Failed to load matchup data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const processMatchup = async (dbMatchup: DatabaseMatchup): Promise<ProcessedMatchup | null> => {
    try {
      // Get conference info
      const conference = conferences.find(c => c.id === dbMatchup.conference_id);
      if (!conference) {
        console.error(`Conference not found for ID ${dbMatchup.conference_id}`);
        return null;
      }

      // Get team info
      const team1 = teams.find(t => t.id === dbMatchup.team_1_id);
      const team2 = teams.find(t => t.id === dbMatchup.team_2_id);
      
      if (!team1 || !team2) {
        console.error(`Teams not found: ${dbMatchup.team_1_id}, ${dbMatchup.team_2_id}`);
        return null;
      }

      // Get roster IDs from junctions
      const team1Junction = teamJunctions.find(tj => 
        tj.team_id === team1.id && tj.conference_id === conference.id && tj.is_active
      );
      const team2Junction = teamJunctions.find(tj => 
        tj.team_id === team2.id && tj.conference_id === conference.id && tj.is_active
      );

      if (!team1Junction || !team2Junction) {
        console.error(`Team junctions not found for teams ${team1.id}, ${team2.id} in conference ${conference.id}`);
        return null;
      }

      // Get Sleeper matchup data
      const sleeperMatchups = await sleeperService.getMatchupData(conference.league_id, selectedWeek);
      
      const team1SleeperData = sleeperMatchups.find(sm => sm.roster_id.toString() === team1Junction.roster_id);
      const team2SleeperData = sleeperMatchups.find(sm => sm.roster_id.toString() === team2Junction.roster_id);

      // Determine status
      let status: 'live' | 'completed' | 'upcoming' = 'upcoming';
      if (selectedWeek < currentWeek) {
        status = 'completed';
      } else if (selectedWeek === currentWeek) {
        status = 'live';
      }

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

      return processedMatchup;
    } catch (error) {
      console.error('Error processing matchup:', error);
      return null;
    }
  };

  const refreshMatchups = () => {
    loadMatchups();
    toast({
      title: 'Refreshing Matchups',
      description: 'Loading latest matchup data...',
    });
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
    const conf = currentSeasonConfig.conferences.find(c => c.id === selectedConference);
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
              {getWeekOptions().map((week) => (
                <SelectItem key={week.week} value={week.week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week.week}</span>
                    {week.status === 'current' && <Badge variant="outline" className="text-xs">Current</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshMatchups}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {selectedWeek === currentWeek && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Live Week</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{matchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading matchups...</span>
        </div>
      )}

      {/* Matchups Grid */}
      {!loading && (
        <div className="grid gap-4">
          {matchups.map((matchup) => (
            <MatchupCard
              key={`${matchup.matchupId}-${matchup.week}`}
              matchupId={matchup.matchupId}
              conference={matchup.conference}
              team1={matchup.team1}
              team2={matchup.team2}
              week={matchup.week}
              status={matchup.status}
              isPlayoff={matchup.isPlayoff}
            />
          ))}

          {matchups.length === 0 && !loading && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No matchups found for the selected filters.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try selecting a different week or conference.
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