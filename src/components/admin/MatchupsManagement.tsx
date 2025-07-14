import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
  is_manual_override: boolean;
  status: string;
  matchup_date: string;
  notes: string;
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
  const team1 = teams.find((t) => t.id === matchup.team_1_id);
  const team2 = teams.find((t) => t.id === matchup.team_2_id);
  const conference = conferences.find((c) => c.id === matchup.conference_id);

  const [editingScores, setEditingScores] = useState(false);
  const [team1Score, setTeam1Score] = useState(matchup.team_1_score);
  const [team2Score, setTeam2Score] = useState(matchup.team_2_score);

  const isTeam1Winner = matchup.winner_id === matchup.team_1_id;
  const isTeam2Winner = matchup.winner_id === matchup.team_2_id;

  const handleSaveScores = () => {
    onUpdateScores(matchup.id, team1Score, team2Score);
    setEditingScores(false);
  };

  const handleCancelEdit = () => {
    setTeam1Score(matchup.team_1_score);
    setTeam2Score(matchup.team_2_score);
    setEditingScores(false);
  };

  return (
    <TableRow className={`transition-colors ${
    matchup.is_manual_override ? 'bg-orange-50 border-orange-200' : ''}`
    }>
      {/* Matchup Info */}
      <TableCell className="w-24">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">#{matchup.id}</span>
          <div className="flex flex-col gap-1">
            {matchup.is_manual_override &&
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
              {matchup.team_1_score}
            </span>
            <span className="text-xs text-gray-400">-</span>
            <span className={`text-sm font-bold ${isTeam2Winner ? 'text-green-600' : ''}`}>
              {matchup.team_2_score}
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
          {matchup.status}
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

  // Load initial data
  useEffect(() => {
    loadSeasons();
    loadTeams();
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

  const loadSeasons = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'season_year',
        IsAsc: false
      });
      if (error) throw error;
      setSeasons(data.List || []);

      // Auto-select current season
      const currentSeason = data.List?.find((s: Season) => s.is_current_season);
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
      const { data, error } = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 100,
        Filters: [
        { name: 'season_id', op: 'Equal', value: parseInt(selectedSeason) }]

      });
      if (error) throw error;
      setConferences(data.List || []);
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
      const { data, error } = await window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 100
      });
      if (error) throw error;

      // Also load team-conference junction data
      const { data: junctionData, error: junctionError } = await window.ezsite.apis.tablePage(12853, {
        PageNo: 1,
        PageSize: 1000
      });
      if (junctionError) throw junctionError;

      // Combine team data with conference associations
      const teamsWithConferences = data.List?.map((team: Team) => {
        const junction = junctionData.List?.find((j: any) => j.team_id === team.id);
        return {
          ...team,
          conference_id: junction?.conference_id || 0
        };
      }) || [];

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

        const { data, error } = await window.ezsite.apis.tablePage(13329, {
          PageNo: 1,
          PageSize: 100,
          Filters: [
          { name: 'conference_id', op: 'Equal', value: conferenceId },
          { name: 'week', op: 'Equal', value: parseInt(selectedWeek) }],

          OrderByField: 'id',
          IsAsc: true
        });

        if (error) {
          console.error(`Error fetching matchups for conference ${conferenceId}:`, error);
          throw error;
        }

        console.log(`Found ${data.List?.length || 0} matchups for conference ${conferenceId}`);

        const conference = conferences.find((c) => c.id === conferenceId);
        const matchupsWithConference = (data.List || []).map((matchup: Matchup) => {
          console.log(`Loaded matchup ${matchup.id}:`, {
            teams: `${matchup.team_1_id} vs ${matchup.team_2_id}`,
            scores: `${matchup.team_1_score} - ${matchup.team_2_score}`,
            status: matchup.status,
            manual_override: matchup.is_manual_override
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
        pending: allMatchups.filter((m) => m.status === 'pending').length,
        complete: allMatchups.filter((m) => m.status === 'complete').length,
        manual_overrides: allMatchups.filter((m) => m.is_manual_override).length
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

  const handleDragEnd = (event: DragEndEvent) => {
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

      setMatchups((prevMatchups) => {
        const updatedMatchups = [...prevMatchups];

        const activeMatchup = updatedMatchups.find((m) => m.id === activeMatchupId);
        const overMatchup = updatedMatchups.find((m) => m.id === overMatchupId);

        if (!activeMatchup || !overMatchup) return prevMatchups;

        // Get the team IDs to swap
        const activeTeamId = activeTeamPosition === 'team1' ? activeMatchup.team_1_id : activeMatchup.team_2_id;
        const overTeamId = overTeamPosition === 'team1' ? overMatchup.team_1_id : overMatchup.team_2_id;

        // Perform the swap
        if (activeTeamPosition === 'team1') {
          activeMatchup.team_1_id = overTeamId;
        } else {
          activeMatchup.team_2_id = overTeamId;
        }

        if (overTeamPosition === 'team1') {
          overMatchup.team_1_id = activeTeamId;
        } else {
          overMatchup.team_2_id = activeTeamId;
        }

        // Reset scores and winner for both matchups since teams changed
        activeMatchup.team_1_score = 0;
        activeMatchup.team_2_score = 0;
        activeMatchup.winner_id = 0;
        activeMatchup.is_manual_override = true;
        activeMatchup.status = 'pending'; // Reset status when teams are swapped

        overMatchup.team_1_score = 0;
        overMatchup.team_2_score = 0;
        overMatchup.winner_id = 0;
        overMatchup.is_manual_override = true;
        overMatchup.status = 'pending'; // Reset status when teams are swapped

        console.log(`Teams swapped between matchups ${activeMatchupId} and ${overMatchupId}`);
        console.log(`Active matchup now has teams ${activeMatchup.team_1_id} vs ${activeMatchup.team_2_id}`);
        console.log(`Over matchup now has teams ${overMatchup.team_1_id} vs ${overMatchup.team_2_id}`);

        return updatedMatchups;
      });

      setHasChanges(true);
      toast({
        title: 'Teams Swapped',
        description: 'Team matchups have been updated. Remember to save your changes.',
        duration: 3000
      });
    }
  };

  const handleToggleOverride = (matchupId: number) => {
    console.log(`Toggling manual override for matchup ${matchupId}`);

    setMatchups((prev) => prev.map((matchup) => {
      if (matchup.id === matchupId) {
        const newOverrideState = !matchup.is_manual_override;
        console.log(`Matchup ${matchupId} manual override: ${matchup.is_manual_override} -> ${newOverrideState}`);

        return {
          ...matchup,
          is_manual_override: newOverrideState,
          // If removing manual override, reset status to pending
          status: newOverrideState ? matchup.status : 'pending'
        };
      }
      return matchup;
    }));

    setHasChanges(true);

    toast({
      title: 'Override Toggled',
      description: `Manual override ${matchups.find((m) => m.id === matchupId)?.is_manual_override ? 'removed' : 'enabled'} for matchup ${matchupId}`,
      duration: 2000
    });
  };

  const handleUpdateScores = (matchupId: number, team1Score: number, team2Score: number) => {
    console.log(`Updating scores for matchup ${matchupId}: Team 1 = ${team1Score}, Team 2 = ${team2Score}`);

    setMatchups((prev) => prev.map((matchup) =>
    matchup.id === matchupId ?
    {
      ...matchup,
      team_1_score: team1Score,
      team_2_score: team2Score,
      winner_id: team1Score > team2Score ? matchup.team_1_id :
      team2Score > team1Score ? matchup.team_2_id : 0,
      is_manual_override: true,
      status: 'complete' // Set status to complete when manually setting scores
    } :
    matchup
    ));
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
          team_1_id: matchup.team_1_id,
          team_2_id: matchup.team_2_id,
          team_1_score: matchup.team_1_score,
          team_2_score: matchup.team_2_score,
          winner_id: matchup.winner_id,
          is_manual_override: matchup.is_manual_override,
          status: matchup.is_manual_override ? 'complete' : matchup.status
        });

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
        const updateData = {
          ID: matchup.id,
          conference_id: matchup.conference_id,
          week: matchup.week,
          team_1_id: matchup.team_1_id,
          team_2_id: matchup.team_2_id,
          is_playoff: matchup.is_playoff,
          sleeper_matchup_id: matchup.sleeper_matchup_id || '',
          team_1_score: matchup.team_1_score,
          team_2_score: matchup.team_2_score,
          winner_id: matchup.winner_id,
          is_manual_override: matchup.is_manual_override,
          status: matchup.is_manual_override ? 'complete' : matchup.status || 'pending',
          matchup_date: matchup.matchup_date || '',
          notes: matchup.notes || ''
        };

        console.log(`Sending update for matchup ${matchup.id} with data:`, updateData);

        const { error } = await window.ezsite.apis.tableUpdate(13329, updateData);

        if (error) {
          console.error(`Failed to update matchup ${matchup.id}:`, error);
          failureCount++;
          failedMatchups.push(matchup.id);
          continue;
        }

        // Step 2: If this is a manual override, create/update the override record
        if (matchup.is_manual_override) {
          try {
            console.log(`Looking up roster IDs for teams ${matchup.team_1_id} and ${matchup.team_2_id} (cross-conference support)`);

            // Get roster IDs for the teams using active season/conference context
            const team1RosterResponse = await window.ezsite.apis.tablePage(12853, {
              PageNo: 1,
              PageSize: 50,
              Filters: [
              { name: 'team_id', op: 'Equal', value: matchup.team_1_id },
              { name: 'is_active', op: 'Equal', value: true }]

            });

            const team2RosterResponse = await window.ezsite.apis.tablePage(12853, {
              PageNo: 1,
              PageSize: 50,
              Filters: [
              { name: 'team_id', op: 'Equal', value: matchup.team_2_id },
              { name: 'is_active', op: 'Equal', value: true }]

            });

            console.log(`Team 1 roster lookup result:`, team1RosterResponse.data?.List?.length || 0, 'active entries found');
            console.log(`Team 2 roster lookup result:`, team2RosterResponse.data?.List?.length || 0, 'active entries found');

            // For cross-conference scenarios, prioritize roster ID from current season's conferences
            let team1RosterId = '';
            let team2RosterId = '';
            let team1ConferenceId = matchup.conference_id;
            let team2ConferenceId = matchup.conference_id;

            if (team1RosterResponse.data?.List?.length > 0) {
              // Try to find roster entry matching current season's conferences first
              const preferredTeam1Entry = team1RosterResponse.data.List.find((entry: any) =>
              conferences.some((c) => c.id === entry.conference_id)
              );

              const team1Entry = preferredTeam1Entry || team1RosterResponse.data.List[0];
              team1RosterId = team1Entry?.roster_id || '';
              team1ConferenceId = team1Entry?.conference_id || matchup.conference_id;

              console.log(`Team 1 (${matchup.team_1_id}) roster ID: ${team1RosterId} from conference ${team1ConferenceId}${preferredTeam1Entry ? ' (preferred)' : ' (fallback)'}`);
            } else {
              console.warn(`No active roster entry found for team ${matchup.team_1_id}`);
            }

            if (team2RosterResponse.data?.List?.length > 0) {
              // Try to find roster entry matching current season's conferences first
              const preferredTeam2Entry = team2RosterResponse.data.List.find((entry: any) =>
              conferences.some((c) => c.id === entry.conference_id)
              );

              const team2Entry = preferredTeam2Entry || team2RosterResponse.data.List[0];
              team2RosterId = team2Entry?.roster_id || '';
              team2ConferenceId = team2Entry?.conference_id || matchup.conference_id;

              console.log(`Team 2 (${matchup.team_2_id}) roster ID: ${team2RosterId} from conference ${team2ConferenceId}${preferredTeam2Entry ? ' (preferred)' : ' (fallback)'}`);
            } else {
              console.warn(`No active roster entry found for team ${matchup.team_2_id}`);
            }

            // Validate that we have roster IDs before proceeding
            if (!team1RosterId || !team2RosterId) {
              console.error(`Missing roster IDs - Team 1: ${team1RosterId}, Team 2: ${team2RosterId}`);
              throw new Error(`Cannot create override: Missing roster IDs for teams ${matchup.team_1_id} and/or ${matchup.team_2_id}`);
            }

            // Create override record with cross-conference support
            const overrideData = {
              season_id: parseInt(selectedSeason),
              week: matchup.week,
              conference_id: matchup.conference_id,
              matchup_id: matchup.id,
              team_1_id: matchup.team_1_id,
              team_2_id: matchup.team_2_id,
              team_1_roster_id: team1RosterId,
              team_2_roster_id: team2RosterId,
              is_active: true,
              created_by: 'admin',
              notes: `Override created for matchup ${matchup.id} - Teams: ${matchup.team_1_id} (conf: ${team1ConferenceId}) vs ${matchup.team_2_id} (conf: ${team2ConferenceId})`
            };

            console.log(`Creating override for matchup ${matchup.id}:`, overrideData);
            console.log(`Override validation - Season: ${selectedSeason}, Week: ${matchup.week}, Conference: ${matchup.conference_id}`);
            console.log(`Roster mapping - Team ${matchup.team_1_id}: ${team1RosterId}, Team ${matchup.team_2_id}: ${team2RosterId}`);

            // Check if override already exists and delete it first
            const existingOverrideResponse = await window.ezsite.apis.tablePage(27780, {
              PageNo: 1,
              PageSize: 10,
              Filters: [
              { name: 'season_id', op: 'Equal', value: parseInt(selectedSeason) },
              { name: 'week', op: 'Equal', value: matchup.week },
              { name: 'matchup_id', op: 'Equal', value: matchup.id }]

            });

            if (existingOverrideResponse.data?.List?.length > 0) {
              console.log(`Found existing override for matchup ${matchup.id}, deleting it first`);
              for (const existingOverride of existingOverrideResponse.data.List) {
                await window.ezsite.apis.tableDelete(27780, { ID: existingOverride.id });
              }
            }

            const { error: overrideError } = await window.ezsite.apis.tableCreate(27780, overrideData);

            if (overrideError) {
              console.error(`Failed to create override for matchup ${matchup.id}:`, overrideError);
              console.error(`Override data that failed:`, overrideData);
              // Don't fail the whole operation, but log the error prominently
              toast({
                title: 'Override Warning',
                description: `Failed to create override record for matchup ${matchup.id}: ${overrideError}`,
                variant: 'destructive',
                duration: 5000
              });
            } else {
              console.log(`Successfully created override for matchup ${matchup.id} with roster mappings`);
            }
          } catch (overrideError) {
            console.warn(`Error creating override for matchup ${matchup.id}:`, overrideError);
          }
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
                  <span>{matchups.filter((m) => m.is_manual_override).length} Override</span>
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