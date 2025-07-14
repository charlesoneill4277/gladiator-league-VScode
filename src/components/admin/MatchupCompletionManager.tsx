import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, Edit, Calculator, Trophy, AlertCircle } from 'lucide-react';
import { teamRecordsService } from '@/services/teamRecordsService';

interface Matchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
  is_playoff: boolean;
  is_manual_override: boolean;
  status: string;
  matchup_date: string;
  notes: string;
}

interface Team {
  id: number;
  team_name: string;
  owner_name: string;
}

interface Conference {
  id: number;
  conference_name: string;
  season_id: number;
}

const MatchupCompletionManager: React.FC = () => {
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [selectedConference, setSelectedConference] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedMatchup, setSelectedMatchup] = useState<Matchup | null>(null);
  const [team1Score, setTeam1Score] = useState<string>('');
  const [team2Score, setTeam2Score] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const MATCHUPS_TABLE_ID = 13329;
  const TEAMS_TABLE_ID = 12852;
  const CONFERENCES_TABLE_ID = 12820;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedConference || selectedWeek) {
      loadMatchups();
    }
  }, [selectedConference, selectedWeek]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);

      // Load conferences
      const { data: conferencesData, error: conferencesError } = await window.ezsite.apis.tablePage(
        CONFERENCES_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'id',
          IsAsc: true,
          Filters: []
        }
      );

      if (conferencesError) throw conferencesError;
      setConferences(conferencesData.List || []);

      // Load teams
      const { data: teamsData, error: teamsError } = await window.ezsite.apis.tablePage(
        TEAMS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'team_name',
          IsAsc: true,
          Filters: []
        }
      );

      if (teamsError) throw teamsError;
      setTeams(teamsData.List || []);

    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load initial data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMatchups = async () => {
    try {
      const filters = [];

      if (selectedConference) {
        filters.push({ name: 'conference_id', op: 'Equal', value: parseInt(selectedConference) });
      }

      if (selectedWeek) {
        filters.push({ name: 'week', op: 'Equal', value: parseInt(selectedWeek) });
      }

      const { data, error } = await window.ezsite.apis.tablePage(
        MATCHUPS_TABLE_ID,
        {
          PageNo: 1,
          PageSize: 100,
          OrderByField: 'week',
          IsAsc: true,
          Filters: filters
        }
      );

      if (error) throw error;
      setMatchups(data.List || []);
    } catch (error) {
      console.error('Error loading matchups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load matchups',
        variant: 'destructive'
      });
    }
  };

  const getTeamName = (teamId: number) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.team_name || 'Unknown Team';
  };

  const getConferenceName = (conferenceId: number) => {
    const conference = conferences.find((c) => c.id === conferenceId);
    return conference?.conference_name || 'Unknown Conference';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
      case 'in_progress':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCompleteMatchup = async () => {
    if (!selectedMatchup || !team1Score || !team2Score) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmitting(true);

      await teamRecordsService.completeMatchup(
        selectedMatchup.id,
        parseFloat(team1Score),
        parseFloat(team2Score),
        true // Manual override
      );

      // Refresh matchups
      await loadMatchups();

      // Close dialog and reset form
      setIsDialogOpen(false);
      setSelectedMatchup(null);
      setTeam1Score('');
      setTeam2Score('');

      toast({
        title: 'Success',
        description: 'Matchup completed successfully and records updated'
      });
    } catch (error) {
      console.error('Error completing matchup:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete matchup',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecalculateRecords = async () => {
    try {
      setIsSubmitting(true);

      const seasonId = 1; // This should be dynamic based on current season
      const conferenceId = selectedConference ? parseInt(selectedConference) : undefined;

      await teamRecordsService.calculateTeamRecords(seasonId, conferenceId);

      toast({
        title: 'Success',
        description: 'Team records recalculated successfully'
      });
    } catch (error) {
      console.error('Error recalculating records:', error);
      toast({
        title: 'Error',
        description: 'Failed to recalculate team records',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkConferenceChampions = async () => {
    try {
      setIsSubmitting(true);

      const seasonId = 1; // This should be dynamic based on current season
      await teamRecordsService.markConferenceChampions(seasonId);

      toast({
        title: 'Success',
        description: 'Conference champions marked successfully'
      });
    } catch (error) {
      console.error('Error marking conference champions:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark conference champions',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteDialog = (matchup: Matchup) => {
    setSelectedMatchup(matchup);
    setTeam1Score(matchup.team_1_score?.toString() || '');
    setTeam2Score(matchup.team_2_score?.toString() || '');
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matchup Completion Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading...</div>
        </CardContent>
      </Card>);

  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Matchup Completion Manager
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="matchups" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="matchups">Matchups</TabsTrigger>
            <TabsTrigger value="records">Records Management</TabsTrigger>
          </TabsList>
          
          <TabsContent value="matchups" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <Label htmlFor="conference-filter">Conference</Label>
                <Select value={selectedConference} onValueChange={setSelectedConference}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Conferences" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Conferences</SelectItem>
                    {conferences.map((conf) =>
                    <SelectItem key={conf.id} value={conf.id.toString()}>
                        {conf.conference_name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <Label htmlFor="week-filter">Week</Label>
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Weeks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Weeks</SelectItem>
                    {[...Array(17)].map((_, i) =>
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Week {i + 1}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Matchups Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Conference</TableHead>
                    <TableHead>Matchup</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchups.map((matchup) =>
                  <TableRow key={matchup.id}>
                      <TableCell>{matchup.week}</TableCell>
                      <TableCell>{getConferenceName(matchup.conference_id)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{getTeamName(matchup.team_1_id)}</div>
                          <div className="text-sm text-muted-foreground">vs</div>
                          <div>{getTeamName(matchup.team_2_id)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {matchup.status === 'complete' ?
                      <div className="space-y-1">
                            <div className={matchup.winner_id === matchup.team_1_id ? 'font-semibold' : ''}>
                              {matchup.team_1_score}
                            </div>
                            <div className={matchup.winner_id === matchup.team_2_id ? 'font-semibold' : ''}>
                              {matchup.team_2_score}
                            </div>
                          </div> :

                      <div className="text-muted-foreground">-</div>
                      }
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(matchup.status)}
                          {matchup.is_manual_override &&
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                        }
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCompleteDialog(matchup)}>

                          <Edit className="w-4 h-4 mr-1" />
                          {matchup.status === 'complete' ? 'Edit' : 'Complete'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {matchups.length === 0 &&
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No matchups found for the selected filters.
                </AlertDescription>
              </Alert>
            }
          </TabsContent>
          
          <TabsContent value="records" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={handleRecalculateRecords}
                disabled={isSubmitting}
                className="flex items-center gap-2">

                <Calculator className="w-4 h-4" />
                Recalculate Team Records
              </Button>
              
              <Button
                onClick={handleMarkConferenceChampions}
                disabled={isSubmitting}
                variant="outline"
                className="flex items-center gap-2">

                <Trophy className="w-4 h-4" />
                Mark Conference Champions
              </Button>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use these tools to recalculate team records from matchup results and mark conference champions.
                Records are automatically updated when matchups are completed.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Complete Matchup Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Matchup</DialogTitle>
            </DialogHeader>
            
            {selectedMatchup &&
            <div className="space-y-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2">
                    Week {selectedMatchup.week} - {getConferenceName(selectedMatchup.conference_id)}
                  </div>
                  <div className="text-lg font-semibold">
                    {getTeamName(selectedMatchup.team_1_id)} vs {getTeamName(selectedMatchup.team_2_id)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="team1-score">{getTeamName(selectedMatchup.team_1_id)} Score</Label>
                    <Input
                    id="team1-score"
                    type="number"
                    step="0.1"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(e.target.value)}
                    placeholder="0.0" />

                  </div>
                  
                  <div>
                    <Label htmlFor="team2-score">{getTeamName(selectedMatchup.team_2_id)} Score</Label>
                    <Input
                    id="team2-score"
                    type="number"
                    step="0.1"
                    value={team2Score}
                    onChange={(e) => setTeam2Score(e.target.value)}
                    placeholder="0.0" />

                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}>

                    Cancel
                  </Button>
                  <Button
                  onClick={handleCompleteMatchup}
                  disabled={isSubmitting}>

                    {isSubmitting ? 'Completing...' : 'Complete Matchup'}
                  </Button>
                </div>
              </div>
            }
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>);

};

export default MatchupCompletionManager;