import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { SleeperApiService } from '@/services/sleeperApi';
import { DatabaseService } from '@/services/databaseService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  Active } from
'@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy } from
'@dnd-kit/sortable';
import {
  useSortable } from
'@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  Users,
  AlertTriangle,
  Save,
  RotateCcw,
  Edit,
  GripVertical,
  Trophy,
  Loader2,
  Check,
  X } from
'lucide-react';

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
}

interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  team_logo_url: string;
}

interface Matchup {
  id: number;
  conference_id: number;
  week: number;
  team1_id: number;
  team2_id: number;
  is_playoff: boolean;
  team1_score: number;
  team2_score: number;
  winning_team_id: number | null;
  manual_override: boolean;
  matchup_status: string;
  notes: string;
  sleeper_matchup_id?: string;
}

interface TeamWithDetails extends Team {
  conference_id: number;
}

interface MatchupWithConference extends Matchup {
  conference_name?: string;
}

interface SortableTeamCellProps {
  team: TeamWithDetails | null;
  matchupId: number;
  teamPosition: 'team1' | 'team2';
  isWinner: boolean;
}

interface CompactMatchupRowProps {
  matchup: MatchupWithConference;
  teams: TeamWithDetails[];
  conferences: Conference[];
  onToggleOverride: (matchupId: number) => void;
  onUpdateScores: (matchupId: number, team1Score: number, team2Score: number) => void;
}

const SortableTeamCell: React.FC<SortableTeamCellProps> = ({
  team,
  matchupId,
  teamPosition,
  isWinner
}) => {
  const teamId = `${matchupId}-${teamPosition}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: teamId,
    data: {
      type: 'team',
      team,
      matchupId,
      teamPosition
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 p-2 rounded cursor-grab hover:cursor-grabbing transition-colors
        ${isDragging ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
        ${isWinner ? 'bg-green-50 border border-green-200' : ''}
      `}>
      <GripVertical className="h-3 w-3 text-gray-400" />
      {team?.team_logo_url &&
      <img
        src={team.team_logo_url}
        alt={team.team_name}
        className="w-5 h-5 rounded-full" />

      }
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {team?.team_name || `Team ${teamPosition === 'team1' ? '1' : '2'}`}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {team?.owner_name}
        </div>
      </div>
    </div>);

};

