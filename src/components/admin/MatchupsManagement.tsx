import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  RotateCcw,
  Edit,
  GripVertical,
  Trophy,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  Shield,
  Database,
  Clock,
  FileCheck,
  Save } from
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

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface MatchupValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

interface SaveOperation {
  matchupId: number;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  originalData?: MatchupWithConference;
  newData?: MatchupWithConference;
}

interface ChangePreview {
  matchupId: number;
  conference: string;
  field: string;
  oldValue: any;
  newValue: any;
  type: 'team_assignment' | 'override' | 'status';
}

interface SaveSnapshot {
  timestamp: string;
  matchups: MatchupWithConference[];
  operations: SaveOperation[];
  totalChanges: number;
}

interface SortableTeamProps {
  team: TeamWithDetails | null;
  matchupId: number;
  teamPosition: 'team1' | 'team2';
}

interface SortableMatchupCardProps {
  matchup: MatchupWithConference;
  teams: TeamWithDetails[];
  conferences: Conference[];
  onToggleOverride: (matchupId: number) => void;
}

const SortableTeam: React.FC<SortableTeamProps> = ({
  team,
  matchupId,
  teamPosition
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
      className={`flex items-center gap-2 p-2 rounded border border-dashed transition-all duration-200 cursor-grab hover:cursor-grabbing min-h-[60px]
        ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
      `} data-id="2q1aw90dx">

      {team?.team_logo_url &&
      <img
        src={team.team_logo_url}
        alt={team.team_name}
        className="w-6 h-6 rounded-full flex-shrink-0" data-id="9j1oeh1l5" />

      }
      <div className="flex-1 min-w-0" data-id="xhj53x7z7">
        <div className="font-medium text-sm truncate" data-id="mu2tgtm2w">{team?.team_name || `Team ${teamPosition === 'team1' ? '1' : '2'}`}</div>
        <div className="text-xs text-gray-600 truncate" data-id="am0zmjdhn">{team?.owner_name}</div>
      </div>
    </div>);

};

const SortableMatchupCard: React.FC<SortableMatchupCardProps> = ({
  matchup,
  teams,
  conferences,
  onToggleOverride
}) => {

  const team1 = teams.find((t) => t.id === matchup.team_1_id);
  const team2 = teams.find((t) => t.id === matchup.team_2_id);
  const conference = conferences.find((c) => c.id === matchup.conference_id);

  return (
    <Card className={`border transition-all duration-200 hover:shadow-sm ${
    matchup.is_manual_override ? 'border-orange-300 bg-orange-25' : 'border-gray-200'}`
    } data-id="0i0nf195c">
      <CardContent className="p-3" data-id="8tgxueh69">
        {/* Compact header */}
        <div className="flex items-center justify-between mb-3" data-id="x5a56xfbf">
          <div className="flex items-center gap-2" data-id="4zr1nsv6v">
            <span className="text-sm font-medium" data-id="27sbptbvw">#{matchup.id}</span>
            {matchup.is_manual_override &&
              <Badge variant="outline" className="text-xs px-1 py-0 h-5 text-orange-600 border-orange-300" data-id="2uqw2kaf4">
                Override
              </Badge>
            }
            {matchup.is_playoff &&
              <Badge variant="default" className="text-xs px-1 py-0 h-5 bg-purple-600" data-id="rrpkopbv7">
                Playoff
              </Badge>
            }
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onToggleOverride(matchup.id)} data-id="jhwdnivm9">
            <Edit className="h-3 w-3" data-id="9stba9k21" />
          </Button>
        </div>

        {/* Compact team layout */}
        <div className="grid grid-cols-2 gap-3" data-id="7cnrttm1y">
          <SortableTeam
            team={team1}
            matchupId={matchup.id}
            teamPosition="team1" data-id="figj7qo9d" />
          <SortableTeam
            team={team2}
            matchupId={matchup.id}
            teamPosition="team2" data-id="859zvaji7" />
        </div>

        {/* Compact footer */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500" data-id="x2kou3nnu">
          <span data-id="ew92rjmpl">{matchup.status}</span>
          {matchup.matchup_date &&
            <span data-id="u7r69n4iu">{new Date(matchup.matchup_date).toLocaleDateString()}</span>
          }
        </div>
      </CardContent>
    </Card>);

};

