import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy,
  Calculator,
  RotateCcw,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity } from
'lucide-react';
import { teamRecordsService, TeamRecord, StandingsData } from '@/services/teamRecordsService';

const TeamRecordsDashboard: React.FC = () => {
  const [teamRecords, setTeamRecords] = useState<TeamRecord[]>([]);
  const [standingsData, setStandingsData] = useState<StandingsData[]>([]);
  const [recordsSummary, setRecordsSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

  const currentSeasonId = 1; // This should be dynamic based on current season

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage('');

      // Load data with individual error handling to prevent complete failure
      let records = [];
      let standings = [];
      let summary = null;

      try {
        records = await teamRecordsService.getTeamRecords(currentSeasonId);
      } catch (error) {
        console.error('Error loading team records:', error);
        toast({
          title: 'Warning',
          description: 'Failed to load team records',
          variant: 'destructive'
        });
      }

      try {
        standings = await teamRecordsService.getStandingsData(currentSeasonId);
      } catch (error) {
        console.error('Error loading standings data:', error);
        toast({
          title: 'Warning',
          description: 'Failed to load standings data',
          variant: 'destructive'
        });
      }

      try {
        summary = await teamRecordsService.getRecordsSummary(currentSeasonId);
      } catch (error) {
        console.error('Error loading records summary:', error);
        toast({
          title: 'Warning',
          description: 'Failed to load records summary',
          variant: 'destructive'
        });
      }

      setTeamRecords(records);
      setStandingsData(standings);
      setRecordsSummary(summary);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculateRecords = async () => {
    try {
      setIsProcessing(true);
      await teamRecordsService.calculateTeamRecords(currentSeasonId, undefined, false);
      await loadDashboardData();

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
      setIsProcessing(false);
    }
  };

  const handleMarkChampions = async () => {
    try {
      setIsProcessing(true);
      await teamRecordsService.markConferenceChampions(currentSeasonId);
      await loadDashboardData();

      toast({
        title: 'Success',
        description: 'Conference champions marked successfully'
      });
    } catch (error) {
      console.error('Error marking champions:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark conference champions',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetRecords = async () => {
    if (!confirm('Are you sure you want to reset all team records? This action cannot be undone.')) {
      return;
    }

    try {
      setIsProcessing(true);
      await teamRecordsService.resetTeamRecords(currentSeasonId);
      await loadDashboardData();

      toast({
        title: 'Success',
        description: 'Team records reset successfully'
      });
    } catch (error) {
      console.error('Error resetting records:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset team records',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getWinPercentageColor = (percentage: number) => {
    if (percentage >= 0.7) return 'text-green-600';
    if (percentage >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Team Records Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
          </div>
        </CardContent>
      </Card>);

  }

  if (hasError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Team Records Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {errorMessage || 'An unexpected error occurred while loading the dashboard data.'}
              </p>
              <Button onClick={loadDashboardData} disabled={isLoading}>
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>);

  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Team Records Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Teams</p>
                        <p className="text-2xl font-bold">{recordsSummary?.totalTeams || 0}</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Matchups</p>
                        <p className="text-2xl font-bold">{recordsSummary?.totalMatchups || 0}</p>
                      </div>
                      <Activity className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{recordsSummary?.completedMatchups || 0}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Pending</p>
                        <p className="text-2xl font-bold text-orange-600">{recordsSummary?.pendingMatchups || 0}</p>
                      </div>
                      <Clock className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

            {/* Auto-Sync Status */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Auto-sync is enabled. Team records are automatically updated when matchups are completed.
                {recordsSummary && recordsSummary.recordsLastUpdated &&
                <span className="block mt-1 text-sm text-muted-foreground">
                    Last updated: {formatDate(recordsSummary.recordsLastUpdated)}
                  </span>
                }
                {!recordsSummary &&
                <span className="block mt-1 text-sm text-muted-foreground">
                    No records data available
                  </span>
                }
              </AlertDescription>
            </Alert>
          </TabsContent>
          
          <TabsContent value="standings" className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Conference</TableHead>
                    <TableHead>Record</TableHead>
                    <TableHead>Win %</TableHead>
                    <TableHead>Points For</TableHead>
                    <TableHead>Points Against</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standingsData.length > 0 ? (
                    standingsData.map((team) =>
                    <TableRow key={team.team_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{team.overall_rank}</span>
                            {team.is_conference_champion &&
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          }
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{team.team_name}</div>
                            <div className="text-sm text-muted-foreground">{team.owner_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{team.conference_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {team.wins}-{team.losses}
                            {team.ties > 0 && `-${team.ties}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getWinPercentageColor(team.win_percentage)}`}>
                            {(team.win_percentage * 100).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>{team.points_for.toFixed(1)}</TableCell>
                        <TableCell>{team.points_against.toFixed(1)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {team.playoff_eligible &&
                          <Badge variant="secondary" className="text-xs">
                                Playoff Eligible
                              </Badge>
                          }
                            {team.is_conference_champion &&
                          <Badge variant="default" className="text-xs bg-yellow-500">
                                Conference Champion
                              </Badge>
                          }
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="w-8 h-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No standings data available</p>
                          <p className="text-xs text-muted-foreground">Team records may need to be calculated</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="management" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={handleRecalculateRecords}
                disabled={isProcessing}
                className="flex items-center gap-2 h-20 text-left flex-col justify-center">

                <Calculator className="w-6 h-6" />
                <span>Recalculate Records</span>
              </Button>
              
              <Button
                onClick={handleMarkChampions}
                disabled={isProcessing}
                variant="outline"
                className="flex items-center gap-2 h-20 text-left flex-col justify-center">

                <Trophy className="w-6 h-6" />
                <span>Mark Champions</span>
              </Button>
              
              <Button
                onClick={handleResetRecords}
                disabled={isProcessing}
                variant="destructive"
                className="flex items-center gap-2 h-20 text-left flex-col justify-center">

                <RotateCcw className="w-6 h-6" />
                <span>Reset Records</span>
              </Button>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Management Actions:</strong>
                <ul className="mt-2 list-disc list-inside text-sm space-y-1">
                  <li><strong>Recalculate Records:</strong> Manually recalculate all team records from completed matchups</li>
                  <li><strong>Mark Champions:</strong> Mark the #1 ranked team in each conference as champion</li>
                  <li><strong>Reset Records:</strong> Clear all team records (use with caution)</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Automatic Sync Features:</strong>
                <ul className="mt-2 list-disc list-inside text-sm space-y-1">
                  <li>Records are automatically updated when matchups are completed</li>
                  <li>Rankings are recalculated after each matchup completion</li>
                  <li>Win percentages and playoff eligibility are updated automatically</li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>);

};

export default TeamRecordsDashboard;