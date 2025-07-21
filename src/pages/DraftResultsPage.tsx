import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Shield, Trophy, Target, Users, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { DatabaseService } from '@/services/databaseService';
import { DbDraftResult, DbSeason, DbConference, DbTeam } from '@/types/database';

// Updated interfaces to match Supabase schema
interface DraftPick {
  id: number;
  draft_year: string;
  league_id: string;
  round: string;
  draft_slot: string;
  pick_number: string;
  owner_id: string;
  sleeper_id: string;
  created_at?: string;
  updated_at?: string;
}

interface Conference {
  id: number;
  conference_name: string;
  league_id: string;
  season_id: number;
}

interface Season {
  id: number;
  season_year: string;
  season_name: string;
  is_current: boolean;
}

interface ProcessedDraftPick extends DraftPick {
  player_name?: string;
  position?: string;
  nfl_team?: string;
  conference_name?: string;
  owner_name?: string;
  team_name?: string;
  // Add computed fields to bridge the schema differences
  conference_id?: number; // derived from league_id mapping
  team_id?: number; // derived from owner_id mapping
  player_id?: string; // alias for sleeper_id
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
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSeason && seasons.length > 0 && conferences.length > 0 && teams.length > 0 && Object.keys(allPlayers).length > 0) {
      loadDraftData();
    }
  }, [selectedSeason, selectedConference, seasons, conferences, teams, allPlayers]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      
      // Load seasons
      const seasonsResult = await DatabaseService.getSeasons({
        orderBy: { column: 'season_year', ascending: false },
        limit: 50
      });

      if (seasonsResult.error) throw seasonsResult.error;
      setSeasons(seasonsResult.data || []);

      // Load conferences
      const conferencesResult = await DatabaseService.getConferences({
        orderBy: { column: 'conference_name', ascending: true },
        limit: 50
      });

      if (conferencesResult.error) throw conferencesResult.error;
      setConferences(conferencesResult.data || []);

      // Load teams
      const teamsResult = await DatabaseService.getTeams({
        orderBy: { column: 'team_name', ascending: true },
        limit: 100
      });

      if (teamsResult.error) throw teamsResult.error;
      setTeams(teamsResult.data || []);

      // Load players data for mapping
      try {
        const players = await DatabaseService.getAllPlayersForMapping();
        
        // Create a lookup map by sleeper_id
        const playersData = {};
        players.forEach(player => {
          if (player.sleeper_id) {
            playersData[player.sleeper_id] = player;
          }
        });
        setAllPlayers(playersData);
        console.log(`📊 Loaded ${Object.keys(playersData).length} players from database (${players.length} total players)`);
        
      } catch (error) {
        console.warn('Could not load players data from database:', error);
        setAllPlayers({});
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
    if (!selectedSeason) {
      console.log('⚠️ No selectedSeason, skipping draft data load');
      return;
    }

    if (seasons.length === 0) {
      console.log('⚠️ Seasons not loaded yet, skipping draft data load');
      return;
    }

    if (conferences.length === 0) {
      console.log('⚠️ Conferences not loaded yet, skipping draft data load');
      return;
    }

    if (teams.length === 0) {
      console.log('⚠️ Teams not loaded yet, skipping draft data load');
      return;
    }

    if (Object.keys(allPlayers).length === 0) {
      console.log('⚠️ Players not loaded yet, skipping draft data load');
      return;
    }

    setRefreshing(true);
    try {
      console.log(`🎯 Loading draft data for season ${selectedSeason}, conference: ${selectedConference || 'all'}`);
      console.log(`📊 Available data: seasons=${seasons.length}, conferences=${conferences.length}, teams=${teams.length}, players=${Object.keys(allPlayers).length}`);

      // Get the season for the selected season year
      const season = seasons.find((s) => s.season_year === selectedSeason.toString());
      
      if (!season) {
        console.warn(`⚠️ Season ${selectedSeason} not found in database`);
        console.log('Available seasons:', seasons.map(s => s.season_year));
        setDraftPicks([]);
        return;
      }

      // Build filters for draft results - only filter by year, do conference filtering in UI
      const filters = [
        { column: "draft_year", operator: "eq" as const, value: selectedSeason.toString() }
      ];

      // Note: We do conference filtering in the UI for better reliability
      console.log('🔍 Draft query filters:', filters);

      // Fetch draft picks using Supabase
      const draftResult = await DatabaseService.getDraftResults({
        filters,
        orderBy: { column: 'pick_number', ascending: true },
        limit: 1000
      });

      if (draftResult.error) {
        throw draftResult.error;
      }

      console.log(`🎲 Loaded ${draftResult.data?.length || 0} draft picks`);

      // Process and enhance draft picks with additional information
      const picks = draftResult.data || [];
      
      // Don't sort globally - each conference has its own independent draft
      // Sorting will be done per conference in the render functions
      const processedPicks = picks.map((pick: DbDraftResult) => {
        // Find conference by league_id (draft results store league_id, not conference_id)
        const conference = conferences.find((c) => c.league_id === pick.league_id);

        // Find player information using sleeper_id from database
        const player = allPlayers[pick.sleeper_id];

        // Find team/owner information using owner_id
        const team = teams.find((t) => t.owner_id === pick.owner_id);

        // Debug logging for first few picks
        if (picks.indexOf(pick) < 3) {
          console.log(`🔍 Processing pick ${pick.pick_number}:`, {
            sleeper_id: pick.sleeper_id,
            player_found: !!player,
            player_name: player?.player_name,
            conference_found: !!conference,
            team_found: !!team
          });
        }

        return {
          ...pick,
          conference_name: conference?.conference_name || 'Unknown Conference',
          player_name: player?.player_name || 'Unknown Player',
          position: player?.position || 'UNK',
          nfl_team: player?.nfl_team || 'UNK',
          owner_name: team?.owner_name || 'Unknown Owner',
          team_name: team?.team_name || 'Unknown Team',
          // Add computed fields for backward compatibility
          conference_id: conference?.id,
          team_id: team?.id,
          player_id: pick.sleeper_id
        };
      });

      console.log(`✅ Processed ${processedPicks.length} draft picks`);
      console.log('First few picks:', processedPicks.slice(0, 3));

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

  const toggleTeamExpansion = (teamId: number) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const getConferencesToShow = () => {
    if (!selectedConference) {
      // Show all conferences for the selected season
      const season = seasons.find((s) => s.season_year === selectedSeason.toString());
      if (!season) {
        console.log('⚠️ Season not found for getConferencesToShow');
        return [];
      }
      const allConfs = conferences.filter((c) => c.season_id === season.id);
      console.log(`📋 Showing ${allConfs.length} conferences for season ${selectedSeason}`);
      return allConfs;
    }

    // Map the string conference ID from context to database conference
    // The context uses string IDs generated from conference names (lowercased, alphanumeric only)
    // We need to find the corresponding database conference by matching the conference name
    const contextConferenceMap = {
      'thelegionsofmars': 'The Legions of Mars',
      'theguardiansofjupiter': 'The Guardians of Jupiter',
      'vulcansoathsworn': "Vulcan's Oathsworn"
    };

    const targetConferenceName = contextConferenceMap[selectedConference];
    if (!targetConferenceName) {
      console.log(`⚠️ Unknown conference ID: ${selectedConference}`);
      return [];
    }

    const season = seasons.find((s) => s.season_year === selectedSeason.toString());
    if (!season) {
      console.log('⚠️ Season not found for specific conference');
      return [];
    }

    const conference = conferences.find((c) =>
    c.season_id === season.id && c.conference_name === targetConferenceName
    );
    
    console.log(`📋 Selected conference: ${targetConferenceName}, found: ${conference ? 'yes' : 'no'}`);
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
    const conferencePicks = draftPicks.filter((pick) => pick.conference_id === conference.id);
    
    // Filter for the selected round
    let roundPicks = conferencePicks.filter((pick) => parseInt(pick.round) === selectedRound);
    
    // Sort picks within this conference by draft_slot (pick within round)
    roundPicks.sort((a, b) => parseInt(a.draft_slot) - parseInt(b.draft_slot));

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
                {roundPicks.length > 0 ?
                roundPicks.map((pick) =>
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
                ) :

                <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No picks found for round {selectedRound}
                    </TableCell>
                  </TableRow>
                }
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>);

  };

  const renderTeamView = () => {
    const conferencesToShow = getConferencesToShow();

    return (
      <div className="space-y-6">
        {conferencesToShow.map((conference) => {
          const conferencePicks = draftPicks.filter((pick) => pick.conference_id === conference.id);

          // Group picks by team/owner
          const teamPicksMap = new Map();
          conferencePicks.forEach((pick) => {
            const key = pick.team_id;
            if (!teamPicksMap.has(key)) {
              teamPicksMap.set(key, {
                team_id: pick.team_id,
                owner_name: pick.owner_name,
                team_name: pick.team_name,
                picks: []
              });
            }
            teamPicksMap.get(key).picks.push(pick);
          });

          // Sort each team's picks by round and then by draft_slot
          teamPicksMap.forEach((team) => {
            team.picks.sort((a, b) => {
              const roundA = parseInt(a.round);
              const roundB = parseInt(b.round);
              
              if (roundA !== roundB) {
                return roundA - roundB;
              }
              
              return parseInt(a.draft_slot) - parseInt(b.draft_slot);
            });
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
                  {teamPicks.map((team) => {
                    const isExpanded = expandedTeams.has(team.team_id);
                    const displayPicks = isExpanded ? team.picks : team.picks.slice(0, 8);

                    return (
                      <Card key={team.team_id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{team.team_name}</CardTitle>
                          <CardDescription>
                            {team.owner_name} • {team.picks.length} picks
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {displayPicks.map((pick) =>
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
                            )}
                            
                            {team.picks.length > 8 &&
                            <div className="flex justify-center pt-2">
                                <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTeamExpansion(team.team_id)}
                                className="text-xs">

                                  {isExpanded ?
                                <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Show Less
                                    </> :

                                <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show All {team.picks.length} Picks
                                    </>
                                }
                                </Button>
                              </div>
                            }
                          </div>
                        </CardContent>
                      </Card>);

                  })}
                </div>
                
                {teamPicks.length === 0 &&
                <div className="text-center text-muted-foreground py-8">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No draft picks found for this conference</p>
                    <p className="text-sm">Try syncing draft data from the Admin panel</p>
                  </div>
                }
              </CardContent>
            </Card>);

        })}
      </div>);

  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>);

  }

  // Debug logging
  console.log('🔍 Render debug:', {
    selectedSeason,
    selectedConference,
    draftPicksCount: draftPicks.length,
    seasonsCount: seasons.length,
    conferencesCount: conferences.length,
    teamsCount: teams.length
  });

  const conferencesToShow = getConferencesToShow();
  console.log('📋 Conferences to show:', conferencesToShow.length);
  
  const totalTeams = conferencesToShow.reduce((sum, conf) => {
    const confTeams = new Set(draftPicks.filter((p) => p.conference_id === conf.id).map((p) => p.team_id));
    return sum + confTeams.size;
  }, 0);

  const maxRounds = Math.max(...draftPicks.map((pick) => parseInt(pick.round)), 1);

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
            disabled={refreshing}>

            {refreshing ?
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> :

            <RefreshCw className="h-4 w-4 mr-2" />
            }
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

      {draftPicks.length === 0 ?
      <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Draft Results Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              No draft picks found for the {selectedSeason} season{selectedConference ? ` in ${selectedConference}` : ''}.
            </p>
            <div className="text-sm text-muted-foreground text-center space-y-2">
              <p>Try:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Selecting a different season from the dropdown above</li>
                <li>Choosing "All Conferences" if you have a conference selected</li>
                <li>Syncing draft data from Admin → Data Sync → Draft Sync</li>
              </ul>
            </div>
          </CardContent>
        </Card> :

      <>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center space-x-4">
              <Select value={selectedRound.toString()} onValueChange={(value) => setSelectedRound(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxRounds }, (_, i) =>
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Round {i + 1}
                    </SelectItem>
                )}
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
                    {draftPicks.filter((p) => p.position === 'RB').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Running Backs Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">
                    {draftPicks.filter((p) => p.position === 'QB').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Quarterbacks Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold">
                    {draftPicks.filter((p) => p.position === 'WR').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Wide Receivers Drafted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      }
    </div>);

};

export default DraftResultsPage;