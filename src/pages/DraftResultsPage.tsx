import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Shield, Trophy, Target, Users, RefreshCw, AlertCircle } from 'lucide-react';

interface DraftPick {
  id: number;
  season_id: number;
  conference_id: number;
  round: number;
  draft_slot: number;
  pick_number: number;
  owner_id: string;
  player_id: string;
}

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
}

interface Season {
  id: number;
  season_year: number;
  season_name: string;
  is_current_season: boolean;
}

interface ProcessedDraftPick extends DraftPick {
  player_name?: string;
  position?: string;
  nfl_team?: string;
  conference_name?: string;
  owner_name?: string;
}

const DraftResultsPage: React.FC = () => {
  const { selectedSeason, selectedConference } = useApp();
  const { toast } = useToast();
  
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'board' | 'team'>('board');
  const [loading, setLoading] = useState(true);
  const [draftPicks, setDraftPicks] = useState<ProcessedDraftPick[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, any>>({});
  const [teams, setTeams] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadDraftData();
    }
  }, [selectedSeason, selectedConference]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load seasons
      const { data: seasonsData, error: seasonsError } = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "season_year",
        IsAsc: false
      });

      if (seasonsError) throw seasonsError;
      setSeasons(seasonsData?.List || []);

      // Load conferences
      const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "conference_name",
        IsAsc: true
      });

      if (conferencesError) throw conferencesError;
      setConferences(conferencesData?.List || []);

      // Load teams for owner mapping
      const { data: teamsData, error: teamsError } = await window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: "team_name",
        IsAsc: true
      });

      if (teamsError) throw teamsError;
      setTeams(teamsData?.List || []);

      // Load players data for mapping
      try {
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (response.ok) {
          const playersData = await response.json();
          setAllPlayers(playersData);
        }
      } catch (error) {
        console.warn('Could not load players data from Sleeper API:', error);
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: "Error",
        description: `Failed to load initial data: ${error}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDraftData = async () => {
    if (!selectedSeason) return;

    setRefreshing(true);
    try {
      console.log(`Loading draft data for season ${selectedSeason}, conference: ${selectedConference || 'all'}`);

      // Get the season ID for the selected season year
      const season = seasons.find(s => s.season_year === selectedSeason);
      if (!season) {
        console.warn(`Season ${selectedSeason} not found in database`);
        setDraftPicks([]);
        return;
      }

      // Build filters
      const filters = [
        { name: "season_id", op: "Equal", value: season.id }
      ];

      // Add conference filter if specific conference is selected
      if (selectedConference) {
        const contextConferenceMap = {
          'mars': 'The Legions of Mars',
          'jupiter': 'The Guardians of Jupiter', 
          'vulcan': "Vulcan's Oathsworn"
        };
        
        const targetConferenceName = contextConferenceMap[selectedConference];
        if (targetConferenceName) {
          const conference = conferences.find(c => 
            c.season_id === season.id && c.conference_name === targetConferenceName
          );
          if (conference) {
            filters.push({ name: "conference_id", op: "Equal", value: conference.id });
          }
        }
      }

      console.log('Draft query filters:', filters);

      // Fetch draft picks
      const { data: draftData, error: draftError } = await window.ezsite.apis.tablePage(27845, {
        PageNo: 1,
        PageSize: 1000, // Get all draft picks
        OrderByField: "pick_number",
        IsAsc: true,
        Filters: filters
      });

      if (draftError) throw draftError;

      console.log(`Loaded ${draftData?.List?.length || 0} draft picks`);

      // Process and enhance draft picks with additional information
      const picks = draftData?.List || [];
      const processedPicks = picks.map((pick: DraftPick) => {
        // Find conference name
        const conference = conferences.find(c => c.id === pick.conference_id);
        
        // Find player information
        const player = allPlayers[pick.player_id];
        
        // Find team/owner information
        const team = teams.find(t => t.owner_id === pick.owner_id);

        return {
          ...pick,
          conference_name: conference?.conference_name || 'Unknown Conference',
          player_name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : 'Unknown Player',
          position: player?.position || 'UNK',
          nfl_team: player?.team || 'UNK',
          owner_name: team?.owner_name || 'Unknown Owner',
          team_name: team?.team_name || 'Unknown Team'
        };
      });

      setDraftPicks(processedPicks);

    } catch (error) {
      console.error('Error loading draft data:', error);
      toast({
        title: "Error",
        description: `Failed to load draft data: ${error}`,
        variant: "destructive"
      });
      setDraftPicks([]);
    } finally {
      setRefreshing(false);
    }
  };

  const getConferencesToShow = () => {
    if (!selectedConference) {
      // Show all conferences for the selected season
      const season = seasons.find(s => s.season_year === selectedSeason);
      if (!season) return [];
      return conferences.filter(c => c.season_id === season.id);
    }
    
    // Map the string conference ID from context to database conference
    // The context uses string IDs like 'mars', 'jupiter', 'vulcan'
    // We need to find the corresponding database conference by matching the conference name
    const contextConferenceMap = {
      'mars': 'The Legions of Mars',
      'jupiter': 'The Guardians of Jupiter', 
      'vulcan': "Vulcan's Oathsworn"
    };
    
    const targetConferenceName = contextConferenceMap[selectedConference];
    if (!targetConferenceName) return [];
    
    const season = seasons.find(s => s.season_year === selectedSeason);
    if (!season) return [];
    
    const conference = conferences.find(c => 
      c.season_id === season.id && c.conference_name === targetConferenceName
    );
    return conference ? [conference] : [];
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'K':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'DEF':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const renderDraftBoard = (conference: Conference) => {
    const conferencePicks = draftPicks.filter(pick => pick.conference_id === conference.id);
    const roundPicks = conferencePicks.filter(pick => pick.round === selectedRound);

    return (
      <Card key={conference.id}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>{conference.conference_name}</span>
          </CardTitle>
          <CardDescription>
            Round {selectedRound} • {roundPicks.length} picks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pick</TableHead>
                  <TableHead className="w-16">Overall</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="hidden sm:table-cell">NFL Team</TableHead>
                  <TableHead>Drafted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roundPicks.length > 0 ? (
                  roundPicks.map((pick) => (
                    <TableRow key={`${conference.id}-${pick.pick_number}`}>
                      <TableCell className="font-medium">{pick.draft_slot}</TableCell>
                      <TableCell className="font-medium">{pick.pick_number}</TableCell>
                      <TableCell className="font-semibold">{pick.player_name}</TableCell>
                      <TableCell>
                        <Badge className={getPositionColor(pick.position)}>
                          {pick.position}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{pick.nfl_team}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{pick.team_name}</div>
                          <div className="text-muted-foreground">{pick.owner_name}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No picks found for round {selectedRound}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTeamView = () => {
    const conferencesToShow = getConferencesToShow();
    
    return (
      <div className="space-y-6">
        {conferencesToShow.map((conference) => {
          const conferencePicks = draftPicks.filter(pick => pick.conference_id === conference.id);
          
          // Group picks by team/owner
          const teamPicksMap = new Map();
          conferencePicks.forEach(pick => {
            const key = pick.owner_id;
            if (!teamPicksMap.has(key)) {
              teamPicksMap.set(key, {
                owner_id: pick.owner_id,
                owner_name: pick.owner_name,
                team_name: pick.team_name,
                picks: []
              });
            }
            teamPicksMap.get(key).picks.push(pick);
          });

          const teamPicks = Array.from(teamPicksMap.values());

          return (
            <Card key={conference.id}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>{conference.conference_name} - Team Draft Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamPicks.map((team) => (
                    <Card key={team.owner_id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{team.team_name}</CardTitle>
                        <CardDescription>
                          {team.owner_name} • {team.picks.length} picks
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {team.picks.slice(0, 8).map((pick) => (
                            <div key={pick.pick_number} className="flex items-center justify-between p-2 rounded-md bg-accent/50">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  R{pick.round}
                                </Badge>
                                <span className="font-medium text-sm">{pick.player_name}</span>
                                <Badge className={`${getPositionColor(pick.position)} text-xs`}>
                                  {pick.position}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">#{pick.pick_number}</span>
                            </div>
                          ))}
                          {team.picks.length > 8 && (
                            <p className="text-xs text-muted-foreground text-center pt-2">
                              +{team.picks.length - 8} more picks
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {teamPicks.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No draft picks found for this conference</p>
                    <p className="text-sm">Try syncing draft data from the Admin panel</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  const conferencesToShow = getConferencesToShow();
  const totalTeams = conferencesToShow.reduce((sum, conf) => {
    const confTeams = new Set(draftPicks.filter(p => p.conference_id === conf.id).map(p => p.owner_id));
    return sum + confTeams.size;
  }, 0);

  const maxRounds = Math.max(...draftPicks.map(pick => pick.round), 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Draft Results</h1>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {selectedSeason} Season • {selectedConference ?
            conferencesToShow[0]?.conference_name || 'Conference' :
            'All Conferences'
            }
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDraftData}
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Conferences</CardDescription>
            <CardTitle className="text-2xl">{conferencesToShow.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Teams</CardDescription>
            <CardTitle className="text-2xl">{totalTeams}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Picks</CardDescription>
            <CardTitle className="text-2xl">{draftPicks.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Max Rounds</CardDescription>
            <CardTitle className="text-2xl">{maxRounds}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {draftPicks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Draft Results Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              No draft picks found for the selected season and conference.
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Try syncing draft data from the Admin → Data Sync → Draft Sync panel.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center space-x-4">
              <Select value={selectedRound.toString()} onValueChange={(value) => setSelectedRound(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxRounds }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Round {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Draft Results Tabs */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'board' | 'team')} className="w-full">
            <TabsList>
              <TabsTrigger value="board">Draft Board</TabsTrigger>
              <TabsTrigger value="team">Team View</TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="space-y-6">
              {conferencesToShow.map((conference) => renderDraftBoard(conference))}
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
              {renderTeamView()}
            </TabsContent>
          </Tabs>

          {/* Draft Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5" />
                <span>Draft Analysis</span>
              </CardTitle>
              <CardDescription>
                Draft insights and position trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {draftPicks.filter(p => p.position === 'RB').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Running Backs Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">
                    {draftPicks.filter(p => p.position === 'QB').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Quarterbacks Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">
                    {draftPicks.filter(p => p.position === 'WR').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Wide Receivers Drafted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DraftResultsPage;