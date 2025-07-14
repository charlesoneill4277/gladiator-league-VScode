
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Play,
  Pause,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  BarChart3,
  History,
  Timer,
  Activity } from
'lucide-react';
import { toast } from '@/hooks/use-toast';
import weeklyAutoSyncService, { SyncSchedule, SyncStatus, SyncHistory } from '@/services/weeklyAutoSyncService';

const AutoSyncManager: React.FC = () => {
  const [schedule, setSchedule] = useState<SyncSchedule>(weeklyAutoSyncService.getSchedule());
  const [status, setStatus] = useState<SyncStatus>(weeklyAutoSyncService.getStatus());
  const [history, setHistory] = useState<SyncHistory[]>(weeklyAutoSyncService.getHistory());
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const unsubscribeStatus = weeklyAutoSyncService.onStatusChange(setStatus);
    const unsubscribeHistory = weeklyAutoSyncService.onHistoryChange(setHistory);

    return () => {
      unsubscribeStatus();
      unsubscribeHistory();
    };
  }, []);

  const handleScheduleUpdate = (updates: Partial<SyncSchedule>) => {
    const newSchedule = { ...schedule, ...updates };
    setSchedule(newSchedule);
    weeklyAutoSyncService.updateSchedule(updates);

    toast({
      title: 'Schedule Updated',
      description: 'Auto-sync schedule has been updated successfully.'
    });
  };

  const handleManualSync = async () => {
    if (status.status === 'running') {
      toast({
        title: 'Sync Already Running',
        description: 'Please wait for the current sync to complete.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      await weeklyAutoSyncService.runManualSync();
      toast({
        title: 'Manual Sync Started',
        description: 'Sync has been initiated manually.'
      });
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: `Failed to start manual sync: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return 'bg-green-500';
      case 'running':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      case 'partial':
        return 'bg-yellow-500';
      case 'scheduled':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4" />;
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      default:
        return <Pause className="w-4 h-4" />;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatDateTime = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString();
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Auto-Sync Manager</h2>
          <p className="text-muted-foreground">Manage automatic weekly synchronization with Sleeper API</p>
        </div>
        <Button
          onClick={handleManualSync}
          disabled={isLoading || status.status === 'running'}
          className="gap-2">

          {isLoading || status.status === 'running' ?
          <RefreshCw className="w-4 h-4 animate-spin" /> :

          <Play className="w-4 h-4" />
          }
          {isLoading || status.status === 'running' ? 'Syncing...' : 'Run Manual Sync'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="w-4 h-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
                {getStatusIcon(status.status)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{status.status}</div>
                <p className="text-xs text-muted-foreground">{status.currentStep}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auto-Sync</CardTitle>
                <Settings className="w-4 h-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{schedule.enabled ? 'Enabled' : 'Disabled'}</div>
                <p className="text-xs text-muted-foreground">
                  {schedule.enabled ? `${dayNames[schedule.dayOfWeek]} at ${schedule.hour}:${schedule.minute.toString().padStart(2, '0')}` : 'Manual only'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Run</CardTitle>
                <Timer className="w-4 h-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status.lastRunTime ? formatDateTime(status.lastRunTime).split(' ')[1] : 'Never'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.lastRunTime ? formatDateTime(status.lastRunTime).split(' ')[0] : 'No previous runs'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Run</CardTitle>
                <Clock className="w-4 h-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status.nextRunTime ? formatDateTime(status.nextRunTime).split(' ')[1] : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.nextRunTime ? formatDateTime(status.nextRunTime).split(' ')[0] : 'No scheduled runs'}
                </p>
              </CardContent>
            </Card>
          </div>

          {status.status === 'running' &&
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Sync in Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{status.currentStep}</span>
                    <span>{status.progress}%</span>
                  </div>
                  <Progress value={status.progress} className="h-2" />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Matchups: {status.processedMatchups} / {status.totalMatchups}</span>
                  <span>Started: {formatDateTime(status.startTime)}</span>
                </div>
              </CardContent>
            </Card>
          }

          {status.errors.length > 0 &&
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">Sync Errors:</div>
                <ul className="mt-1 space-y-1">
                  {status.errors.map((error, index) =>
                <li key={index} className="text-sm">• {error}</li>
                )}
                </ul>
              </AlertDescription>
            </Alert>
          }
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Schedule Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-sync">Enable Automatic Sync</Label>
                <Switch
                  id="enable-sync"
                  checked={schedule.enabled}
                  onCheckedChange={(enabled) => handleScheduleUpdate({ enabled })} />

              </div>

              {schedule.enabled &&
              <>
                  <div className="space-y-2">
                    <Label htmlFor="day-of-week">Day of Week</Label>
                    <Select
                    value={schedule.dayOfWeek.toString()}
                    onValueChange={(value) => handleScheduleUpdate({ dayOfWeek: parseInt(value) })}>

                      <SelectTrigger>
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {dayNames.map((day, index) =>
                      <SelectItem key={index} value={index.toString()}>
                            {day}
                          </SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hour">Hour (24-hour format)</Label>
                      <Input
                      id="hour"
                      type="number"
                      min="0"
                      max="23"
                      value={schedule.hour}
                      onChange={(e) => handleScheduleUpdate({ hour: parseInt(e.target.value) || 0 })} />

                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minute">Minute</Label>
                      <Input
                      id="minute"
                      type="number"
                      min="0"
                      max="59"
                      value={schedule.minute}
                      onChange={(e) => handleScheduleUpdate({ minute: parseInt(e.target.value) || 0 })} />

                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                    value={schedule.timezone}
                    onValueChange={(timezone) => handleScheduleUpdate({ timezone })}>

                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              }

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> Automatic sync will only run when the browser is open and active. 
                  For production use, consider implementing server-side scheduling.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Current Status</Label>
                    <Badge variant="outline" className={`${getStatusColor(status.status)} text-white`}>
                      {status.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Current Step</Label>
                    <p className="text-sm">{status.currentStep}</p>
                  </div>
                </div>

                {status.status === 'running' &&
                <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Progress</Label>
                      <Progress value={status.progress} className="h-2" />
                      <p className="text-sm text-muted-foreground">{status.progress}% complete</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Processed Matchups</Label>
                        <p className="text-2xl font-bold">{status.processedMatchups}</p>
                      </div>
                      <div>
                        <Label>Total Matchups</Label>
                        <p className="text-2xl font-bold">{status.totalMatchups}</p>
                      </div>
                    </div>
                  </div>
                }

                {status.startTime &&
                <div className="space-y-2">
                    <Label>Started At</Label>
                    <p className="text-sm">{formatDateTime(status.startTime)}</p>
                  </div>
                }

                {status.endTime &&
                <div className="space-y-2">
                    <Label>Completed At</Label>
                    <p className="text-sm">{formatDateTime(status.endTime)}</p>
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Matchups</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ?
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No sync history available
                        </TableCell>
                      </TableRow> :

                    history.map((entry) =>
                    <TableRow key={entry.id}>
                          <TableCell>{formatDateTime(entry.timestamp)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${getStatusColor(entry.status)} text-white`}>
                              {entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDuration(entry.duration)}</TableCell>
                          <TableCell>{entry.matchupsProcessed}</TableCell>
                          <TableCell>{entry.recordsUpdated}</TableCell>
                          <TableCell>
                            {entry.errors.length > 0 ?
                        <Badge variant="destructive">{entry.errors.length}</Badge> :

                        <span className="text-green-600">None</span>
                        }
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{entry.details}</TableCell>
                        </TableRow>
                    )
                    }
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default AutoSyncManager;