const MatchupsManagement: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [matchups, setMatchups] = useState<MatchupWithConference[]>([]);
  const [originalMatchups, setOriginalMatchups] = useState<MatchupWithConference[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [validationResults, setValidationResults] = useState<Record<number, MatchupValidationResult>>({});
  const [saveOperations, setSaveOperations] = useState<SaveOperation[]>([]);
  const [saveHistory, setSaveHistory] = useState<SaveSnapshot[]>([]);
  const [previewChanges, setPreviewChanges] = useState<ChangePreview[]>([]);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Enhanced validation system
  const validateMatchup = useCallback((matchup: MatchupWithConference): MatchupValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Critical validations (errors)
    if (!matchup.id || typeof matchup.id !== 'number' || matchup.id <= 0) {
      errors.push({ field: 'id', message: 'Invalid matchup ID', severity: 'error' });
    }
    if (!matchup.conference_id || matchup.conference_id <= 0) {
      errors.push({ field: 'conference_id', message: 'Invalid conference ID', severity: 'error' });
    }
    if (!matchup.week || matchup.week <= 0 || matchup.week > 18) {
      errors.push({ field: 'week', message: 'Week must be between 1 and 18', severity: 'error' });
    }
    if (!matchup.team_1_id || matchup.team_1_id <= 0) {
      errors.push({ field: 'team_1_id', message: 'Invalid Team 1 ID', severity: 'error' });
    }
    if (!matchup.team_2_id || matchup.team_2_id <= 0) {
      errors.push({ field: 'team_2_id', message: 'Invalid Team 2 ID', severity: 'error' });
    }
    if (matchup.team_1_id === matchup.team_2_id) {
      errors.push({ field: 'teams', message: 'Teams cannot play themselves', severity: 'error' });
    }

    // Data consistency checks
    const team1Exists = teams.find((t) => t.id === matchup.team_1_id);
    const team2Exists = teams.find((t) => t.id === matchup.team_2_id);
    const conferenceExists = conferences.find((c) => c.id === matchup.conference_id);

    if (!team1Exists) {
      errors.push({ field: 'team_1_id', message: 'Team 1 does not exist', severity: 'error' });
    }
    if (!team2Exists) {
      errors.push({ field: 'team_2_id', message: 'Team 2 does not exist', severity: 'error' });
    }
    if (!conferenceExists) {
      errors.push({ field: 'conference_id', message: 'Conference does not exist', severity: 'error' });
    }

    // Note: Score validation removed as scores come from Sleeper API

    // Winner validation - scores and winners are managed by Sleeper API
    // No winner validation needed as this is handled by API integration

    // Status consistency checks
    if (matchup.is_manual_override && matchup.status === 'pending') {
      warnings.push({ field: 'status', message: 'Manual override should typically be complete', severity: 'warning' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [teams, conferences]);

  // Generate change preview
  const generateChangePreview = useCallback((): ChangePreview[] => {
    const changes: ChangePreview[] = [];

    matchups.forEach((current) => {
      const original = originalMatchups.find((o) => o.id === current.id);
      if (!original) return;

      const conference = conferences.find((c) => c.id === current.conference_id)?.conference_name || 'Unknown';

      // Team assignment changes
      if (original.team_1_id !== current.team_1_id) {
        const oldTeam = teams.find((t) => t.id === original.team_1_id)?.team_name || `Team ${original.team_1_id}`;
        const newTeam = teams.find((t) => t.id === current.team_1_id)?.team_name || `Team ${current.team_1_id}`;
        changes.push({
          matchupId: current.id,
          conference,
          field: 'Team 1',
          oldValue: oldTeam,
          newValue: newTeam,
          type: 'team_assignment'
        });
      }

      if (original.team_2_id !== current.team_2_id) {
        const oldTeam = teams.find((t) => t.id === original.team_2_id)?.team_name || `Team ${original.team_2_id}`;
        const newTeam = teams.find((t) => t.id === current.team_2_id)?.team_name || `Team ${current.team_2_id}`;
        changes.push({
          matchupId: current.id,
          conference,
          field: 'Team 2',
          oldValue: oldTeam,
          newValue: newTeam,
          type: 'team_assignment'
        });
      }

      // Override changes
      if (original.is_manual_override !== current.is_manual_override) {
        changes.push({
          matchupId: current.id,
          conference,
          field: 'Manual Override',
          oldValue: original.is_manual_override ? 'Yes' : 'No',
          newValue: current.is_manual_override ? 'Yes' : 'No',
          type: 'override'
        });
      }

      // Status changes
      if (original.status !== current.status) {
        changes.push({
          matchupId: current.id,
          conference,
          field: 'Status',
          oldValue: original.status,
          newValue: current.status,
          type: 'status'
        });
      }
    });

    return changes;
  }, [matchups, originalMatchups, teams, conferences]);

  // Real-time validation with debouncing
  useEffect(() => {
    if (matchups.length === 0) {
      setValidationResults({});
      setPreviewChanges([]);
      return;
    }

    const timer = setTimeout(() => {
      setValidating(true);

      const results: Record<number, MatchupValidationResult> = {};
      matchups.forEach((matchup) => {
        results[matchup.id] = validateMatchup(matchup);
      });

      setValidationResults(results);
      setPreviewChanges(generateChangePreview());
      setValidating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [matchups, validateMatchup, generateChangePreview]);

  // Validation summary
  const validationSummary = useMemo(() => {
    const results = Object.values(validationResults);
    return {
      totalMatchups: results.length,
      validMatchups: results.filter((r) => r.isValid).length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      criticalIssues: results.filter((r) => !r.isValid).length
    };
  }, [validationResults]);

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
      setOriginalMatchups([...allMatchups]); // Create snapshot for change tracking
      setHasChanges(false); // Reset changes when loading fresh data
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

        // Mark as team assignment override - scores will come from Sleeper API
        activeMatchup.is_manual_override = true;
        activeMatchup.status = 'pending'; // Reset status when teams are swapped

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
        description: 'Team assignments have been updated. Remember to save your changes.',
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
      title: 'Team Assignment Override Toggled',
      description: `Team assignment override ${matchups.find((m) => m.id === matchupId)?.is_manual_override ? 'removed' : 'enabled'} for matchup ${matchupId}.`,
      duration: 2000
    });
  };



  // Helper function for batch updates (future enhancement)
  const prepareBatchUpdateData = (matchupsToUpdate: MatchupWithConference[]) => {
    return matchupsToUpdate.map((matchup) => ({
      id: matchup.id,
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
    }));
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    console.log('Starting save operation for', matchups.length, 'matchups');
    console.log('Note: Currently using individual updates. Batch update available for future enhancement.');

    let successCount = 0;
    let failureCount = 0;
    const failedMatchups: number[] = [];

    try {
      // Update all matchups with comprehensive field mapping
      for (const matchup of matchups) {
        console.log(`Updating matchup ${matchup.id}:`, {
          conference_id: matchup.conference_id,
          week: matchup.week,
          team_1_id: matchup.team_1_id,
          team_2_id: matchup.team_2_id,
          is_manual_override: matchup.is_manual_override,
          status: matchup.status
        });

        // Enhanced validation for matchup data
        const validationErrors = [];

        if (!matchup.id || typeof matchup.id !== 'number' || matchup.id <= 0) {
          validationErrors.push(`Invalid matchup ID: ${matchup.id}`);
        }
        if (!matchup.conference_id || matchup.conference_id <= 0) {
          validationErrors.push(`Invalid conference_id: ${matchup.conference_id}`);
        }
        if (!matchup.week || matchup.week <= 0 || matchup.week > 18) {
          validationErrors.push(`Invalid week: ${matchup.week}`);
        }
        if (!matchup.team_1_id || matchup.team_1_id <= 0) {
          validationErrors.push(`Invalid team_1_id: ${matchup.team_1_id}`);
        }
        if (!matchup.team_2_id || matchup.team_2_id <= 0) {
          validationErrors.push(`Invalid team_2_id: ${matchup.team_2_id}`);
        }
        if (matchup.team_1_id === matchup.team_2_id) {
          validationErrors.push(`Teams cannot play themselves: ${matchup.team_1_id}`);
        }

        if (validationErrors.length > 0) {
          console.error(`Validation failed for matchup ${matchup.id}:`, {
            matchupId: matchup.id,
            errors: validationErrors,
            data: {
              id: matchup.id,
              conference_id: matchup.conference_id,
              week: matchup.week,
              team_1_id: matchup.team_1_id,
              team_2_id: matchup.team_2_id
            }
          });
          failureCount++;
          failedMatchups.push(matchup.id);
          continue;
        }

        // Prepare update data with all required fields
        // NOTE: Only updating team assignments - scores and winners come from Sleeper API
        const updateData = {
          id: matchup.id,
          conference_id: matchup.conference_id,
          week: matchup.week,
          team_1_id: matchup.team_1_id,
          team_2_id: matchup.team_2_id,
          is_playoff: matchup.is_playoff,
          sleeper_matchup_id: matchup.sleeper_matchup_id || '',
          // Note: Scores and winner_id are managed by Sleeper API integration
          team_1_score: matchup.team_1_score,
          team_2_score: matchup.team_2_score,
          winner_id: matchup.winner_id,
          is_manual_override: matchup.is_manual_override,
          status: matchup.status || 'pending',
          matchup_date: matchup.matchup_date || '',
          notes: matchup.notes || ''
        };

        console.log(`Sending update for matchup ${matchup.id} with data:`, updateData);

        const { error } = await window.ezsite.apis.tableUpdate(13329, updateData);

        if (error) {
          console.error(`Failed to update matchup ${matchup.id}:`, {
            error,
            matchupData: updateData,
            validationStatus: 'passed',
            apiResponse: { error }
          });
          failureCount++;
          failedMatchups.push(matchup.id);
        } else {
          console.log(`Successfully updated matchup ${matchup.id}:`, {
            matchupId: matchup.id,
            teams: `${matchup.team_1_id} vs ${matchup.team_2_id}`,
            manual_override: matchup.is_manual_override,
            status: updateData.status
          });
          successCount++;
        }
      }

      // Enhanced reporting with detailed feedback
      const totalMatchups = matchups.length;
      console.log(`Save operation completed:`, {
        totalMatchups,
        successCount,
        failureCount,
        successRate: `${(successCount / totalMatchups * 100).toFixed(1)}%`,
        failedMatchupIds: failedMatchups
      });

      if (failureCount > 0) {
        console.error('Detailed failure analysis:', {
          failedMatchupIds: failedMatchups,
          totalFailures: failureCount,
          successfulUpdates: successCount,
          affectedConferences: conferences.filter((c) =>
          matchups.some((m) => failedMatchups.includes(m.id) && m.conference_id === c.id)
          ).map((c) => c.conference_name)
        });

        toast({
          title: 'Partial Success',
          description: `${successCount}/${totalMatchups} matchups updated successfully. ${failureCount} failed (IDs: ${failedMatchups.join(', ')}). Check console for details.`,
          variant: 'destructive',
          duration: 8000
        });
      } else {
        setHasChanges(false);
        console.log('All matchups updated successfully:', {
          updatedMatchups: matchups.map((m) => ({
            id: m.id,
            conference: conferences.find((c) => c.id === m.conference_id)?.conference_name,
            teams: `${m.team_1_id} vs ${m.team_2_id}`,
            manual_override: m.is_manual_override
          }))
        });

        toast({
          title: 'Complete Success',
          description: `All ${successCount} matchups updated successfully! Changes have been saved to the database.`,
          duration: 5000
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
    <div className="space-y-6" data-id="q02vp8bm8">
      <Card data-id="9ay41boko">
        <CardHeader className="pb-3" data-id="0y5cigzwu">
          <CardTitle className="flex items-center gap-2 text-lg" data-id="hz7ti2q9k">
            <Calendar className="h-5 w-5" data-id="pds2noyy3" />
            Matchups Management
          </CardTitle>
          <CardDescription className="text-sm" data-id="r69gd1uuj">
            Drag teams between matchups to reassign opponents.
          </CardDescription>
        </CardHeader>
        <CardContent data-id="he69iad95">
          <div className="flex flex-wrap items-end gap-4 mb-4" data-id="hko3quy02">
            <div className="space-y-1" data-id="x68wneqpy">
              <label className="text-sm font-medium" data-id="n9e7hdy25">Season</label>
              <Select value={selectedSeason} onValueChange={setSelectedSeason} data-id="ue284zzzx">
                <SelectTrigger className="w-48" data-id="lewa7y497">
                  <SelectValue placeholder="Select season..." data-id="c7kwd4zo6" />
                </SelectTrigger>
                <SelectContent data-id="5urc94sxs">
                  {seasons.map((season) =>
                  <SelectItem key={season.id} value={season.id.toString()} data-id="dqj33cdr1">
                      {season.season_name}
                      {season.is_current_season &&
                    <Badge variant="secondary" className="ml-2" data-id="1ep3cujgn">Current</Badge>
                    }
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1" data-id="qwszhvbgj">
              <label className="text-sm font-medium" data-id="73lepre9x">Week</label>
              <Select
                value={selectedWeek}
                onValueChange={setSelectedWeek}
                disabled={!selectedSeason} data-id="umc9sendx">

                <SelectTrigger className="w-32" data-id="uuukliv77">
                  <SelectValue placeholder="Week..." data-id="howc9s5fa" />
                </SelectTrigger>
                <SelectContent data-id="0xvng3mwl">
                  {weeks.map((week) =>
                  <SelectItem key={week} value={week.toString()} data-id="qhhub24gd">
                      Week {week}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" data-id="3orfdy46n">
              {hasChanges &&
              <div className="flex gap-2 justify-end" data-id="3jq8nk6ej">
                  <Button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  size="sm"
                  className="flex items-center gap-2" data-id="blaetry32">

                    {saving ?
                  <Loader2 className="h-4 w-4 animate-spin" data-id="ur39do684" /> :

                  <Save className="h-4 w-4" data-id="fa3ho5dca" />
                  }
                    Save
                  </Button>
                  <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetChanges}
                  className="flex items-center gap-2" data-id="gwvekf0tv">

                    <RotateCcw className="h-4 w-4" data-id="wg90njrpi" />
                    Reset
                  </Button>
                </div>
              }
            </div>
          </div>

          {hasChanges &&
          <Alert className="mb-3 py-2" data-id="3nnjy2gc3">
              <AlertTriangle className="h-4 w-4" data-id="pi3ta1kuz" />
              <AlertDescription className="text-sm" data-id="yoimnw0rt">
                Unsaved changes detected. Remember to save.
              </AlertDescription>
            </Alert>
          }
        </CardContent>
      </Card>

      {loading ?
      <Card data-id="jk2jx0wq1">
          <CardContent className="flex items-center justify-center py-12" data-id="0fc3wzpo3">
            <div className="flex items-center gap-2" data-id="8cljj7bcw">
              <Loader2 className="h-6 w-6 animate-spin" data-id="ptaevpqlh" />
              <span data-id="0ytq7oyga">Loading matchups...</span>
            </div>
          </CardContent>
        </Card> :
      matchups.length === 0 && selectedWeek ?
      <Card data-id="dmb72cnfo">
          <CardContent className="flex items-center justify-center py-12" data-id="h72h7sj6x">
            <div className="text-center" data-id="wxdr9rqir">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" data-id="14o2kczqv" />
              <h3 className="text-lg font-medium text-gray-900 mb-2" data-id="b8kpwy9ic">No Matchups Found</h3>
              <p className="text-gray-600" data-id="ishzt6ta8">
                No matchups found for the selected week. They may need to be created first.
              </p>
            </div>
          </CardContent>
        </Card> :
      matchups.length > 0 ?
      <div className="space-y-6" data-id="w3k9jzfa8">
        {/* Compact Summary Stats */}
        <Card data-id="fic259nzv">
          <CardContent className="p-4" data-id="ioagbffsc">
            <div className="flex items-center justify-between" data-id="d7zjaz5ji">
              <div className="flex items-center gap-6" data-id="77t15d1e7">
                <div className="text-center" data-id="s9hj0oi8x">
                  <div className="text-lg font-bold text-blue-600">{matchups.length}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="text-center" data-id="z2baul15g">
                  <div className="text-lg font-bold text-green-600">
                    {matchups.filter((m) => m.status === 'complete').length}
                  </div>
                  <div className="text-xs text-gray-600">Complete</div>
                </div>
                <div className="text-center" data-id="ecljm7gf2">
                  <div className="text-lg font-bold text-orange-600">
                    {matchups.filter((m) => m.is_manual_override).length}
                  </div>
                  <div className="text-xs text-gray-600">Overrides</div>
                </div>
                <div className="text-center" data-id="6bitpp4vg">
                  <div className="text-lg font-bold text-purple-600">
                    {matchups.filter((m) => m.is_playoff).length}
                  </div>
                  <div className="text-xs text-gray-600">Playoff</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compact Grid Layout */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd} data-id="bq7pe3yfp">

          <SortableContext
            items={matchups.flatMap((m) => [
            `${m.id}-team1`,
            `${m.id}-team2`]
            )}
            strategy={rectSortingStrategy} data-id="syzkayz79">

            <div className="space-y-4" data-id="ri3a49l4b">
              {conferences.map((conference) => {
                const conferenceMatchups = matchups.filter((m) => m.conference_id === conference.id);
                if (conferenceMatchups.length === 0) return null;

                return (
                  <div key={conference.id} className="space-y-3" data-id="sov144wtk">
                    <div className="flex items-center gap-2 pb-1 border-b" data-id="vmill7lm2">
                      <h3 className="text-base font-semibold" data-id="gj551ssez">{conference.conference_name}</h3>
                      <Badge variant="secondary" className="text-xs h-5" data-id="b35vx0ss3">{conferenceMatchups.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3" data-id="k6a5kfxxq">
                      {conferenceMatchups.map((matchup) =>
                      <SortableMatchupCard
                        key={matchup.id}
                        matchup={matchup}
                        teams={teams}
                        conferences={conferences}
                        onToggleOverride={handleToggleOverride} data-id="ojm2aed5n" />
                      )}
                    </div>
                  </div>);

              })}
            </div>
          </SortableContext>
          <DragOverlay data-id="mdlpx7ep5">
            {activeId ?
            <div className="bg-white p-3 rounded-lg border-2 border-blue-400 shadow-lg" data-id="itfsklu42">
                <div className="flex items-center gap-2" data-id="b215oiew8">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center" data-id="y4o587oo3">
                    <Users className="h-3 w-3 text-blue-600" data-id="s6cozypen" />
                  </div>
                  <span className="text-sm font-medium" data-id="z84f79a55">Moving team...</span>
                </div>
              </div> :
            null}
          </DragOverlay>
        </DndContext>
      </div> :

      <Card data-id="49dmtz98z">
          <CardContent className="flex items-center justify-center py-12" data-id="f8lxmh56y">
            <div className="text-center" data-id="64oc8l27r">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" data-id="rjmmsmf8w" />
              <h3 className="text-lg font-medium text-gray-900 mb-2" data-id="qt17onulu">Select Filters</h3>
              <p className="text-gray-600" data-id="txl9vlo2p">
                Please select a season and week to manage matchups across all conferences.
              </p>
            </div>
          </CardContent>
        </Card>
      }
    </div>);

};

export default MatchupsManagement;