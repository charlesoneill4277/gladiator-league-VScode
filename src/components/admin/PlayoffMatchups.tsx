import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService, DbPlayoffBracket } from '@/services/databaseService';
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
  Trophy,
  Users,
  AlertTriangle,
  Save,
  RotateCcw,
  Edit,
  GripVertical,
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

interface Team {
  id: number;
  team_name: string;
  owner_name: string;
  team_logo_url: string;
}

interface PlayoffBracket extends DbPlayoffBracket {
  manual_override?: boolean;
}

interface SortableTeamCellProps {
  team: Team | null;
  bracketId: number;
  teamPosition: 'team1' | 'team2';
  isWinner: boolean;
}

interface EditableTeamCellProps {
  team: Team | null;
  bracketId: number;
  teamPosition: 'team1' | 'team2';
  isWinner: boolean;
  allTeams: Team[];
  onTeamChange: (bracketId: number, teamPosition: 'team1' | 'team2', newTeamId: number) => void;
}

interface PlayoffMatchupRowProps {
  bracket: PlayoffBracket;
  teams: Team[];
  allTeams: Team[];
  onToggleOverride: (bracketId: number) => void;
  onUpdateScores: (bracketId: number, team1Score: number, team2Score: number) => void;
  onUpdateTeams: (bracketId: number, team1Id: number, team2Id: number) => void;
  onTeamChange: (bracketId: number, teamPosition: 'team1' | 'team2', newTeamId: number) => void;
}

