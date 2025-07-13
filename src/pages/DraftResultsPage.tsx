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
      
      // Load team-conference junction data to get roster_id mappings
      const { data: junctionData, error: junctionError } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 500,
        OrderByField: "id",
        IsAsc: true
      });

      if (junctionError) throw junctionError;
      
      // Create enhanced teams data with roster_id mappings
      const enhancedTeams = (teamsData?.List || []).map(team => {
        // Find all junction records for this team
        const teamJunctions = (junctionData?.List || []).filter(junction => junction.team_id === team.id);
        return {
          ...team,
          junctions: teamJunctions,
          // For convenience, add roster_ids as an array
          roster_ids: teamJunctions.map(j => j.roster_id)
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

        // Find team/owner information using the junction table
        // The owner_id in draft_results contains the roster_id (picked_by from Sleeper API)
        // We need to map this to a team through the team_conferences_junction table
        let team = null;
        
        // Try to find the team using the junction table (roster_id mapping)
        team = teams.find((t) => {
          // Check if this team has a junction record with the matching roster_id for this conference
          return t.junctions && t.junctions.some(junction => 
            junction.roster_id === pick.owner_id && junction.conference_id === pick.conference_id
          );
        });
        
        if (!team) {
          // Fallback: try to match by owner_id directly (for legacy data)
          team = teams.find((t) => t.owner_id === pick.owner_id);
        }

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
      <Card key={conference.id} data-id="91sing0o6">
        <CardHeader data-id="om4fmhwto">
          <CardTitle className="flex items-center space-x-2" data-id="mo0rv2hx9">
            <Shield className="h-5 w-5" data-id="9igd1ash5" />
            <span data-id="jf612orm7">{conference.conference_name}</span>
          </CardTitle>
          <CardDescription data-id="2qzogv9w4">
            Round {selectedRound} • {roundPicks.length} picks
          </CardDescription>
        </CardHeader>
        <CardContent data-id="1wa4xbec8">
          <div className="rounded-md border" data-id="brgpum1ek">
            <Table data-id="x4ov4qeun">
              <TableHeader data-id="kc6zat7ta">
                <TableRow data-id="lm8k5df9g">
                  <TableHead className="w-16" data-id="n6qw3xo2z">Pick</TableHead>
                  <TableHead className="w-16" data-id="j23j19ab3">Overall</TableHead>
                  <TableHead data-id="9t8m0pvwr">Player</TableHead>
                  <TableHead data-id="p9tfe7xvi">Position</TableHead>
                  <TableHead className="hidden sm:table-cell" data-id="c7na63ugv">NFL Team</TableHead>
                  <TableHead data-id="a1i9yalo5">Drafted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody data-id="0xvnjg6wx">
                {roundPicks.length > 0 ?
                roundPicks.map((pick) =>
                <TableRow key={`${conference.id}-${pick.pick_number}`} data-id="hg33c7pfg">
                      <TableCell className="font-medium" data-id="y58qq4ldf">{pick.draft_slot}</TableCell>
                      <TableCell className="font-medium" data-id="6p22ab61l">{pick.pick_number}</TableCell>
                      <TableCell className="font-semibold" data-id="7k1rj8igz">{pick.player_name}</TableCell>
                      <TableCell data-id="dem8oya8m">
                        <Badge className={getPositionColor(pick.position)} data-id="la75deo6t">
                          {pick.position}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell" data-id="pm1p2x18u">{pick.nfl_team}</TableCell>
                      <TableCell data-id="hw3hyvkhs">
                        <div className="text-sm" data-id="kljoestrp">
                          <div className="font-medium" data-id="l8upwisl3">{pick.team_name}</div>
                          <div className="text-muted-foreground" data-id="26mfc0qxx">{pick.owner_name}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                ) :

                <TableRow data-id="5qchrecfc">
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8" data-id="watsw2gtl">
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
      <div className="space-y-6" data-id="7wa0buasd">
        {conferencesToShow.map((conference) => {
          const conferencePicks = draftPicks.filter((pick) => pick.conference_id === conference.id);

          // Group picks by team/owner
          const teamPicksMap = new Map();
          conferencePicks.forEach((pick) => {
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
            <Card key={conference.id} data-id="uspp1kfqs">
              <CardHeader data-id="ciw98dy59">
                <CardTitle className="flex items-center space-x-2" data-id="bl2asovud">
                  <Users className="h-5 w-5" data-id="cope1j5y3" />
                  <span data-id="9u73su4de">{conference.conference_name} - Team Draft Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent data-id="i8mhj3r50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-id="djlinw2pe">
                  {teamPicks.map((team) =>
                  <Card key={team.owner_id} data-id="rtvmavjql">
                      <CardHeader className="pb-2" data-id="55bmzr8tn">
                        <CardTitle className="text-lg" data-id="4k9iuzucy">{team.team_name}</CardTitle>
                        <CardDescription data-id="m1sctjt8m">
                          {team.owner_name} • {team.picks.length} picks
                        </CardDescription>
                      </CardHeader>
                      <CardContent data-id="kczm2dgcd">
                        <div className="space-y-2" data-id="eybpkcluo">
                          {team.picks.slice(0, 8).map((pick) =>
                        <div key={pick.pick_number} className="flex items-center justify-between p-2 rounded-md bg-accent/50" data-id="5f2qbijr5">
                              <div className="flex items-center space-x-2" data-id="g1jcnh36i">
                                <Badge variant="outline" className="text-xs" data-id="71c2zki7b">
                                  R{pick.round}
                                </Badge>
                                <span className="font-medium text-sm" data-id="1w26y3ejx">{pick.player_name}</span>
                                <Badge className={`${getPositionColor(pick.position)} text-xs`} data-id="htxx72sja">
                                  {pick.position}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground" data-id="ybci1qgsr">#{pick.pick_number}</span>
                            </div>
                        )}
                          {team.picks.length > 8 &&
                        <p className="text-xs text-muted-foreground text-center pt-2" data-id="8pljc6usk">
                              +{team.picks.length - 8} more picks
                            </p>
                        }
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                {teamPicks.length === 0 &&
                <div className="text-center text-muted-foreground py-8" data-id="iljwrk05k">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" data-id="36zqfaeu3" />
                    <p data-id="h2wh04tar">No draft picks found for this conference</p>
                    <p className="text-sm" data-id="ggqz9chos">Try syncing draft data from the Admin panel</p>
                  </div>
                }
              </CardContent>
            </Card>);

        })}
      </div>);

  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-id="j3s3uvqpu">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" data-id="nbn7lmecz"></div>
      </div>);

  }

  const conferencesToShow = getConferencesToShow();
  const totalTeams = conferencesToShow.reduce((sum, conf) => {
    const confTeams = new Set(draftPicks.filter((p) => p.conference_id === conf.id).map((p) => p.owner_id));
    return sum + confTeams.size;
  }, 0);

  const maxRounds = Math.max(...draftPicks.map((pick) => pick.round), 1);

  return (
    <div className="space-y-6" data-id="9yh8h6mzo">
      {/* Page Header */}
      <div className="flex flex-col space-y-2" data-id="l7e3ka2g8">
        <div className="flex items-center space-x-2" data-id="0vdhtu8nl">
          <Target className="h-6 w-6 text-primary" data-id="zpz28btbj" />
          <h1 className="text-3xl font-bold" data-id="rtd3yy8yb">Draft Results</h1>
        </div>
        <div className="flex items-center justify-between" data-id="oyjqqpqzy">
          <p className="text-muted-foreground" data-id="9boeigmu3">
            {selectedSeason} Season • {selectedConference ?
            conferencesToShow[0]?.conference_name || 'Conference' :
            'All Conferences'
            }
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDraftData}
            disabled={refreshing} data-id="bhtw18nm4">

            {refreshing ?
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" data-id="yj4x3w9dn" /> :

            <RefreshCw className="h-4 w-4 mr-2" data-id="r8w3odayd" />
            }
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-id="8oe31egkz">
        <Card data-id="0pb86ygww">
          <CardHeader className="pb-2" data-id="4i1van66v">
            <CardDescription data-id="ffv3dn4x4">Total Conferences</CardDescription>
            <CardTitle className="text-2xl" data-id="36zrre665">{conferencesToShow.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card data-id="4b1hb2n9a">
          <CardHeader className="pb-2" data-id="fw31iypep">
            <CardDescription data-id="3f3jtwaps">Total Teams</CardDescription>
            <CardTitle className="text-2xl" data-id="yn8gud1r8">{totalTeams}</CardTitle>
          </CardHeader>
        </Card>

        <Card data-id="nb8keapzw">
          <CardHeader className="pb-2" data-id="2a5e4t1u9">
            <CardDescription data-id="j43vv6c5k">Total Picks</CardDescription>
            <CardTitle className="text-2xl" data-id="ta5aqe0s9">{draftPicks.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card data-id="xom421fut">
          <CardHeader className="pb-2" data-id="79nh9uzf1">
            <CardDescription data-id="1k93slubi">Max Rounds</CardDescription>
            <CardTitle className="text-2xl" data-id="fslmlhhuy">{maxRounds}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {draftPicks.length === 0 ?
      <Card data-id="ov8nmocjt">
          <CardContent className="flex flex-col items-center justify-center py-12" data-id="aubx8tqio">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" data-id="1lkxrenk2" />
            <h3 className="text-lg font-semibold mb-2" data-id="11u25lgxz">No Draft Results Found</h3>
            <p className="text-muted-foreground text-center mb-4" data-id="9zasnnx7a">
              No draft picks found for the selected season and conference.
            </p>
            <p className="text-sm text-muted-foreground text-center" data-id="z2fra9zxx">
              Try syncing draft data from the Admin → Data Sync → Draft Sync panel.
            </p>
          </CardContent>
        </Card> :

      <>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-id="kg60igo7g">
            <div className="flex items-center space-x-4" data-id="kk9qo45u4">
              <Select value={selectedRound.toString()} onValueChange={(value) => setSelectedRound(parseInt(value))} data-id="21nuvvwjk">
                <SelectTrigger className="w-32" data-id="hyar39dec">
                  <SelectValue data-id="lxt5vfjju" />
                </SelectTrigger>
                <SelectContent data-id="72f5ghuqk">
                  {Array.from({ length: maxRounds }, (_, i) =>
                <SelectItem key={i + 1} value={(i + 1).toString()} data-id="kf5fn2863">
                      Round {i + 1}
                    </SelectItem>
                )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Draft Results Tabs */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'board' | 'team')} className="w-full" data-id="u2xgfvveq">
            <TabsList data-id="qgfddtsmy">
              <TabsTrigger value="board" data-id="7wqbv3p9y">Draft Board</TabsTrigger>
              <TabsTrigger value="team" data-id="089qldhiy">Team View</TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="space-y-6" data-id="c36ksxig4">
              {conferencesToShow.map((conference) => renderDraftBoard(conference))}
            </TabsContent>

            <TabsContent value="team" className="space-y-6" data-id="n1xsxsrqj">
              {renderTeamView()}
            </TabsContent>
          </Tabs>

          {/* Draft Analysis */}
          <Card data-id="y8swfdlkv">
            <CardHeader data-id="zircxnl9z">
              <CardTitle className="flex items-center space-x-2" data-id="0ptvrimio">
                <Trophy className="h-5 w-5" data-id="f8l1ljy2r" />
                <span data-id="5wcffwd17">Draft Analysis</span>
              </CardTitle>
              <CardDescription data-id="9436doncr">
                Draft insights and position trends
              </CardDescription>
            </CardHeader>
            <CardContent data-id="2d8pp1z4c">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-id="wjqgauiru">
                <div className="text-center p-4 border rounded-lg" data-id="gxhu11n5z">
                  <p className="text-2xl font-bold text-green-600" data-id="iusxn9jbs">
                    {draftPicks.filter((p) => p.position === 'RB').length}
                  </p>
                  <p className="text-sm text-muted-foreground" data-id="smim6f33s">Running Backs Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg" data-id="gng52sh1b">
                  <p className="text-2xl font-bold" data-id="awdo51za4">
                    {draftPicks.filter((p) => p.position === 'QB').length}
                  </p>
                  <p className="text-sm text-muted-foreground" data-id="w3ugia49a">Quarterbacks Drafted</p>
                </div>
                <div className="text-center p-4 border rounded-lg" data-id="46y56pdxa">
                  <p className="text-2xl font-bold" data-id="oex6erv8f">
                    {draftPicks.filter((p) => p.position === 'WR').length}
                  </p>
                  <p className="text-sm text-muted-foreground" data-id="v0gkuhrbb">Wide Receivers Drafted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      }
    </div>);

};

export default DraftResultsPage;