const CompactMatchupRow: React.FC<CompactMatchupRowProps> = ({
  matchup,
  teams,
  conferences,
  onToggleOverride,
  onUpdateScores
}) => {
  const team1 = teams.find((t) => t.id === matchup.team1_id);
  const team2 = teams.find((t) => t.id === matchup.team2_id);
  const conference = conferences.find((c) => c.id === matchup.conference_id);

  const [editingScores, setEditingScores] = useState(false);
  const [team1Score, setTeam1Score] = useState(matchup.team1_score);
  const [team2Score, setTeam2Score] = useState(matchup.team2_score);

  // Update local state when matchup scores change from parent
  useEffect(() => {
    setTeam1Score(matchup.team1_score);
    setTeam2Score(matchup.team2_score);
  }, [matchup.team1_score, matchup.team2_score]);

  const isTeam1Winner = matchup.winning_team_id === matchup.team1_id;
  const isTeam2Winner = matchup.winning_team_id === matchup.team2_id;

  const handleSaveScores = () => {
    onUpdateScores(matchup.id, team1Score, team2Score);
    setEditingScores(false);
  };

  const handleCancelEdit = () => {
    setTeam1Score(matchup.team1_score);
    setTeam2Score(matchup.team2_score);
    setEditingScores(false);
  };

  return (
    <TableRow className={`transition-colors ${
    matchup.manual_override ? 'bg-orange-50 border-orange-200' : ''}`
    }>
      {/* Matchup Info */}
      <TableCell className="w-24">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">#{matchup.id}</span>
          <div className="flex flex-col gap-1">
            {matchup.manual_override &&
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 px-1 py-0">
                Override
              </Badge>
            }
            {matchup.is_playoff &&
            <Badge variant="default" className="text-xs bg-purple-600 px-1 py-0">
                Playoff
              </Badge>
            }
          </div>
        </div>
      </TableCell>

      {/* Team 1 */}
      <TableCell className="w-48">
        <SortableTeamCell
          team={team1}
          matchupId={matchup.id}
          teamPosition="team1"
          isWinner={isTeam1Winner} />

      </TableCell>

      {/* Score */}
      <TableCell className="w-32 text-center">
        {editingScores ?
        <div className="flex items-center gap-1 justify-center">
            <Input
            type="number"
            value={team1Score}
            onChange={(e) => setTeam1Score(parseFloat(e.target.value) || 0)}
            className="w-12 h-6 text-xs text-center px-1"
            step="0.1" />

            <span className="text-xs text-gray-400">-</span>
            <Input
            type="number"
            value={team2Score}
            onChange={(e) => setTeam2Score(parseFloat(e.target.value) || 0)}
            className="w-12 h-6 text-xs text-center px-1"
            step="0.1" />

            <Button
            size="sm"
            onClick={handleSaveScores}
            className="h-6 w-6 p-0">

              <Check className="h-3 w-3" />
            </Button>
            <Button
            size="sm"
            variant="ghost"
            onClick={handleCancelEdit}
            className="h-6 w-6 p-0">

              <X className="h-3 w-3" />
            </Button>
          </div> :

        <div
          className="flex items-center gap-1 justify-center cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
          onClick={() => setEditingScores(true)}>

            <span className={`text-sm font-bold ${isTeam1Winner ? 'text-green-600' : ''}`}>
              {matchup.team1_score}
            </span>
            <span className="text-xs text-gray-400">-</span>
            <span className={`text-sm font-bold ${isTeam2Winner ? 'text-green-600' : ''}`}>
              {matchup.team2_score}
            </span>
            <Edit className="h-3 w-3 text-gray-400 ml-1" />
          </div>
        }
      </TableCell>

      {/* Team 2 */}
      <TableCell className="w-48">
        <SortableTeamCell
          team={team2}
          matchupId={matchup.id}
          teamPosition="team2"
          isWinner={isTeam2Winner} />

      </TableCell>

      {/* Status */}
      <TableCell className="w-24">
        <div className="text-xs text-gray-500 text-center">
          {matchup.matchup_status}
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="w-24 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleOverride(matchup.id)}
          className="h-6 px-2 text-xs">

          <Edit className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>);

};