const SortableTeamCell: React.FC<SortableTeamCellProps> = ({
  team,
  bracketId,
  teamPosition,
  isWinner
}) => {
  const teamId = `${bracketId}-${teamPosition}`;
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
      bracketId,
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

const EditableTeamCell: React.FC<EditableTeamCellProps> = ({
  team,
  bracketId,
  teamPosition,
  isWinner,
  allTeams,
  onTeamChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(team?.id?.toString() || '');

  // Update selected team when team prop changes
  useEffect(() => {
    setSelectedTeamId(team?.id?.toString() || '');
  }, [team?.id]);

  const handleSaveTeamChange = () => {
    const newTeamId = parseInt(selectedTeamId);
    if (newTeamId && newTeamId !== team?.id) {
      onTeamChange(bracketId, teamPosition, newTeamId);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setSelectedTeamId(team?.id?.toString() || '');
    setIsEditing(false);
  };

  const teamId = `${bracketId}-${teamPosition}`;
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
      bracketId,
      teamPosition
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 rounded border border-blue-200 bg-blue-50">
        <div className="flex-1">
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select team..." />
            </SelectTrigger>
            <SelectContent>
              {allTeams.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  <div className="flex items-center gap-2">
                    {t.team_logo_url && (
                      <img
                        src={t.team_logo_url}
                        alt={t.team_name}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    <div>
                      <div className="text-xs font-medium">{t.team_name}</div>
                      <div className="text-xs text-gray-500">{t.owner_name}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={handleSaveTeamChange}
          className="h-6 w-6 p-0"
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancelEdit}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded transition-colors group
        ${isDragging ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
        ${isWinner ? 'bg-green-50 border border-green-200' : ''}
      `}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3 text-gray-400" />
      </div>
      {team?.team_logo_url && (
        <img
          src={team.team_logo_url}
          alt={team.team_name}
          className="w-5 h-5 rounded-full"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {team?.team_name || `Team ${teamPosition === 'team1' ? '1' : '2'}`}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {team?.owner_name}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  );
};

const PlayoffMatchupRow: React.FC<PlayoffMatchupRowProps> = ({
  bracket,
  teams,
  allTeams,
  onToggleOverride,
  onUpdateScores,
  onUpdateTeams,
  onTeamChange
}) => {
  const team1 = teams.find((t) => t.id === bracket.team1_id);
  const team2 = teams.find((t) => t.id === bracket.team2_id);

  const [editingScores, setEditingScores] = useState(false);
  const [team1Score, setTeam1Score] = useState(bracket.team1_score || 0);
  const [team2Score, setTeam2Score] = useState(bracket.team2_score || 0);

  // Update local state when bracket scores change from parent
  useEffect(() => {
    setTeam1Score(bracket.team1_score || 0);
    setTeam2Score(bracket.team2_score || 0);
  }, [bracket.team1_score, bracket.team2_score]);

  const isTeam1Winner = bracket.winning_team_id === bracket.team1_id;
  const isTeam2Winner = bracket.winning_team_id === bracket.team2_id;

  const handleSaveScores = () => {
    onUpdateScores(bracket.id, team1Score, team2Score);
    setEditingScores(false);
  };

  const handleCancelEdit = () => {
    setTeam1Score(bracket.team1_score || 0);
    setTeam2Score(bracket.team2_score || 0);
    setEditingScores(false);
  };

  return (
    <TableRow className={`transition-colors ${
    bracket.manual_override ? 'bg-orange-50 border-orange-200' : ''}`
    }>
      {/* Matchup Info */}
      <TableCell className="w-32">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">#{bracket.id}</span>
          <div className="text-xs text-gray-500">
            {bracket.playoff_round_name || `Round ${bracket.round}`}
          </div>
          <div className="text-xs text-gray-500">
            Week {bracket.week}
          </div>
          {bracket.manual_override &&
          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 px-1 py-0">
              Override
            </Badge>
          }
          {bracket.is_bye &&
          <Badge variant="secondary" className="text-xs px-1 py-0">
              Bye
            </Badge>
          }
        </div>
      </TableCell>

      {/* Team 1 */}
      <TableCell className="w-48">
        <EditableTeamCell
          team={team1}
          bracketId={bracket.id}
          teamPosition="team1"
          isWinner={isTeam1Winner}
          allTeams={allTeams}
          onTeamChange={onTeamChange} />

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
              {bracket.team1_score || 0}
            </span>
            <span className="text-xs text-gray-400">-</span>
            <span className={`text-sm font-bold ${isTeam2Winner ? 'text-green-600' : ''}`}>
              {bracket.team2_score || 0}
            </span>
            <Edit className="h-3 w-3 text-gray-400 ml-1" />
          </div>
        }
      </TableCell>

      {/* Team 2 */}
      <TableCell className="w-48">
        <EditableTeamCell
          team={team2}
          bracketId={bracket.id}
          teamPosition="team2"
          isWinner={isTeam2Winner}
          allTeams={allTeams}
          onTeamChange={onTeamChange} />

      </TableCell>

      {/* Seeds */}
      <TableCell className="w-24 text-center">
        <div className="text-xs text-gray-500">
          <div>#{bracket.team1_seed}</div>
          <div>vs</div>
          <div>#{bracket.team2_seed}</div>
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="w-24 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleOverride(bracket.id)}
          className="h-6 px-2 text-xs">

          <Edit className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>);

};

const PlayoffMatchups: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [brackets, setBrackets] = useState<PlayoffBracket[]>([]);
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

  // Helper function to fetch playoff scores for teams
  const fetchPlayoffScoresForTeams = async (
    team1Id: number, 
    team2Id: number, 
    week: number
  ): Promise<{ team1Score: number; team2Score: number }> => {
    try {
      console.log(`Fetching playoff scores for teams ${team1Id} and ${team2Id} for week ${week}`);
      
      // Step 1: Get the conference and roster info for EACH team individually
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

      // Step 2: Get conferences to find league_ids
      const [team1ConferenceResult, team2ConferenceResult] = await Promise.all([
        DatabaseService.getConferences({
          filters: [
            { column: 'id', operator: 'eq', value: team1Junction.conference_id }
          ]
        }),
        DatabaseService.getConferences({
          filters: [
            { column: 'id', operator: 'eq', value: team2Junction.conference_id }
          ]
        })
      ]);

      const team1Conference = team1ConferenceResult.data?.[0];
      const team2Conference = team2ConferenceResult.data?.[0];

      if (!team1Conference || !team2Conference) {
        console.warn(`Missing conference data - Team ${team1Id} conference: ${team1Conference ? 'found' : 'missing'}, Team ${team2Id} conference: ${team2Conference ? 'found' : 'missing'}`);
        return { team1Score: 0, team2Score: 0 };
      }

      console.log(`Team ${team1Id} in conference "${team1Conference.conference_name}" (league_id: ${team1Conference.league_id})`);
      console.log(`Team ${team2Id} in conference "${team2Conference.conference_name}" (league_id: ${team2Conference.league_id})`);

      // Step 3: Fetch Sleeper scores for each team from their respective leagues
      let team1Score = 0;
      let team2Score = 0;

      // Import SleeperApiService dynamically to avoid circular imports
      const { SleeperApiService } = await import('@/services/sleeperApi');

      // Fetch Team 1 score from its league
      try {
        console.log(`Fetching Team ${team1Id} playoff score from league ${team1Conference.league_id}, week ${week}`);
        const team1SleeperMatchups = await SleeperApiService.fetchMatchups(team1Conference.league_id, week);
        const team1SleeperData = team1SleeperMatchups.find(m => m.roster_id === team1Junction.roster_id);
        team1Score = team1SleeperData?.points || 0;
        console.log(`Team ${team1Id} playoff score from Sleeper: ${team1Score} (roster_id: ${team1Junction.roster_id})`);
      } catch (error) {
        console.error(`Error fetching Team ${team1Id} playoff score from league ${team1Conference.league_id}:`, error);
      }

      // Fetch Team 2 score from its league
      try {
        console.log(`Fetching Team ${team2Id} playoff score from league ${team2Conference.league_id}, week ${week}`);
        const team2SleeperMatchups = await SleeperApiService.fetchMatchups(team2Conference.league_id, week);
        const team2SleeperData = team2SleeperMatchups.find(m => m.roster_id === team2Junction.roster_id);
        team2Score = team2SleeperData?.points || 0;
        console.log(`Team ${team2Id} playoff score from Sleeper: ${team2Score} (roster_id: ${team2Junction.roster_id})`);
      } catch (error) {
        console.error(`Error fetching Team ${team2Id} playoff score from league ${team2Conference.league_id}:`, error);
      }

      console.log(`✅ Final playoff scores - Team ${team1Id}: ${team1Score}, Team ${team2Id}: ${team2Score}`);
      
      return { team1Score, team2Score };
    } catch (error) {
      console.error('Error fetching playoff scores:', error);
      return { team1Score: 0, team2Score: 0 };
    }
  };

  // Load initial data
  useEffect(() => {
    loadSeasons();
    loadTeams();
    loadCurrentWeek();
  }, []);

  // Load brackets when filters change
  useEffect(() => {
    if (selectedSeason && selectedWeek) {
      loadPlayoffBrackets();
    }
  }, [selectedSeason, selectedWeek]);

  const loadCurrentWeek = async () => {
    try {
      // For playoffs, default to week 14 (typical playoff start)
      setSelectedWeek('14');
    } catch (error) {
      console.error('Error setting default playoff week:', error);
      setSelectedWeek('14'); // Default to week 14
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

  const loadTeams = async () => {
    try {
      // Load teams using DatabaseService
      const teamsResult = await DatabaseService.getTeams({
        limit: 100,
        orderBy: { column: 'team_name', ascending: true }
      });
      
      if (teamsResult.error) throw new Error(teamsResult.error);
      const teamsData = teamsResult.data || [];

      // Map to Team interface
      const teams: Team[] = teamsData.map((team) => ({
        id: team.id,
        team_name: team.team_name,
        owner_name: team.owner_name,
        team_logo_url: team.team_logourl || '' // Handle different property names
      }));

      setTeams(teams);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive'
      });
    }
  };

  const loadPlayoffBrackets = async () => {
    setLoading(true);
    console.log(`Loading playoff brackets for season ${selectedSeason}, week ${selectedWeek}`);

    try {
      const { data, error } = await DatabaseService.getPlayoffBrackets({
        filters: [
          { column: 'season_id', operator: 'eq', value: parseInt(selectedSeason) },
          { column: 'week', operator: 'eq', value: parseInt(selectedWeek) }
        ],
        orderBy: { column: 'matchup_number', ascending: true }
      });

      if (error) {
        console.error(`Error fetching playoff brackets:`, error);
        throw new Error(error);
      }

      const playoffBrackets = data || [];
      console.log(`Found ${playoffBrackets.length} playoff brackets`);

      // Add manual_override field (defaulting to false since it's not in the schema)
      const bracketsWithOverride: PlayoffBracket[] = playoffBrackets.map((bracket) => ({
        ...bracket,
        manual_override: false // This will be managed in state
      }));

      console.log('Playoff brackets breakdown:', {
        total: bracketsWithOverride.length,
        byes: bracketsWithOverride.filter((b) => b.is_bye).length,
        completed: bracketsWithOverride.filter((b) => b.winning_team_id).length
      });

      setBrackets(bracketsWithOverride);
    } catch (error) {
      console.error('Error loading playoff brackets:', error);
      toast({
        title: 'Error',
        description: `Failed to load playoff brackets: ${error}`,
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
      const activeBracketId = activeData.bracketId;
      const activeTeamPosition = activeData.teamPosition;
      const overBracketId = overData.bracketId;
      const overTeamPosition = overData.teamPosition;

      // Prevent dropping on the same position
      if (activeBracketId === overBracketId && activeTeamPosition === overTeamPosition) {
        return;
      }

      // Get current brackets to work with
      const currentBrackets = [...brackets];
      const activeBracket = currentBrackets.find((b) => b.id === activeBracketId);
      const overBracket = currentBrackets.find((b) => b.id === overBracketId);

      if (!activeBracket || !overBracket) return;

      // Get the team IDs to swap
      const activeTeamId = activeTeamPosition === 'team1' ? activeBracket.team1_id : activeBracket.team2_id;
      const overTeamId = overTeamPosition === 'team1' ? overBracket.team1_id : overBracket.team2_id;

      // Perform the swap
      if (activeTeamPosition === 'team1') {
        activeBracket.team1_id = overTeamId;
      } else {
        activeBracket.team2_id = overTeamId;
      }

      if (overTeamPosition === 'team1') {
        overBracket.team1_id = activeTeamId;
      } else {
        overBracket.team2_id = activeTeamId;
      }

      // Mark as manual override
      activeBracket.manual_override = true;
      overBracket.manual_override = true;

      // Fetch updated scores for both brackets
      try {
        // Fetch scores for the active bracket
        const activeScores = await fetchPlayoffScoresForTeams(
          activeBracket.team1_id,
          activeBracket.team2_id,
          activeBracket.week
        );
        
        activeBracket.team1_score = activeScores.team1Score;
        activeBracket.team2_score = activeScores.team2Score;

        // Calculate winner for active bracket
        if (activeScores.team1Score > activeScores.team2Score) {
          activeBracket.winning_team_id = activeBracket.team1_id;
        } else if (activeScores.team2Score > activeScores.team1Score) {
          activeBracket.winning_team_id = activeBracket.team2_id;
        } else {
          activeBracket.winning_team_id = null;
        }

        // Fetch scores for the over bracket
        const overScores = await fetchPlayoffScoresForTeams(
          overBracket.team1_id,
          overBracket.team2_id,
          overBracket.week
        );
        
        overBracket.team1_score = overScores.team1Score;
        overBracket.team2_score = overScores.team2Score;

        // Calculate winner for over bracket
        if (overScores.team1Score > overScores.team2Score) {
          overBracket.winning_team_id = overBracket.team1_id;
        } else if (overScores.team2Score > overScores.team1Score) {
          overBracket.winning_team_id = overBracket.team2_id;
        } else {
          overBracket.winning_team_id = null;
        }

        console.log(`✅ Updated playoff scores - Active bracket: ${activeScores.team1Score} - ${activeScores.team2Score}, Over bracket: ${overScores.team1Score} - ${overScores.team2Score}`);

      } catch (error) {
        console.error('Error fetching playoff scores after team swap:', error);
        
        // Fallback: reset scores to 0 if fetching fails
        activeBracket.team1_score = 0;
        activeBracket.team2_score = 0;
        activeBracket.winning_team_id = null;

        overBracket.team1_score = 0;
        overBracket.team2_score = 0;
        overBracket.winning_team_id = null;
      }

      console.log(`Teams swapped between playoff brackets ${activeBracketId} and ${overBracketId}`);
      console.log(`Active bracket now has teams ${activeBracket.team1_id} vs ${activeBracket.team2_id}`);
      console.log(`Over bracket now has teams ${overBracket.team1_id} vs ${overBracket.team2_id}`);

      // Update state with the modified brackets
      setBrackets(currentBrackets);

      setHasChanges(true);
      toast({
        title: 'Teams Swapped',
        description: 'Playoff matchup teams have been updated with current scores. Remember to save your changes.',
        duration: 3000
      });
    }
  };

  const handleToggleOverride = (bracketId: number) => {
    console.log(`Toggling manual override for playoff bracket ${bracketId}`);

    setBrackets((prev) => prev.map((bracket) => {
      if (bracket.id === bracketId) {
        const newOverrideState = !bracket.manual_override;
        console.log(`Playoff bracket ${bracketId} manual override: ${bracket.manual_override} -> ${newOverrideState}`);

        return {
          ...bracket,
          manual_override: newOverrideState
        };
      }
      return bracket;
    }));

    setHasChanges(true);

    toast({
      title: 'Override Toggled',
      description: `Manual override ${brackets.find((b) => b.id === bracketId)?.manual_override ? 'removed' : 'enabled'} for playoff bracket ${bracketId}`,
      duration: 2000
    });
  };

  const handleUpdateScores = (bracketId: number, team1Score: number, team2Score: number) => {
    console.log(`Updating scores for playoff bracket ${bracketId}: Team 1 = ${team1Score}, Team 2 = ${team2Score}`);

    setBrackets((prev) => prev.map((bracket) => {
      if (bracket.id === bracketId) {
        // Calculate winning team ID based on scores
        let winnerTeamId: number | null = null;
        if (team1Score > team2Score) {
          winnerTeamId = bracket.team1_id;
        } else if (team2Score > team1Score) {
          winnerTeamId = bracket.team2_id;
        }
        // If scores are tied, winning_team_id remains null

        console.log(`🏆 PLAYOFF WINNER CALC - Bracket ${bracketId}: Team1(${bracket.team1_id})=${team1Score}, Team2(${bracket.team2_id})=${team2Score}, Winner=${winnerTeamId}`);

        return {
          ...bracket,
          team1_score: team1Score,
          team2_score: team2Score,
          winning_team_id: winnerTeamId,
          manual_override: true
        };
      }
      return bracket;
    }));
    setHasChanges(true);

    toast({
      title: 'Playoff Scores Updated',
      description: `Playoff bracket ${bracketId} scores updated. Remember to save changes.`,
      duration: 2000
    });
  };

  const handleUpdateTeams = (bracketId: number, team1Id: number, team2Id: number) => {
    setBrackets((prev) => prev.map((bracket) => {
      if (bracket.id === bracketId) {
        return {
          ...bracket,
          team1_id: team1Id,
          team2_id: team2Id,
          manual_override: true
        };
      }
      return bracket;
    }));
    setHasChanges(true);
  };

  const handleTeamChange = async (bracketId: number, teamPosition: 'team1' | 'team2', newTeamId: number) => {
    console.log(`Changing team for playoff bracket ${bracketId}, position ${teamPosition} to team ${newTeamId}`);

    // First update the bracket with the new team
    setBrackets((prev) => prev.map((bracket) => {
      if (bracket.id === bracketId) {
        const updatedBracket = {
          ...bracket,
          manual_override: true
        };

        // Update the specific team position
        if (teamPosition === 'team1') {
          updatedBracket.team1_id = newTeamId;
        } else {
          updatedBracket.team2_id = newTeamId;
        }

        console.log(`Updated bracket ${bracketId}: team1_id=${updatedBracket.team1_id}, team2_id=${updatedBracket.team2_id}`);

        return updatedBracket;
      }
      return bracket;
    }));

    // Then fetch and update scores for the modified bracket
    const bracket = brackets.find(b => b.id === bracketId);
    if (bracket) {
      try {
        // Get the updated team IDs
        const team1Id = teamPosition === 'team1' ? newTeamId : bracket.team1_id;
        const team2Id = teamPosition === 'team2' ? newTeamId : bracket.team2_id;

        console.log(`Fetching playoff scores for updated bracket ${bracketId}: team1=${team1Id}, team2=${team2Id}, week=${bracket.week}`);

        // Fetch current scores from Sleeper
        const { team1Score, team2Score } = await fetchPlayoffScoresForTeams(
          team1Id,
          team2Id,
          bracket.week
        );

        // Update the bracket with the fetched scores
        setBrackets((prev) => prev.map((b) => {
          if (b.id === bracketId) {
            // Calculate winner based on scores
            let winnerTeamId: number | null = null;
            if (team1Score > team2Score) {
              winnerTeamId = team1Id;
            } else if (team2Score > team1Score) {
              winnerTeamId = team2Id;
            }

            console.log(`🏆 TEAM CHANGE WINNER - Bracket ${bracketId}: Team1(${team1Id})=${team1Score}, Team2(${team2Id})=${team2Score}, Winner=${winnerTeamId}`);

            return {
              ...b,
              team1_score: team1Score,
              team2_score: team2Score,
              winning_team_id: winnerTeamId
            };
          }
          return b;
        }));

        console.log(`✅ Updated bracket ${bracketId} with scores: ${team1Score} - ${team2Score}`);

      } catch (error) {
        console.error(`Error fetching playoff scores for bracket ${bracketId}:`, error);
        
        // Fallback: reset scores to 0 if fetching fails
        setBrackets((prev) => prev.map((b) => {
          if (b.id === bracketId) {
            return {
              ...b,
              team1_score: 0,
              team2_score: 0,
              winning_team_id: null
            };
          }
          return b;
        }));
      }
    }

    setHasChanges(true);

    const newTeam = teams.find(t => t.id === newTeamId);
    toast({
      title: 'Team Changed',
      description: `Playoff bracket ${bracketId} ${teamPosition} changed to ${newTeam?.team_name}. Scores updated automatically. Remember to save changes.`,
      duration: 3000
    });
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    console.log('Starting save operation for', brackets.length, 'playoff brackets');

    let successCount = 0;
    let failureCount = 0;
    const failedBrackets: number[] = [];

    try {
      // Update all playoff brackets
      for (const bracket of brackets) {
        console.log(`Updating playoff bracket ${bracket.id}:`, {
          season_id: bracket.season_id,
          round: bracket.round,
          team1_id: bracket.team1_id,
          team2_id: bracket.team2_id,
          team1_score: bracket.team1_score,
          team2_score: bracket.team2_score,
          winning_team_id: bracket.winning_team_id,
          manual_override: bracket.manual_override
        });

        // Validate required fields before attempting update
        if (!bracket.id || bracket.season_id <= 0) {
          console.error(`Invalid bracket data for ID ${bracket.id}:`, {
            id: bracket.id,
            season_id: bracket.season_id
          });
          failureCount++;
          failedBrackets.push(bracket.id);
          continue;
        }

        // Calculate winning team ID based on current scores before saving
        let calculatedWinnerTeamId: number | null = null;
        if (bracket.team1_score && bracket.team2_score) {
          if (bracket.team1_score > bracket.team2_score) {
            calculatedWinnerTeamId = bracket.team1_id;
          } else if (bracket.team2_score > bracket.team1_score) {
            calculatedWinnerTeamId = bracket.team2_id;
          }
        }

        console.log(`🏆 PLAYOFF SAVE WINNER - Bracket ${bracket.id}: Team1(${bracket.team1_id})=${bracket.team1_score}, Team2(${bracket.team2_id})=${bracket.team2_score}, Calculated Winner=${calculatedWinnerTeamId}`);

        const updateData = {
          season_id: bracket.season_id,
          round: bracket.round,
          team1_seed: bracket.team1_seed,
          team2_seed: bracket.team2_seed,
          team1_id: bracket.team1_id,
          team2_id: bracket.team2_id,
          winning_team_id: calculatedWinnerTeamId,
          playoff_round_name: bracket.playoff_round_name || null,
          is_bye: bracket.is_bye || false,
          matchup_number: bracket.matchup_number || null,
          week: bracket.week,
          team1_score: bracket.team1_score || 0,
          team2_score: bracket.team2_score || 0
        };

        console.log(`Sending update for playoff bracket ${bracket.id} with data:`, updateData);

        const updateResult = await DatabaseService.updatePlayoffBracket(bracket.id, updateData);

        if (updateResult.error) {
          console.error(`❌ Failed to update playoff bracket ${bracket.id}:`, updateResult.error);
          console.error(`❌ Update data was:`, updateData);
          console.error(`❌ Bracket object:`, bracket);
          failureCount++;
          failedBrackets.push(bracket.id);
          continue;
        } else {
          console.log(`✅ Successfully updated playoff bracket ${bracket.id}`);
          console.log(`✅ UPDATE RESULT:`, updateResult.data);
        }

        console.log(`Successfully updated playoff bracket ${bracket.id}`);
        successCount++;
      }

      // Report results
      console.log(`Save operation completed: ${successCount} successes, ${failureCount} failures`);

      if (failureCount > 0) {
        console.error('Failed bracket IDs:', failedBrackets);
        toast({
          title: 'Partial Success',
          description: `${successCount} playoff brackets updated successfully, ${failureCount} failed. Check console for details.`,
          variant: 'destructive'
        });
      } else {
        setHasChanges(false);
        toast({
          title: 'Success',
          description: `All ${successCount} playoff brackets updated successfully`
        });
      }

      // Reload brackets to ensure we have the latest data
      console.log('Reloading playoff brackets to verify changes persisted...');
      await loadPlayoffBrackets();

    } catch (error) {
      console.error('Critical error during save operation:', error);
      toast({
        title: 'Error',
        description: `Failed to save playoff bracket changes: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
      console.log('Save operation completed, saving state reset');
    }
  };

  const handleResetChanges = () => {
    loadPlayoffBrackets();
    setHasChanges(false);
  };

  // Playoff weeks (13-18)
  const playoffWeeks = Array.from({ length: 6 }, (_, i) => i + 13);

  return (
    <div className="space-y-6">
      <Card>
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
              <label className="text-sm font-medium">Week (Playoffs)</label>
              <Select
                value={selectedWeek}
                onValueChange={setSelectedWeek}
                disabled={!selectedSeason}>

                <SelectTrigger>
                  <SelectValue placeholder="Select week..." />
                </SelectTrigger>
                <SelectContent>
                  {playoffWeeks.map((week) =>
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
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>{brackets.length} Total</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>{brackets.filter((b) => b.manual_override).length} Override</span>
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
              <span>Loading playoff brackets...</span>
            </div>
          </CardContent>
        </Card> :
      brackets.length === 0 && selectedWeek ?
      <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Playoff Brackets Found</h3>
              <p className="text-gray-600">
                No playoff brackets found for the selected week. They may need to be created first.
              </p>
            </div>
          </CardContent>
        </Card> :
      brackets.length > 0 ?
      <Card>
          <CardContent className="p-0">
            <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}>

              <SortableContext
              items={brackets.flatMap((b) => [
              `${b.id}-team1`,
              `${b.id}-team2`]
              )}
              strategy={rectSortingStrategy}>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Bracket</TableHead>
                      <TableHead className="w-48">Team 1</TableHead>
                      <TableHead className="w-32 text-center">Score</TableHead>
                      <TableHead className="w-48">Team 2</TableHead>
                      <TableHead className="w-24 text-center">Seeds</TableHead>
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brackets.map((bracket) =>
                    <PlayoffMatchupRow
                      key={bracket.id}
                      bracket={bracket}
                      teams={teams}
                      allTeams={teams}
                      onToggleOverride={handleToggleOverride}
                      onUpdateScores={handleUpdateScores}
                      onUpdateTeams={handleUpdateTeams}
                      onTeamChange={handleTeamChange} />

                    )}
                  </TableBody>
                </Table>
              </SortableContext>
              <DragOverlay>
                {activeId ?
              <div className="bg-white p-2 rounded-lg border-2 border-purple-400 shadow-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center">
                        <Trophy className="h-2 w-2 text-purple-600" />
                      </div>
                      <span className="text-xs font-medium">Moving playoff team...</span>
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
              <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select Filters</h3>
              <p className="text-gray-600">
                Please select a season and week to manage playoff brackets.
              </p>
            </div>
          </CardContent>
        </Card>
      }
    </div>
  );
};

export default PlayoffMatchups;