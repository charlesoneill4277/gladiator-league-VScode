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

interface DraftPick {
  id: number;
  season_id: number;
  conference_id: number;
  round: number;
  draft_slot: number;
  pick_number: number;
  team_id: number;
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
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

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

      // Load team-conference junction data to get roster_id mappings
      const { data: junctionData, error: junctionError } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 500,
        OrderByField: "id",
        IsAsc: true
      });

      if (junctionError) throw junctionError;

      // Create enhanced teams data with roster_id mappings
      const enhancedTeams = (teamsData?.List || []).map((team) => {
        // Find all junction records for this team
        const teamJunctions = (junctionData?.List || []).filter((junction) => junction.team_id === team.id);
        return {
          ...team,
          junctions: teamJunctions,
          // For convenience, add roster_ids as an array
          roster_ids: teamJunctions.map((j) => j.roster_id)
        };
      });

      setTeams(enhancedTeams);

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
      const season = seasons.find((s) => s.season_year === selectedSeason);
      if (!season) {
        console.warn(`Season ${selectedSeason} not found in database`);
        setDraftPicks([]);
        return;
      }

      // Build filters
      const filters = [
      { name: "season_id", op: "Equal", value: season.id }];


      // Add conference filter if specific conference is selected
      if (selectedConference) {
        const contextConferenceMap = {
          'mars': 'The Legions of Mars',
          'jupiter': 'The Guardians of Jupiter',
          'vulcan': "Vulcan's Oathsworn"
        };

        const targetConferenceName = contextConferenceMap[selectedConference];
        if (targetConferenceName) {
          const conference = conferences.find((c) =>
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
        const conference = conferences.find((c) => c.id === pick.conference_id);

        // Find player information
        const player = allPlayers[pick.player_id];

        // Find team/owner information using the team_id
        // The team_id in draft_results now directly references the teams table
        const team = teams.find((t) => t.id === pick.team_id);

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
      const season = seasons.find((s) => s.season_year === selectedSeason);
      if (!season) return [];
      return conferences.filter((c) => c.season_id === season.id);
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

    const season = seasons.find((s) => s.season_year === selectedSeason);
    if (!season) return [];

    const conference = conferences.find((c) =>
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
    const conferencePicks = draftPicks.filter((pick) => pick.conference_id === conference.id);
    const roundPicks = conferencePicks.filter((pick) => pick.round === selectedRound);

    return (
      <Card key={conference.id} data-id="pq8khocx8">
        <CardHeader data-id="4hssq88yu">
          <CardTitle className="flex items-center space-x-2" data-id="36qn2grc3">
            <Shield className="h-5 w-5" data-id="oqu3ov7aw" />
            <span data-id="6am2d3176">{conference.conference_name}</span>
          </CardTitle>
          <CardDescription data-id="g8c8xn2qz">
            Round {selectedRound} • {roundPicks.length} picks
          </CardDescription>
        </CardHeader>
        <CardContent data-id="pf67bf6or">
          <div className="rounded-md border" data-id="z3c5wlfda">
            <Table data-id="v46hwu6bd">
              <TableHeader data-id="c80l2n64s">
                <TableRow data-id="loiyxjzlp">
                  <TableHead className="w-16" data-id="w8kav17qv">Pick</TableHead>
                  <TableHead className="w-16" data-id="h4sqsp1nk">Overall</TableHead>
                  <TableHead data-id="ur6e8xe5o">Player</TableHead>
                  <TableHead data-id="d5v8gqnd0">Position</TableHead>
                  <TableHead className="hidden sm:table-cell" data-id="d6qxbnctz">NFL Team</TableHead>
                  <TableHead data-id="r83a6fc0u">Drafted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody data-id="ji5err407">
                {roundPicks.length > 0 ?
                roundPicks.map((pick) =>
                <TableRow key={`${conference.id}-${pick.pick_number}`} data-id="u2y6whl18">
                      <TableCell className="font-medium" data-id="d4a1y1ka1">{pick.draft_slot}</TableCell>
                      <TableCell className="font-medium" data-id="zinic15tu">{pick.pick_number}</TableCell>
                      <TableCell className="font-semibold" data-id="3qxekoh9t">{pick.player_name}</TableCell>
                      <TableCell data-id="rblldu2sr">
                        <Badge className={getPositionColor(pick.position)} data-id="x78dqwakm">
                          {pick.position}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell" data-id="kah33qsbn">{pick.nfl_team}</TableCell>
                      <TableCell data-id="d6z3pl4g3">
                        <div className="text-sm" data-id="tiq91klqk">
                          <div className="font-medium" data-id="ag1htq1x7">{pick.team_name}</div>
                          <div className="text-muted-foreground" data-id="o1c84ofbw">{pick.owner_name}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                ) :

                <TableRow data-id="amvel7dwa">
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8" data-id="mizub16on">
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
      <div className="space-y-6" data-id="7ie37nz04">
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

          const teamPicks = Array.from(teamPicksMap.values());

          return (
            <Card key={conference.id} data-id="4cgh09wed">
              <CardHeader data-id="vtqxqao1c">
                <CardTitle className="flex items-center space-x-2" data-id="85f08ztek">
                  <Users className="h-5 w-5" data-id="y730ji3sx" />
                  <span data-id="q4ce7up2g">{conference.conference_name} - Team Draft Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent data-id="icu6x870e">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-id="gzolrnhxb">
                  {teamPicks.map((team) => {
                    const isExpanded = expandedTeams.has(team.team_id);
                    const displayPicks = isExpanded ? team.picks : team.picks.slice(0, 8);
                    
                    return (
                      <Card key={team.team_id} data-id="ov08445nd">
                        <CardHeader className="pb-2" data-id="jam3l5pyg">
                          <CardTitle className="text-lg" data-id="nqqp432c6">{team.team_name}</CardTitle>
                          <CardDescription data-id="kipgiyr1k">
                            {team.owner_name} • {team.picks.length} picks
                          </CardDescription>
                        </CardHeader>
                        <CardContent data-id="9vjrm5luu">
                          <div className="space-y-2" data-id="wuggh9vx7">
                            {displayPicks.map((pick) =>
                              <div key={pick.pick_number} className="flex items-center justify-between p-2 rounded-md bg-accent/50" data-id="lvohey335">
                                <div className="flex items-center space-x-2" data-id="6rt38drxz">
                                  <Badge variant="outline" className="text-xs" data-id="cxvjz843t">
                                    R{pick.round}
                                  </Badge>
                                  <span className="font-medium text-sm" data-id="cg7hlkzmr">{pick.player_name}</span>
                                  <Badge className={`${getPositionColor(pick.position)} text-xs`} data-id="wxn5h38mt">
                                    {pick.position}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground" data-id="j7d4fknvp">#{pick.pick_number}</span>
                              </div>
                            )}
                            
                            {team.picks.length > 8 && (
                              <div className="flex justify-center pt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleTeamExpansion(team.team_id)}
                                  className="text-xs"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show All {team.picks.length} Picks
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                
                {teamPicks.length === 0 &&
                <div className="text-center text-muted-foreground py-8" data-id="kbchkv4gy">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" data-id="81ak2w0ja" />
                    <p data-id="iluudtgdv">No draft picks found for this conference</p>
                    <p className="text-sm" data-id="1i6x5onjs">Try syncing draft data from the Admin panel</p>
                  </div>
                }
              </CardContent>
            </Card>);

        })}
      </div>);

  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-id="8u40qarcp">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" data-id="m8lxemayo"></div>
      </div>);

  }

  const conferencesToShow = getConferencesToShow();
  const totalTeams = conferencesToShow.reduce((sum, conf) => {
    const confTeams = new Set(draftPicks.filter((p) => p.conference_id === conf.id).map((p) => p.team_id));
    return sum + confTeams.size;
  }, 0);

  const maxRounds = Math.max(...draftPicks.map((pick) => pick.round), 1);

  return (
    <div className="space-y-6" data-id="3wz9f493h">
      {/* Page Header */}
      <div className="flex flex-col space-y-2" data-id="0jxj1eikw">
        <div className="flex items-center space-x-2" data-id="9b6t0xaqv">
          <Target className="h-6 w-6 text-primary" data-id="8kr3lz6zn" />
          <h1 className="text-3xl font-bold" data-id="a86f7wb5m">Draft Results</h1>
        </div>
        <div className="flex items-center justify-between" data-id="ix1ui274p">
          <p className="text-muted-foreground" data-id="ajg5l4pbp">
            {selectedSeason} Season • {selectedConference ?
            conferencesToShow[0]?.conference_name || 'Conference' :
            'All Conferences'
            }
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDraftData}
            disabled={refreshing} data-id="uocztb7ex">

            {refreshing ?
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" data-id="5egx7dxa4" /> :

            <RefreshCw className="h-4 w-4 mr-2" data-id="anjbrq2r7" />
            }
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-id="zkuar79ei">
        <Card data-id="viw5dfs8k">
          <CardHeader className="pb-2" data-id="hy4x5iqgp">
            <CardDescription data-id="5w7dj0t66">Total Conferences</CardDescription>
            <CardTitle className="text-2xl" data-id="cngxdw92y">{conferencesToShow.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card data-id="p17422s46">
          <CardHeader className="pb-2" data-id="1e133uw4e">
            <CardDescription data-id="06rlfpz08">Total Teams</CardDescription>
            <CardTitle className="text-2xl" data-id="7am9x92ux">{totalTeams}</CardTitle>
          </CardHeader>
        </Card>

        <Card data-id="yso30l6wi">
          <CardHeader className="pb-2" data-id="sqkh2coyx">
            <CardDescription data-id="31j1xs6al">Total Picks</CardDescription>
            <CardTitle className="text-2xl" data-id="gdsi1tunl">{draftPicks.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card data-id="fpovhxdr0">
          <CardHeader className="pb-2" data-id="yrcyqe2d2">
            <CardDescription data-id="bru1ou1mw">Max Rounds</CardDescription>
            <CardTitle className="text-2xl" data-id="thfft8qyn">{maxRounds}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {draftPicks.length === 0 ?
      <Card data-id="ama4qyumz">
          <CardContent className="flex flex-col items-center justify-center py-12" data-id="f0npomy8m">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" data-id="h37cqb9yq" />
            <h3 className="text-lg font-semibold mb-2" data-id="v1v5z7uay">No Draft Results Found</h3>
            <p className="text-muted-foreground text-center mb-4" data-id="fmpeoismp">
              No draft picks found for the selected season and conference.
            </p>
            <p className="text-sm text-muted-foreground text-center" data-id="3zezru179">
              Try syncing draft data from the Admin → Data Sync → Draft Sync panel.
            </p>
          </CardContent>
        </Card> :

      <>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-id="eso1u47t9">
            <div className="flex items-center space-x-4" data-id="wa7rcuaqh">
              <Select value={selectedRound.toString()} onValueChange={(value) => setSelectedRound(parseInt(value))} data-id="wd2k3mhd7">
                <SelectTrigger className="w-32" data-id="71nltbor1">
                  <SelectValue data-id="st46019mq" />
                </SelectTrigger>
                <SelectContent data-id="4gj7fkk1l">
                  {Array.from({ length: maxRounds }, (_, i) =>
                <SelectItem key={i + 1} value={(i + 1).toString()} data-id="o27pgp4ux">
                      Round {i + 1}
                    </SelectItem>
                )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Draft Results Tabs */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'board' | 'team')} className="w-full" data-id="t0seoz8xb">
            <TabsList data-id="g8di0j6fq">
              <TabsTrigger value="board" data-id="qn4nl4nj0">Draft Board</TabsTrigger>
              <TabsTrigger value="team" data-id="gpqj4c0j0">Team View</TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="space-y-6" data-id="q5uim44q8">
              {conferencesToShow.map((conference) => renderDraftBoard(conference))}
            </TabsContent>

            <TabsContent value="team" className="space-y-6" data-id="wsq7xm6bp">
              {renderTeamView()}
            </TabsContent>
          </Tabs>

          {/* Draft Analysis */}
          <Card data-id="75106j9ni">
            <CardHeader data-id="xab3n7czh">
              <CardTitle className="flex items-center space-x-2" data-id="s2kbla0r9">
                <Trophy className="h-5 w-5" data-id="ujcb4mef4" />
                <span data-id="qfjwuaeiy">Draft Analysis</span>
              </CardTitle>
              <CardDescription data-id="su8ejw7nw">
                Draft insights and position trends
              </CardDescription>
            </CardHeader>
            <CardContent data-id="30mlgmoxy">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-id="1vv5kf4ce">
                <div className="text-center p-4 border rounded-lg" data-id="gzy3kqxvp">
                  <p className="text-2xl font-bold text-green-600" data-id="ljmtju4vi">
                    {draftPicks.filter((p) => p.position === 'RB').length}
                  </p>
                  <p className="text-sm text-muted-foreground" data-id="i4hg14fin">Running Backs Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg" data-id="19re3pp2y">
                  <p className="text-2xl font-bold" data-id="s8l98a4et">
                    {draftPicks.filter((p) => p.position === 'QB').length}
                  </p>
                  <p className="text-sm text-muted-foreground" data-id="ouuhwtop1">Quarterbacks Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg" data-id="pzyjvb52a">
                  <p className="text-2xl font-bold" data-id="v97db79nu">
                    {draftPicks.filter((p) => p.position === 'WR').length}
                  </p>
                  <p className="text-sm text-muted-foreground" data-id="zos34cxwj">Wide Receivers Drafted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      }
    </div>);

};

export default DraftResultsPage;