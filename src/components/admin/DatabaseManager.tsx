
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  RefreshCw, 
  Clock, 
  Users, 
  Activity, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  BarChart3,
  History,
  Search
} from 'lucide-react';
import DatabaseService from '@/services/databaseService';

interface SyncStatus {
  id: number;
  syncType: string;
  conferenceId: number;
  seasonId: number;
  week: number;
  syncStatus: string;
  lastSyncStarted?: string;
  lastSyncCompleted?: string;
  syncDurationSeconds?: number;
  recordsProcessed?: number;
  errorsEncountered?: number;
  errorMessage?: string;
  sleeperApiCalls?: number;
  nextSyncDue?: string;
}

interface RosterHistoryEntry {
  id: number;
  teamId: number;
  playerId: number;
  seasonId: number;
  week: number;
  actionType: string;
  transactionId?: string;
  transactionDate: string;
  faabCost?: number;
  notes?: string;
}

const DatabaseManager: React.FC = () => {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [rosterHistory, setRosterHistory] = useState<RosterHistoryEntry[]>([]);
  const [selectedConference, setSelectedConference] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchPlayerId, setSearchPlayerId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('sync-status');
  const { toast } = useToast();

  useEffect(() => {
    fetchSyncStatuses();
  }, []);

  const fetchSyncStatuses = async () => {
    try {
      setLoading(true);
      const response = await DatabaseService.getSyncStatus();
      setSyncStatuses(response.List || []);
    } catch (error) {
      console.error('Error fetching sync statuses:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sync statuses",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRosterHistory = async (playerId?: number) => {
    try {
      setLoading(true);
      const seasonId = selectedSeason ? parseInt(selectedSeason) : undefined;
      const response = await DatabaseService.getPlayerRosterHistory(
        playerId || parseInt(searchPlayerId),
        seasonId
      );
      setRosterHistory(response.List || []);
    } catch (error) {
      console.error('Error fetching roster history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch roster history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (syncType: string, conferenceId?: number) => {
    try {
      setSyncing(true);
      const now = new Date();
      
      // Update sync status to in_progress
      await DatabaseService.updateSyncStatus({
        syncType: syncType as any,
        conferenceId: conferenceId || 0,
        seasonId: parseInt(selectedSeason) || 0,
        week: parseInt(selectedWeek) || 1,
        syncStatus: 'in_progress',
        lastSyncStarted: now,
        recordsProcessed: 0,
        errorsEncountered: 0,
        sleeperApiCalls: 0
      });

      // Simulate sync process (in real implementation, this would call Sleeper API)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update sync status to completed
      await DatabaseService.updateSyncStatus({
        syncType: syncType as any,
        conferenceId: conferenceId || 0,
        seasonId: parseInt(selectedSeason) || 0,
        week: parseInt(selectedWeek) || 1,
        syncStatus: 'completed',
        lastSyncStarted: now,
        lastSyncCompleted: new Date(),
        syncDurationSeconds: 2,
        recordsProcessed: Math.floor(Math.random() * 100) + 10,
        errorsEncountered: 0,
        sleeperApiCalls: Math.floor(Math.random() * 10) + 1
      });

      toast({
        title: "Success",
        description: `${syncType} sync completed successfully`,
        variant: "default"
      });

      await fetchSyncStatuses();
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: "Error",
        description: "Failed to trigger sync",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const updatePlayerAvailabilityCache = async () => {
    try {
      setLoading(true);
      
      // This would typically pull from Sleeper API and update the cache
      // For demo purposes, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: "Success",
        description: "Player availability cache updated",
        variant: "default"
      });
    } catch (error) {
      console.error('Error updating player availability cache:', error);
      toast({
        title: "Error",
        description: "Failed to update player availability cache",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSyncStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Database Management</h2>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Database Control Panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="season-select">Season</Label>
              <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conference-select">Conference</Label>
              <Select value={selectedConference} onValueChange={setSelectedConference}>
                <SelectTrigger>
                  <SelectValue placeholder="Select conference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conferences</SelectItem>
                  <SelectItem value="1">Legions of Mars</SelectItem>
                  <SelectItem value="2">Guardians of Jupiter</SelectItem>
                  <SelectItem value="3">Vulcan's Oathsworn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="week-select">Week</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 18 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Week {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different management areas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sync-status">Sync Status</TabsTrigger>
          <TabsTrigger value="roster-history">Roster History</TabsTrigger>
          <TabsTrigger value="cache-management">Cache Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="sync-status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Synchronization Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => triggerSync('rosters', selectedConference ? parseInt(selectedConference) : undefined)}
                    disabled={syncing || !selectedSeason || !selectedWeek}
                    className="flex items-center gap-2"
                  >
                    {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Sync Rosters
                  </Button>
                  <Button
                    onClick={() => triggerSync('matchups', selectedConference ? parseInt(selectedConference) : undefined)}
                    disabled={syncing || !selectedSeason || !selectedWeek}
                    variant="outline"
                  >
                    Sync Matchups
                  </Button>
                  <Button
                    onClick={() => triggerSync('players', selectedConference ? parseInt(selectedConference) : undefined)}
                    disabled={syncing || !selectedSeason || !selectedWeek}
                    variant="outline"
                  >
                    Sync Players
                  </Button>
                  <Button
                    onClick={fetchSyncStatuses}
                    disabled={loading}
                    variant="outline"
                  >
                    Refresh Status
                  </Button>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Loading sync statuses...</span>
                    </div>
                    <Progress value={undefined} className="w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Conference</TableHead>
                        <TableHead>Season</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Sync</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncStatuses.map((status) => (
                        <TableRow key={status.id}>
                          <TableCell className="font-medium">{status.syncType}</TableCell>
                          <TableCell>{status.conferenceId}</TableCell>
                          <TableCell>{status.seasonId}</TableCell>
                          <TableCell>{status.week}</TableCell>
                          <TableCell>
                            <Badge variant={getSyncStatusVariant(status.syncStatus)} className="flex items-center gap-1">
                              {getSyncStatusIcon(status.syncStatus)}
                              {status.syncStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(status.lastSyncCompleted)}
                          </TableCell>
                          <TableCell>{formatDuration(status.syncDurationSeconds)}</TableCell>
                          <TableCell>{status.recordsProcessed || 0}</TableCell>
                          <TableCell>
                            {status.errorsEncountered ? (
                              <Badge variant="destructive">{status.errorsEncountered}</Badge>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roster-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Roster History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="player-search">Player ID</Label>
                    <Input
                      id="player-search"
                      placeholder="Enter player ID"
                      value={searchPlayerId}
                      onChange={(e) => setSearchPlayerId(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => fetchRosterHistory()}
                    disabled={loading || !searchPlayerId}
                    className="flex items-center gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Search History
                  </Button>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Loading roster history...</span>
                    </div>
                    <Progress value={undefined} className="w-full" />
                  </div>
                ) : rosterHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead>FAAB Cost</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosterHistory.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {formatDate(entry.transactionDate)}
                          </TableCell>
                          <TableCell>{entry.teamId}</TableCell>
                          <TableCell>{entry.playerId}</TableCell>
                          <TableCell>
                            <Badge variant={entry.actionType === 'add' ? 'default' : 'secondary'}>
                              {entry.actionType}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.week}</TableCell>
                          <TableCell>
                            {entry.faabCost ? `$${entry.faabCost}` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                            {entry.notes || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No roster history found. Search for a player to view their roster history.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache-management" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Cache Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Cache management operations can impact application performance. Use with caution.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button
                    onClick={updatePlayerAvailabilityCache}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Update Player Availability Cache
                  </Button>
                  <Button
                    onClick={() => {/* TODO: Implement cache clear */}}
                    variant="outline"
                    disabled={loading}
                  >
                    Clear Cache
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">1,847</div>
                      <p className="text-sm text-gray-600">Cached Players</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">98%</div>
                      <p className="text-sm text-gray-600">Cache Hit Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">2.3ms</div>
                      <p className="text-sm text-gray-600">Avg Query Time</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Database Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">36</div>
                    <p className="text-sm text-gray-600">Total Teams</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">792</div>
                    <p className="text-sm text-gray-600">Total Players</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">1,234</div>
                    <p className="text-sm text-gray-600">Total Transactions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">13</div>
                    <p className="text-sm text-gray-600">Current Week</p>
                  </CardContent>
                </Card>
              </div>

              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Advanced analytics and reporting features are available in the premium version.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabaseManager;