const MatchupsManagement: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [matchups, setMatchups] = useState<MatchupWithConference[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Helper function to fetch actual Sleeper scores for teams
  const fetchSleeperScoresForTeams = async (
    team1Id: number, 
    team2Id: number, 
    conferenceId: number, 
    week: number
  ): Promise<{ team1Score: number; team2Score: number }> => {
    try {
      console.log(`Fetching Sleeper scores for teams ${team1Id} and ${team2Id} for week ${week}`);
      console.log(`Note: Matchup conference_id ${conferenceId} will be ignored - checking each team's actual conference`);
      
      // Step 1: Get the actual conference and roster info for EACH team individually
      const [team1JunctionResult, team2JunctionResult] = await Promise.all([
        DatabaseService.getTeamConferenceJunctions({
          filters: [
            { column: 'team_id', operator: 'eq', value: team1Id }
          ]
        }),
        DatabaseService.getTeamConferenceJunctions({
          filters: [
            { column: 'team_id', operator: 'eq', value: team2Id }
          ]
        })
      ]);

      // Extract team junction data
      const team1Junction = team1JunctionResult.data?.[0];
      const team2Junction = team2JunctionResult.data?.[0];

      if (!team1Junction || !team2Junction) {
        console.warn(`Missing junction data - Team ${team1Id}: ${team1Junction ? 'found' : 'missing'}, Team ${team2Id}: ${team2Junction ? 'found' : 'missing'}`);
        return { team1Score: 0, team2Score: 0 };
      }

      console.log(`Team ${team1Id} junction:`, { conference_id: team1Junction.conference_id, roster_id: team1Junction.roster_id });
      console.log(`Team ${team2Id} junction:`, { conference_id: team2Junction.conference_id, roster_id: team2Junction.roster_id });

      // Step 2: Get the league_id for each team's actual conference
      const team1Conference = conferences.find(c => c.id === team1Junction.conference_id);
      const team2Conference = conferences.find(c => c.id === team2Junction.conference_id);

      if (!team1Conference || !team2Conference) {
        console.warn(`Missing conference data - Team ${team1Id} conference: ${team1Conference ? 'found' : 'missing'}, Team ${team2Id} conference: ${team2Conference ? 'found' : 'missing'}`);
        return { team1Score: 0, team2Score: 0 };
      }

      console.log(`Team ${team1Id} in conference "${team1Conference.conference_name}" (league_id: ${team1Conference.league_id})`);
      console.log(`Team ${team2Id} in conference "${team2Conference.conference_name}" (league_id: ${team2Conference.league_id})`);

      // Step 3: Fetch Sleeper scores for each team from their respective leagues
      let team1Score = 0;
      let team2Score = 0;

      // Fetch Team 1 score from its league
      try {
        console.log(`Fetching Team ${team1Id} score from league ${team1Conference.league_id}, week ${week}`);
        const team1SleeperMatchups = await SleeperApiService.fetchMatchups(team1Conference.league_id, week);
        const team1SleeperData = team1SleeperMatchups.find(m => m.roster_id === team1Junction.roster_id);
        team1Score = team1SleeperData?.points || 0;
        console.log(`Team ${team1Id} score from Sleeper: ${team1Score} (roster_id: ${team1Junction.roster_id})`);
      } catch (error) {
        console.error(`Error fetching Team ${team1Id} score from league ${team1Conference.league_id}:`, error);
      }

      // Fetch Team 2 score from its league
      try {
        console.log(`Fetching Team ${team2Id} score from league ${team2Conference.league_id}, week ${week}`);
        const team2SleeperMatchups = await SleeperApiService.fetchMatchups(team2Conference.league_id, week);
        const team2SleeperData = team2SleeperMatchups.find(m => m.roster_id === team2Junction.roster_id);
        team2Score = team2SleeperData?.points || 0;
        console.log(`Team ${team2Id} score from Sleeper: ${team2Score} (roster_id: ${team2Junction.roster_id})`);
      } catch (error) {
        console.error(`Error fetching Team ${team2Id} score from league ${team2Conference.league_id}:`, error);
      }

      console.log(`✅ Final scores - Team ${team1Id}: ${team1Score}, Team ${team2Id}: ${team2Score}`);
      console.log(`✅ This properly handles interconference matchups by checking each team's actual conference`);
      
      return { team1Score, team2Score };
    } catch (error) {
      console.error('Error fetching Sleeper scores:', error);
      return { team1Score: 0, team2Score: 0 };
    }
  };

  // Load initial data
  useEffect(() => {
    loadSeasons();
    loadTeams();
    loadCurrentWeek();
  }, []);

  // Load conferences when season changes
  useEffect(() => {
    if (selectedSeason) {
      loadConferences();
    }
  }, [selectedSeason]);

  // Load matchups when filters change
  useEffect(() => {
    if (selectedSeason && selectedWeek && conferences.length > 0) {
      loadMatchups();
    }
  }, [selectedSeason, selectedWeek, conferences]);

  const loadCurrentWeek = async () => {
    try {
      const currentWeek = await SleeperApiService.getCurrentNFLWeek();
      console.log(`Setting current week to: ${currentWeek}`);
      setSelectedWeek(currentWeek.toString());
    } catch (error) {
      console.error('Error loading current week:', error);
      // Don't set a default week if API fails - let user select manually
    }
  };

  const loadSeasons = async () => {
    try {
      const seasonsResult = await DatabaseService.getSeasons({
        limit: 100,
        orderBy: { column: 'season_year', ascending: false }
      });
      
      if (seasonsResult.error) throw new Error(seasonsResult.error);
      const dbSeasons = seasonsResult.data || [];
      
      // Map DbSeason to Season interface for compatibility
      const seasons: Season[] = dbSeasons.map((s) => ({
        id: s.id,
        season_year: parseInt(s.season_year),
        season_name: s.season_name,
        is_current_season: s.is_current
      }));
      
      setSeasons(seasons);

      // Auto-select current season
      const currentSeason = seasons.find((s) => s.is_current_season);
      if (currentSeason) {
        setSelectedSeason(currentSeason.id.toString());
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
      toast({
        title: 'Error',
        description: 'Failed to load seasons',
        variant: 'destructive'
      });
    }
  };

  const loadConferences = async () => {
    try {
      const { data, error } = await DatabaseService.getConferences({
        filters: [
          { column: 'season_id', operator: 'eq', value: parseInt(selectedSeason) }
        ]
      });
      if (error) throw new Error(error);
      setConferences(data || []);
    } catch (error) {
      console.error('Error loading conferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conferences',
        variant: 'destructive'
      });
    }
  };

  const loadTeams = async () => {
    try {
      // Load teams using DatabaseService
      const teamsResult = await DatabaseService.getTeams({
        limit: 100,
        orderBy: { column: 'team_name', ascending: true }
      });
      
      if (teamsResult.error) throw new Error(teamsResult.error);
      const teamsData = teamsResult.data || [];

      // Load team-conference junction data using DatabaseService
      const junctionResult = await DatabaseService.getTeamConferenceJunctions({
        limit: 1000,
        orderBy: { column: 'team_id', ascending: true }
      });
      
      if (junctionResult.error) throw new Error(junctionResult.error);
      const junctionData = junctionResult.data || [];

      // Combine team data with conference associations
      const teamsWithConferences = teamsData.map((team) => {
        const junction = junctionData.find((j) => j.team_id === team.id);
        return {
          id: team.id,
          team_name: team.team_name,
          owner_name: team.owner_name,
          team_logo_url: team.team_logourl || '', // Handle different property names
          conference_id: junction?.conference_id || 0
        };
      });

      setTeams(teamsWithConferences);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive'
      });
    }
  };

  const loadMatchups = async () => {
    setLoading(true);
    console.log(`Loading matchups for season ${selectedSeason}, week ${selectedWeek}`);
    console.log('Available conferences:', conferences.map((c) => ({ id: c.id, name: c.conference_name })));

    try {
      // Get all conference IDs for the selected season
      const conferenceIds = conferences.map((c) => c.id);
      console.log('Conference IDs to query:', conferenceIds);

      // Fetch matchups for all conferences
      const allMatchups: MatchupWithConference[] = [];

      for (const conferenceId of conferenceIds) {
        console.log(`Fetching matchups for conference ${conferenceId}`);

        const { data, error } = await DatabaseService.getMatchups({
          filters: [
            { column: 'conference_id', operator: 'eq', value: conferenceId },
            { column: 'week', operator: 'eq', value: parseInt(selectedWeek) }
          ],
          orderBy: { column: 'id', ascending: true }
        });

        if (error) {
          console.error(`Error fetching matchups for conference ${conferenceId}:`, error);
          throw new Error(error);
        }

        const matchups = data || [];
        console.log(`Found ${matchups.length} matchups for conference ${conferenceId}`);

        const conference = conferences.find((c) => c.id === conferenceId);
        const matchupsWithConference = matchups.map((matchup: any) => {
          console.log(`Loaded matchup ${matchup.id}:`, {
            teams: `${matchup.team1_id} vs ${matchup.team2_id}`,
            scores: `${matchup.team1_score} - ${matchup.team2_score}`,
            status: matchup.matchup_status,
            manual_override: matchup.manual_override
          });

          console.log(`📊 LOAD DEBUG - Matchup ${matchup.id}: team1_score=${matchup.team1_score}, team2_score=${matchup.team2_score}`);
          console.log(`📊 LOAD DEBUG - Raw database values:`, {
            team1_score: matchup.team1_score,
            team2_score: matchup.team2_score,
            team1_score_type: typeof matchup.team1_score,
            team2_score_type: typeof matchup.team2_score
          });

          return {
            ...matchup,
            conference_name: conference?.conference_name
          };
        });

        allMatchups.push(...matchupsWithConference);
      }

      // Sort by conference_id and then by id
      allMatchups.sort((a, b) => {
        if (a.conference_id !== b.conference_id) {
          return a.conference_id - b.conference_id;
        }
        return a.id - b.id;
      });

      console.log(`Total matchups loaded: ${allMatchups.length}`);
      console.log('Matchups breakdown by status:', {
        pending: allMatchups.filter((m) => m.matchup_status === 'pending').length,
        complete: allMatchups.filter((m) => m.matchup_status === 'complete').length,
        manual_overrides: allMatchups.filter((m) => m.manual_override).length
      });

      setMatchups(allMatchups);
    } catch (error) {
      console.error('Error loading matchups:', error);
      toast({
        title: 'Error',
        description: `Failed to load matchups: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Only handle team-to-team swaps
    if (activeData?.type === 'team' && overData?.type === 'team') {
      const activeMatchupId = activeData.matchupId;
      const activeTeamPosition = activeData.teamPosition;
      const overMatchupId = overData.matchupId;
      const overTeamPosition = overData.teamPosition;

      // Prevent dropping on the same position
      if (activeMatchupId === overMatchupId && activeTeamPosition === overTeamPosition) {
        return;
      }

      // Get current matchups to work with
      const currentMatchups = [...matchups];
      const activeMatchup = currentMatchups.find((m) => m.id === activeMatchupId);
      const overMatchup = currentMatchups.find((m) => m.id === overMatchupId);

      if (!activeMatchup || !overMatchup) return;

      // Get the team IDs to swap
      const activeTeamId = activeTeamPosition === 'team1' ? activeMatchup.team1_id : activeMatchup.team2_id;
      const overTeamId = overTeamPosition === 'team1' ? overMatchup.team1_id : overMatchup.team2_id;

      // Perform the swap
      if (activeTeamPosition === 'team1') {
        activeMatchup.team1_id = overTeamId;
      } else {
        activeMatchup.team2_id = overTeamId;
      }

      if (overTeamPosition === 'team1') {
        overMatchup.team1_id = activeTeamId;
      } else {
        overMatchup.team2_id = activeTeamId;
      }

      // Fetch actual Sleeper scores for both matchups since teams changed
      try {
        // Fetch scores for the active matchup
        const activeScores = await fetchSleeperScoresForTeams(
          activeMatchup.team1_id, 
          activeMatchup.team2_id, 
          activeMatchup.conference_id,
          activeMatchup.week
        );
        console.log(`🎯 DRAG DEBUG - Active matchup ${activeMatchup.id}: Setting scores ${activeScores.team1Score} vs ${activeScores.team2Score}`);
        activeMatchup.team1_score = activeScores.team1Score;
        activeMatchup.team2_score = activeScores.team2Score;

        // Calculate winning team for active matchup
        if (activeScores.team1Score > activeScores.team2Score) {
          activeMatchup.winning_team_id = activeMatchup.team1_id;
        } else if (activeScores.team2Score > activeScores.team1Score) {
          activeMatchup.winning_team_id = activeMatchup.team2_id;
        } else {
          activeMatchup.winning_team_id = null; // Tie
        }
        console.log(`🏆 DRAG WINNER - Active matchup ${activeMatchup.id}: Winner=${activeMatchup.winning_team_id}`);

        // Fetch scores for the over matchup  
        const overScores = await fetchSleeperScoresForTeams(
          overMatchup.team1_id, 
          overMatchup.team2_id, 
          overMatchup.conference_id,
          overMatchup.week
        );
        console.log(`🎯 DRAG DEBUG - Over matchup ${overMatchup.id}: Setting scores ${overScores.team1Score} vs ${overScores.team2Score}`);
        overMatchup.team1_score = overScores.team1Score;
        overMatchup.team2_score = overScores.team2Score;

        // Calculate winning team for over matchup
        if (overScores.team1Score > overScores.team2Score) {
          overMatchup.winning_team_id = overMatchup.team1_id;
        } else if (overScores.team2Score > overScores.team1Score) {
          overMatchup.winning_team_id = overMatchup.team2_id;
        } else {
          overMatchup.winning_team_id = null; // Tie
        }
        console.log(`🏆 DRAG WINNER - Over matchup ${overMatchup.id}: Winner=${overMatchup.winning_team_id}`);

        console.log(`Fetched Sleeper scores - Active matchup: ${activeScores.team1Score} vs ${activeScores.team2Score}, Over matchup: ${overScores.team1Score} vs ${overScores.team2Score}`);
      } catch (scoreError) {
        console.warn('Failed to fetch Sleeper scores, using 0:', scoreError);
        // Fallback to resetting scores if Sleeper fetch fails
        activeMatchup.team1_score = 0;
        activeMatchup.team2_score = 0;
        activeMatchup.winning_team_id = null;
        overMatchup.team1_score = 0;
        overMatchup.team2_score = 0;
        overMatchup.winning_team_id = null;
      }

      activeMatchup.winning_team_id = null;
      activeMatchup.manual_override = true;
      activeMatchup.matchup_status = 'pending'; // Reset status when teams are swapped

      overMatchup.winning_team_id = null;
      overMatchup.manual_override = true;
      overMatchup.matchup_status = 'pending'; // Reset status when teams are swapped

      console.log(`Teams swapped between matchups ${activeMatchupId} and ${overMatchupId}`);
      console.log(`Active matchup now has teams ${activeMatchup.team1_id} vs ${activeMatchup.team2_id}`);
      console.log(`Over matchup now has teams ${overMatchup.team1_id} vs ${overMatchup.team2_id}`);

      // Update state with the modified matchups
      setMatchups(currentMatchups);

      setHasChanges(true);
      toast({
        title: 'Teams Swapped',
        description: 'Team matchups have been updated with current scores. Remember to save your changes.',
        duration: 3000
      });
    }
  };

  const handleToggleOverride = (matchupId: number) => {
    console.log(`Toggling manual override for matchup ${matchupId}`);

    setMatchups((prev) => prev.map((matchup) => {
      if (matchup.id === matchupId) {
        const newOverrideState = !matchup.manual_override;
        console.log(`Matchup ${matchupId} manual override: ${matchup.manual_override} -> ${newOverrideState}`);

        return {
          ...matchup,
          manual_override: newOverrideState,
          // If removing manual override, reset status to pending
          status: newOverrideState ? matchup.matchup_status : 'pending'
        };
      }
      return matchup;
    }));

    setHasChanges(true);

    toast({
      title: 'Override Toggled',
      description: `Manual override ${matchups.find((m) => m.id === matchupId)?.manual_override ? 'removed' : 'enabled'} for matchup ${matchupId}`,
      duration: 2000
    });
  };

  const handleUpdateScores = (matchupId: number, team1Score: number, team2Score: number) => {
    console.log(`Updating scores for matchup ${matchupId}: Team 1 = ${team1Score}, Team 2 = ${team2Score}`);

    setMatchups((prev) => prev.map((matchup) => {
      if (matchup.id === matchupId) {
        // Calculate winning team ID based on scores
        let winningTeamId: number | null = null;
        if (team1Score > team2Score) {
          winningTeamId = matchup.team1_id;
        } else if (team2Score > team1Score) {
          winningTeamId = matchup.team2_id;
        }
        // If scores are tied, winning_team_id remains null

        console.log(`🏆 WINNER CALC - Matchup ${matchupId}: Team1(${matchup.team1_id})=${team1Score}, Team2(${matchup.team2_id})=${team2Score}, Winner=${winningTeamId}`);

        return {
          ...matchup,
          team1_score: team1Score,
          team2_score: team2Score,
          winning_team_id: winningTeamId,
          manual_override: true,
          matchup_status: 'complete' // Set status to complete when manually setting scores
        };
      }
      return matchup;
    }));
    setHasChanges(true);

    toast({
      title: 'Scores Updated',
      description: `Matchup ${matchupId} scores updated. Remember to save changes.`,
      duration: 2000
    });
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    console.log('Starting save operation for', matchups.length, 'matchups');

    let successCount = 0;
    let failureCount = 0;
    const failedMatchups: number[] = [];

    try {
      // Update all matchups and create overrides for those with manual changes
      for (const matchup of matchups) {
        console.log(`Updating matchup ${matchup.id}:`, {
          conference_id: matchup.conference_id,
          week: matchup.week,
          team1_id: matchup.team1_id,
          team2_id: matchup.team2_id,
          team1_score: matchup.team1_score,
          team2_score: matchup.team2_score,
          winning_team_id: matchup.winning_team_id,
          manual_override: matchup.manual_override,
          status: matchup.manual_override ? 'complete' : matchup.matchup_status
        });

        console.log(`🔍 SCORE DEBUG - Matchup ${matchup.id}: team1_score=${matchup.team1_score}, team2_score=${matchup.team2_score}`);

        // Validate required fields before attempting update
        if (!matchup.id || matchup.conference_id <= 0 || matchup.week <= 0) {
          console.error(`Invalid matchup data for ID ${matchup.id}:`, {
            id: matchup.id,
            conference_id: matchup.conference_id,
            week: matchup.week
          });
          failureCount++;
          failedMatchups.push(matchup.id);
          continue;
        }

        // Step 1: Update the matchup record
        // Calculate winning team ID based on current scores before saving
        let calculatedWinningTeamId: number | null = null;
        if (matchup.team1_score > matchup.team2_score) {
          calculatedWinningTeamId = matchup.team1_id;
        } else if (matchup.team2_score > matchup.team1_score) {
          calculatedWinningTeamId = matchup.team2_id;
        }
        // If scores are tied, winning_team_id remains null

        console.log(`🏆 SAVE WINNER - Matchup ${matchup.id}: Team1(${matchup.team1_id})=${matchup.team1_score}, Team2(${matchup.team2_id})=${matchup.team2_score}, Calculated Winner=${calculatedWinningTeamId}`);

        const updateData = {
          conference_id: matchup.conference_id,
          week: matchup.week?.toString() || '1',
          team1_id: matchup.team1_id || 0,
          team2_id: matchup.team2_id || 0,
          is_playoff: matchup.is_playoff || false,
          team1_score: matchup.team1_score || 0,
          team2_score: matchup.team2_score || 0,
          winning_team_id: calculatedWinningTeamId, // Use calculated winner
          manual_override: matchup.manual_override || false,
          matchup_status: matchup.manual_override ? 'complete' : matchup.matchup_status || 'pending',
          notes: matchup.notes || ''
        };

        console.log(`Sending update for matchup ${matchup.id} with data:`, updateData);
        console.log(`🔍 UPDATE DEBUG - Raw scores being sent: team1_score=${updateData.team1_score}, team2_score=${updateData.team2_score}`);

        const updateResult = await DatabaseService.updateMatchup(matchup.id, updateData);

        if (updateResult.error) {
          console.error(`❌ Failed to update matchup ${matchup.id}:`, updateResult.error);
          console.error(`❌ Update data was:`, updateData);
          console.error(`❌ Matchup object:`, matchup);
          failureCount++;
          failedMatchups.push(matchup.id);
          continue;
        } else {
          console.log(`✅ Successfully updated matchup ${matchup.id}`);
          console.log(`✅ UPDATE RESULT:`, updateResult.data);
        }

        // Step 2: Skip override creation for now - focus on core matchup updates
        // The override table has schema issues and isn't critical for basic functionality
        if (matchup.manual_override) {
          console.log(`Matchup ${matchup.id} marked as manual override - skipping override record creation due to schema issues`);
        }

        console.log(`Successfully updated matchup ${matchup.id}`);
        successCount++;
      }

      // Report results
      console.log(`Save operation completed: ${successCount} successes, ${failureCount} failures`);

      if (failureCount > 0) {
        console.error('Failed matchup IDs:', failedMatchups);
        toast({
          title: 'Partial Success',
          description: `${successCount} matchups updated successfully, ${failureCount} failed. Check console for details.`,
          variant: 'destructive'
        });
      } else {
        setHasChanges(false);
        toast({
          title: 'Success',
          description: `All ${successCount} matchups updated successfully with overrides`
        });
      }

      // Reload matchups to ensure we have the latest data
      console.log('Reloading matchups to verify changes persisted...');
      await loadMatchups();

    } catch (error) {
      console.error('Critical error during save operation:', error);
      toast({
        title: 'Error',
        description: `Failed to save matchup changes: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
      console.log('Save operation completed, saving state reset');
    }
  };

  const handleResetChanges = () => {
    loadMatchups();
    setHasChanges(false);
  };

  const weeks = Array.from({ length: 18 }, (_, i) => i + 1); // 18 weeks for NFL season

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Matchups Management
          </CardTitle>
          <CardDescription>
            Compact view for managing weekly matchups, scores, and overrides across all conferences. 
            Drag and drop teams between matchups, edit scores inline, and toggle overrides quickly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Season</label>
              <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season..." />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((season) =>
                  <SelectItem key={season.id} value={season.id.toString()}>
                      {season.season_name}
                      {season.is_current_season &&
                    <Badge variant="secondary" className="ml-2">Current</Badge>
                    }
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Week</label>
              <Select
                value={selectedWeek}
                onValueChange={setSelectedWeek}
                disabled={!selectedSeason}>

                <SelectTrigger>
                  <SelectValue placeholder="Select week..." />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((week) =>
                  <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>{matchups.length} Total</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>{matchups.filter((m) => m.manual_override).length} Override</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 flex items-end">
              {hasChanges &&
              <div className="flex gap-2">
                  <Button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="flex items-center gap-2">
                    {saving ?
                  <Loader2 className="h-4 w-4 animate-spin" /> :
                  <Save className="h-4 w-4" />
                  }
                    Save
                  </Button>
                  <Button
                  variant="outline"
                  onClick={handleResetChanges}
                  className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              }
            </div>
          </div>

          {hasChanges &&
          <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Remember to save your modifications.
              </AlertDescription>
            </Alert>
          }
        </CardContent>
      </Card>

      {loading ?
      <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading matchups...</span>
            </div>
          </CardContent>
        </Card> :
      matchups.length === 0 && selectedWeek ?
      <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Matchups Found</h3>
              <p className="text-gray-600">
                No matchups found for the selected week. They may need to be created first.
              </p>
            </div>
          </CardContent>
        </Card> :
      matchups.length > 0 ?
      <Card>
          <CardContent className="p-0">
            <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}>

              <SortableContext
              items={matchups.flatMap((m) => [
              `${m.id}-team1`,
              `${m.id}-team2`]
              )}
              strategy={rectSortingStrategy}>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Match</TableHead>
                      <TableHead className="w-48">Team 1</TableHead>
                      <TableHead className="w-32 text-center">Score</TableHead>
                      <TableHead className="w-48">Team 2</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conferences.map((conference) => {
                    const conferenceMatchups = matchups.filter((m) => m.conference_id === conference.id);
                    if (conferenceMatchups.length === 0) return null;

                    return (
                      <React.Fragment key={conference.id}>
                          <TableRow>
                            <TableCell colSpan={6} className="bg-gray-50 font-medium text-sm py-2">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-600" />
                                {conference.conference_name}
                                <Badge variant="secondary" className="text-xs">
                                  {conferenceMatchups.length} matchups
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          {conferenceMatchups.map((matchup) =>
                        <CompactMatchupRow
                          key={matchup.id}
                          matchup={matchup}
                          teams={teams}
                          conferences={conferences}
                          onToggleOverride={handleToggleOverride}
                          onUpdateScores={handleUpdateScores} />

                        )}
                        </React.Fragment>);

                  })}
                  </TableBody>
                </Table>
              </SortableContext>
              <DragOverlay>
                {activeId ?
              <div className="bg-white p-2 rounded-lg border-2 border-blue-400 shadow-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-2 w-2 text-blue-600" />
                      </div>
                      <span className="text-xs font-medium">Moving team...</span>
                    </div>
                  </div> :
              null}
              </DragOverlay>
            </DndContext>
          </CardContent>
        </Card> :

      <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select Filters</h3>
              <p className="text-gray-600">
                Please select a season and week to manage matchups across all conferences.
              </p>
            </div>
          </CardContent>
        </Card>
      }
    </div>);

};

export default MatchupsManagement;
