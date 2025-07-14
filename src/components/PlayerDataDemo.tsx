
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { 
  Search, 
  Users, 
  RefreshCw, 
  Activity, 
  TrendingUp, 
  AlertCircle,
  Play,
  Pause,
  BarChart3,
  Database
} from 'lucide-react';

import {
  usePlayersData,
  usePlayerSearch,
  usePlayerAvailability,
  useAvailabilityStats,
  useTeamRoster,
  useRosterSync,
  useOptimisticRosterUpdate,
  useBulkAvailabilityRefresh,
  useCacheManagement
} from '../hooks/useRealTimePlayerData';

import { SyncConfiguration } from '../services/rosterSyncEngine';
import { AvailabilityFilter } from '../services/playerAvailabilityCalculator';
import { useApp } from '../contexts/AppContext';

const PlayerDataDemo: React.FC = () => {
  const { currentSeasonConfig, selectedSeason } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(0);
  const [currentWeek, setCurrentWeek] = useState(14);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  // Hooks for real-time data
  const { data: allPlayers, isLoading: loadingPlayers, refetch: refetchPlayers } = usePlayersData();
  const { data: searchResults, isLoading: searchingPlayers } = usePlayerSearch({
    name: searchTerm,
    position: selectedPosition && selectedPosition !== 'all' ? selectedPosition : undefined,
    team: selectedTeam && selectedTeam !== 'all' ? selectedTeam : undefined,
    seasonId: selectedSeason,
    week: currentWeek
  });
  
  const { data: playerAvailability } = usePlayerAvailability(selectedPlayerId, selectedSeason, currentWeek);
  const { data: availabilityStats } = useAvailabilityStats(selectedSeason, currentWeek);
  const { data: teamRoster } = useTeamRoster(1, selectedSeason); // Example team ID
  
  const {
    sync,
    isSyncing,
    syncProgress,
    syncState,
    syncResult,
    syncError,
    startAutoSync,
    stopAutoSync,
    forceStop
  } = useRosterSync();

  const {
    addPlayer,
    removePlayer,
    isAddingPlayer,
    isRemovingPlayer,
    addError,
    removeError
  } = useOptimisticRosterUpdate();

  const bulkRefresh = useBulkAvailabilityRefresh();
  const { clearAllCaches, getCacheStats } = useCacheManagement();

  // Auto-sync management
  useEffect(() => {
    if (autoSyncEnabled && !isSyncing) {
      const syncConfig: SyncConfiguration = {
        conferences: currentSeasonConfig.conferences.map((conf, index) => ({
          id: index + 1,
          leagueId: conf.leagueId,
          name: conf.name
        })),
        seasonId: selectedSeason,
        week: currentWeek,
        conflictResolution: {
          strategy: 'latest_wins',
          resolveConflict: (local, remote) => remote // API data takes priority
        },
        batchSize: 50,
        retryAttempts: 3,
        retryDelayMs: 1000
      };

      startAutoSync(syncConfig, 30 * 60 * 1000); // 30 minutes
    } else if (!autoSyncEnabled) {
      stopAutoSync();
    }

    return () => stopAutoSync();
  }, [autoSyncEnabled, currentSeasonConfig, selectedSeason, currentWeek, isSyncing]);

  // Manual sync handler
  const handleManualSync = () => {
    const syncConfig: SyncConfiguration = {
      conferences: currentSeasonConfig.conferences.map((conf, index) => ({
        id: index + 1,
        leagueId: conf.leagueId,
        name: conf.name
      })),
      seasonId: selectedSeason,
      week: currentWeek,
      conflictResolution: {
        strategy: 'latest_wins',
        resolveConflict: (local, remote) => remote
      },
      batchSize: 50,
      retryAttempts: 3,
      retryDelayMs: 1000
    };

    sync(syncConfig);
  };

  // Bulk refresh handler
  const handleBulkRefresh = () => {
    if (!searchResults?.length) {
      toast({
        title: "No Players Selected",
        description: "Please search for players first to refresh their availability.",
        variant: "destructive"
      });
      return;
    }

    const playerIds = searchResults.slice(0, 20).map(p => p.id); // Limit to first 20
    bulkRefresh.mutate({
      playerIds,
      seasonId: selectedSeason,
      week: currentWeek
    });
  };

  // Add player to roster handler
  const handleAddPlayer = (playerId: number) => {
    addPlayer({
      teamId: 1, // Example team ID
      playerId,
      seasonId: selectedSeason,
      week: currentWeek,
      rosterStatus: 'bench'
    });
  };

  // Remove player from roster handler
  const handleRemovePlayer = (playerId: number) => {
    removePlayer({
      teamId: 1, // Example team ID
      playerId,
      seasonId: selectedSeason
    });
  };

  const displayPlayers = searchTerm || (selectedPosition && selectedPosition !== 'all') || (selectedTeam && selectedTeam !== 'all') ? searchResults : allPlayers;
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const nflTeams = ['KC', 'BUF', 'SF', 'BAL', 'CIN', 'DAL', 'PHI', 'MIA']; // Sample teams

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Player Data Service</h1>
          <p className="text-muted-foreground">
            Comprehensive player management with live sync and caching
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearAllCaches()}
          >
            <Database className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
          <Button
            variant={autoSyncEnabled ? "destructive" : "default"}
            size="sm"
            onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
          >
            {autoSyncEnabled ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {autoSyncEnabled ? 'Stop Auto-Sync' : 'Start Auto-Sync'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="search" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="search">Player Search</TabsTrigger>
          <TabsTrigger value="sync">Data Sync</TabsTrigger>
          <TabsTrigger value="roster">Roster Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="cache">Cache Status</TabsTrigger>
        </TabsList>

        {/* Player Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Player Search & Availability
              </CardTitle>
              <CardDescription>
                Search players with real-time availability status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search">Search by Name</Label>
                  <Input
                    id="search"
                    placeholder="Enter player name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                    <SelectTrigger>
                      <SelectValue placeholder="All positions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All positions</SelectItem>
                      {positions.map(pos => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="team">NFL Team</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger>
                      <SelectValue placeholder="All teams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All teams</SelectItem>
                      {nflTeams.map(team => (
                        <SelectItem key={team} value={team}>{team}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    onClick={handleBulkRefresh}
                    disabled={bulkRefresh.isPending}
                    className="flex-1"
                  >
                    {bulkRefresh.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>NFL Team</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPlayers || searchingPlayers ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : displayPlayers?.slice(0, 20).map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.player_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{player.position}</Badge>
                        </TableCell>
                        <TableCell>{player.nfl_team}</TableCell>
                        <TableCell>
                          <Badge variant={player.injury_status === 'Healthy' ? 'default' : 'destructive'}>
                            {player.injury_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={player.status === 'Active' ? 'default' : 'secondary'}>
                            {player.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPlayerId(player.id)}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAddPlayer(player.id)}
                              disabled={isAddingPlayer}
                            >
                              Add
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedPlayerId > 0 && playerAvailability && (
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Player Availability:</strong> {playerAvailability.is_available ? 'Available' : 'Owned'} 
                    {!playerAvailability.is_available && ` by Team ${playerAvailability.owned_by_team_id}`}
                    <br />
                    <strong>Roster Status:</strong> {playerAvailability.roster_status}
                    <br />
                    <strong>Last Updated:</strong> {new Date(playerAvailability.cache_updated_at).toLocaleString()}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Sync Tab */}
        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Data Synchronization
              </CardTitle>
              <CardDescription>
                Manage data sync with Sleeper API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Sync Status</p>
                  <p className="text-sm text-muted-foreground">
                    {isSyncing ? 'Synchronization in progress...' : 'Ready to sync'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Manual Sync
                  </Button>
                  {isSyncing && (
                    <Button variant="destructive" onClick={forceStop}>
                      Force Stop
                    </Button>
                  )}
                </div>
              </div>

              {syncProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{syncProgress.stage}</span>
                    <span>{syncProgress.progress}/{syncProgress.total}</span>
                  </div>
                  <Progress 
                    value={syncProgress.total > 0 ? (syncProgress.progress / syncProgress.total) * 100 : 0} 
                  />
                  {syncProgress.currentItem && (
                    <p className="text-xs text-muted-foreground">{syncProgress.currentItem}</p>
                  )}
                </div>
              )}

              {syncResult && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Sync Completed:</strong> {syncResult.success ? 'Success' : 'Failed'}
                    <br />
                    <strong>Records Processed:</strong> {syncResult.recordsProcessed}
                    <br />
                    <strong>Duration:</strong> {(syncResult.duration / 1000).toFixed(2)}s
                    <br />
                    <strong>API Calls:</strong> {syncResult.apiCalls}
                    {syncResult.errors.length > 0 && (
                      <>
                        <br />
                        <strong>Errors:</strong> {syncResult.errors.length}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {syncState && (
                <div className="text-sm space-y-1">
                  <p><strong>Last Sync:</strong> {syncState.lastSync?.toLocaleString() || 'Never'}</p>
                  <p><strong>Next Sync:</strong> {syncState.nextSync?.toLocaleString() || 'Not scheduled'}</p>
                  {syncState.errors.length > 0 && (
                    <p><strong>Recent Errors:</strong> {syncState.errors.length}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roster Management Tab */}
        <TabsContent value="roster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Roster Management
              </CardTitle>
              <CardDescription>
                Real-time roster updates with optimistic UI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamRoster?.map((rosterEntry) => (
                      <TableRow key={rosterEntry.player_id}>
                        <TableCell className="font-medium">
                          Player {rosterEntry.player_id}
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <Badge>{rosterEntry.roster_status}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(rosterEntry.added_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemovePlayer(rosterEntry.player_id)}
                            disabled={isRemovingPlayer}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {(addError || removeError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Error: {addError?.message || removeError?.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Availability Analytics
              </CardTitle>
              <CardDescription>
                Real-time player availability statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availabilityStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Total Players</p>
                    <p className="text-2xl font-bold">{availabilityStats.totalPlayers}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Available</p>
                    <p className="text-2xl font-bold text-green-600">{availabilityStats.availablePlayers}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Owned</p>
                    <p className="text-2xl font-bold text-red-600">{availabilityStats.ownedPlayers}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">On Waivers</p>
                    <p className="text-2xl font-bold text-orange-600">{availabilityStats.waiversCount}</p>
                  </div>
                </div>
              )}

              {availabilityStats?.byPosition && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">By Position</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(availabilityStats.byPosition).map(([position, stats]) => (
                      <div key={position} className="text-center p-3 border rounded">
                        <p className="font-medium">{position}</p>
                        <p className="text-sm">Total: {stats.total}</p>
                        <p className="text-sm text-green-600">Available: {stats.available}</p>
                        <p className="text-sm text-red-600">Owned: {stats.owned}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cache Status Tab */}
        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Cache Management
              </CardTitle>
              <CardDescription>
                Monitor and manage application caches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button onClick={() => {
                  const stats = getCacheStats();
                  console.log('Cache Statistics:', stats);
                  toast({
                    title: "Cache Statistics",
                    description: "Check console for detailed cache information"
                  });
                }}>
                  View Cache Stats
                </Button>
                
                <div className="text-sm space-y-2">
                  <p><strong>Auto-Sync:</strong> {autoSyncEnabled ? 'Enabled' : 'Disabled'}</p>
                  <p><strong>Current Week:</strong> {currentWeek}</p>
                  <p><strong>Season:</strong> {selectedSeason}</p>
                  <p><strong>Active Conferences:</strong> {currentSeasonConfig.conferences.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerDataDemo;
