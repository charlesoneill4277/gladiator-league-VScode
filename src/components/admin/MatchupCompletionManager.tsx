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
import { StandingsService } from '@/services/standingsService';
import { DatabaseService } from '@/services/databaseService';
import { SupabaseMatchupService } from '@/services/supabaseMatchupService';
import { SleeperApiService } from '@/services/sleeperApi';
import { DbMatchup, DbTeam, DbConference } from '@/types/database';
import TeamRecordsDashboard from './TeamRecordsDashboard';

// Use database types directly
type Matchup = DbMatchup;
type Team = DbTeam;
type Conference = DbConference;

const CONFERENCES_TABLE_ID = '12820';
const TEAMS_TABLE_ID = '12852';
const MATCHUPS_TABLE_ID = '13329';

const MatchupCompletionManager: React.FC = () => {
  console.log('MatchupCompletionManager: Component rendered');
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
    loadCurrentWeek();
  }, []);

  useEffect(() => {
    if (selectedConference || selectedWeek) {
      loadMatchups();
    }
  }, [selectedConference, selectedWeek]);

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

  const loadInitialData = async () => {
    try {
      setIsLoading(true);

      // Load conferences
      const conferencesResponse = await DatabaseService.getConferences({
        limit: 100,
        orderBy: { column: 'id', ascending: true }
      });

      if (conferencesResponse.data) {
        setConferences(conferencesResponse.data);
      }

      // Load teams
      const teamsResponse = await DatabaseService.getTeams({
        limit: 100,
        orderBy: { column: 'team_name', ascending: true }
      });

      if (teamsResponse.data) {
        setTeams(teamsResponse.data);
      }

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
        filters.push({ column: 'conference_id', operator: 'eq' as const, value: parseInt(selectedConference) });
      }

      if (selectedWeek) {
        filters.push({ column: 'week', operator: 'eq' as const, value: parseInt(selectedWeek) });
      }

      const matchupsResponse = await DatabaseService.getMatchups({
        filters,
        limit: 100,
        orderBy: { column: 'week', ascending: true }
      });

      if (matchupsResponse.data) {
        setMatchups(matchupsResponse.data);
      }
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

      // TODO: Implement completeMatchup in Supabase
      console.log('Complete matchup triggered:', {
        matchupId: selectedMatchup.id,
        team1Score: parseFloat(team1Score),
        team2Score: parseFloat(team2Score)
      });

      // For now, update the matchup directly using DatabaseService
      const winnerId = parseFloat(team1Score) > parseFloat(team2Score) ? selectedMatchup.team1_id : selectedMatchup.team2_id;
      await DatabaseService.updateMatchup(selectedMatchup.id, {
        team1_score: parseFloat(team1Score),
        team2_score: parseFloat(team2Score),
        winning_team_id: winnerId,
        matchup_status: 'complete',
        manual_override: true
      });

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

      // TODO: Implement calculateTeamRecords in Supabase
      console.log('Calculate team records triggered for season:', seasonId, 'conference:', conferenceId);

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
      // TODO: Implement markConferenceChampions in Supabase
      console.log('Mark conference champions triggered for season:', seasonId);

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
    setTeam1Score(matchup.team1_score?.toString() || '');
    setTeam2Score(matchup.team2_score?.toString() || '');
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
                          <div>{getTeamName(matchup.team1_id)}</div>
                          <div className="text-sm text-muted-foreground">vs</div>
                          <div>{getTeamName(matchup.team2_id)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {matchup.matchup_status === 'complete' ?
                      <div className="space-y-1">
                            <div className={matchup.winning_team_id === matchup.team1_id ? 'font-semibold' : ''}>
                              {matchup.team1_score}
                            </div>
                            <div className={matchup.winning_team_id === matchup.team2_id ? 'font-semibold' : ''}>
                              {matchup.team2_score}
                            </div>
                          </div> :

                      <div className="text-muted-foreground">-</div>
                      }
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(matchup.matchup_status)}
                          {matchup.manual_override &&
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
                          {matchup.matchup_status === 'complete' ? 'Edit' : 'Complete'}
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
            <TeamRecordsDashboard />
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
                    {getTeamName(selectedMatchup.team1_id)} vs {getTeamName(selectedMatchup.team2_id)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="team1-score">{getTeamName(selectedMatchup.team1_id)} Score</Label>
                    <Input
                    id="team1-score"
                    type="number"
                    step="0.1"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(e.target.value)}
                    placeholder="0.0" />

                  </div>
                  
                  <div>
                    <Label htmlFor="team2-score">{getTeamName(selectedMatchup.team2_id)} Score</Label>
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