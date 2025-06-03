import React, { useState, useEffect } from 'react';
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
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
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
  Loader2
} from 'lucide-react';

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

interface SortableMatchupCardProps {
  matchup: Matchup;
  teams: TeamWithDetails[];
  onToggleOverride: (matchupId: number) => void;
  onUpdateScores: (matchupId: number, team1Score: number, team2Score: number) => void;
}

const SortableMatchupCard: React.FC<SortableMatchupCardProps> = ({
  matchup,
  teams,
  onToggleOverride,
  onUpdateScores
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: matchup.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const team1 = teams.find(t => t.id === matchup.team_1_id);
  const team2 = teams.find(t => t.id === matchup.team_2_id);

  const [editingScores, setEditingScores] = useState(false);
  const [team1Score, setTeam1Score] = useState(matchup.team_1_score);
  const [team2Score, setTeam2Score] = useState(matchup.team_2_score);

  const handleSaveScores = () => {
    onUpdateScores(matchup.id, team1Score, team2Score);
    setEditingScores(false);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`mb-4 transition-all duration-200 hover:shadow-md ${
        matchup.is_manual_override ? 'border-orange-400 bg-orange-50' : 'border-gray-200'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div {...listeners} className="cursor-grab hover:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Matchup {matchup.id}</span>
              </div>
              {matchup.is_manual_override && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  Manual Override
                </Badge>
              )}
              {matchup.is_playoff && (
                <Badge variant="default" className="bg-purple-600">
                  Playoff
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleOverride(matchup.id)}
              >
                <Edit className="h-3 w-3 mr-1" />
                {matchup.is_manual_override ? 'Remove Override' : 'Override'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Team 1 */}
            <div className="flex items-center gap-3">
              {team1?.team_logo_url && (
                <img 
                  src={team1.team_logo_url} 
                  alt={team1.team_name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <div className="font-medium">{team1?.team_name || 'Team 1'}</div>
                <div className="text-sm text-gray-600">{team1?.owner_name}</div>
              </div>
            </div>

            {/* Score Section */}
            <div className="flex items-center justify-center">
              {editingScores ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-center border rounded"
                    step="0.1"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    value={team2Score}
                    onChange={(e) => setTeam2Score(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-center border rounded"
                    step="0.1"
                  />
                  <Button size="sm" onClick={handleSaveScores}>
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setEditingScores(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1 rounded"
                  onClick={() => setEditingScores(true)}
                >
                  <span className="text-xl font-bold">{matchup.team_1_score}</span>
                  <span className="text-gray-400">-</span>
                  <span className="text-xl font-bold">{matchup.team_2_score}</span>
                  <Edit className="h-3 w-3 text-gray-400 ml-1" />
                </div>
              )}
            </div>

            {/* Team 2 */}
            <div className="flex items-center gap-3 justify-end">
              <div className="text-right">
                <div className="font-medium">{team2?.team_name || 'Team 2'}</div>
                <div className="text-sm text-gray-600">{team2?.owner_name}</div>
              </div>
              {team2?.team_logo_url && (
                <img 
                  src={team2.team_logo_url} 
                  alt={team2.team_name}
                  className="w-8 h-8 rounded-full"
                />
              )}
            </div>
          </div>

          {matchup.notes && (
            <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
              <strong>Notes:</strong> {matchup.notes}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Status: {matchup.status}</span>
            {matchup.matchup_date && (
              <span>Date: {new Date(matchup.matchup_date).toLocaleDateString()}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MatchupsManagement: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedConference, setSelectedConference] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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
    if (selectedSeason && selectedConference && selectedWeek) {
      loadMatchups();
    }
  }, [selectedSeason, selectedConference, selectedWeek]);

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
          { name: 'season_id', op: 'Equal', value: parseInt(selectedSeason) }
        ]
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
    try {
      const { data, error } = await window.ezsite.apis.tablePage(13329, {
        PageNo: 1,
        PageSize: 100,
        Filters: [
          { name: 'conference_id', op: 'Equal', value: parseInt(selectedConference) },
          { name: 'week', op: 'Equal', value: parseInt(selectedWeek) }
        ],
        OrderByField: 'id',
        IsAsc: true
      });
      if (error) throw error;
      setMatchups(data.List || []);
    } catch (error) {
      console.error('Error loading matchups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load matchups',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setMatchups((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        return newItems;
      });
    }
  };

  const handleToggleOverride = (matchupId: number) => {
    setMatchups(prev => prev.map(matchup => 
      matchup.id === matchupId 
        ? { ...matchup, is_manual_override: !matchup.is_manual_override }
        : matchup
    ));
    setHasChanges(true);
  };

  const handleUpdateScores = (matchupId: number, team1Score: number, team2Score: number) => {
    setMatchups(prev => prev.map(matchup => 
      matchup.id === matchupId 
        ? { 
            ...matchup, 
            team_1_score: team1Score, 
            team_2_score: team2Score,
            winner_id: team1Score > team2Score ? matchup.team_1_id : 
                      team2Score > team1Score ? matchup.team_2_id : 0,
            is_manual_override: true
          }
        : matchup
    ));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      // Update all matchups
      for (const matchup of matchups) {
        const { error } = await window.ezsite.apis.tableUpdate(13329, {
          ID: matchup.id,
          team_1_score: matchup.team_1_score,
          team_2_score: matchup.team_2_score,
          winner_id: matchup.winner_id,
          is_manual_override: matchup.is_manual_override,
          notes: matchup.notes
        });
        if (error) throw error;
      }

      setHasChanges(false);
      toast({
        title: 'Success',
        description: 'Matchups updated successfully',
      });
    } catch (error) {
      console.error('Error saving matchups:', error);
      toast({
        title: 'Error',
        description: 'Failed to save matchup changes',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
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
            Manage weekly matchups, scores, and overrides for conferences
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
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id.toString()}>
                      {season.season_name}
                      {season.is_current_season && (
                        <Badge variant="secondary" className="ml-2">Current</Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Conference</label>
              <Select 
                value={selectedConference} 
                onValueChange={setSelectedConference}
                disabled={!selectedSeason}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select conference..." />
                </SelectTrigger>
                <SelectContent>
                  {conferences.map((conference) => (
                    <SelectItem key={conference.id} value={conference.id.toString()}>
                      {conference.conference_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Week</label>
              <Select 
                value={selectedWeek} 
                onValueChange={setSelectedWeek}
                disabled={!selectedConference}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select week..." />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex items-end">
              {hasChanges && (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveChanges} 
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleResetChanges}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              )}
            </div>
          </div>

          {hasChanges && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Remember to save your modifications.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading matchups...</span>
            </div>
          </CardContent>
        </Card>
      ) : matchups.length === 0 && selectedWeek ? (
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
        </Card>
      ) : matchups.length > 0 ? (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={matchups.map(m => m.id)} 
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {matchups.map((matchup) => (
                <SortableMatchupCard
                  key={matchup.id}
                  matchup={matchup}
                  teams={teams.filter(t => t.conference_id === parseInt(selectedConference))}
                  onToggleOverride={handleToggleOverride}
                  onUpdateScores={handleUpdateScores}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select Filters</h3>
              <p className="text-gray-600">
                Please select a season, conference, and week to manage matchups.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MatchupsManagement;