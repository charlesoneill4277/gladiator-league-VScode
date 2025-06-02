import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Download, CheckCircle, AlertCircle, Clock, Database } from 'lucide-react';

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
  draft_id: string;
  status: string;
  league_logo_url: string;
}

interface SyncResult {
  league_id: string;
  success: boolean;
  error?: string;
  data?: any;
}

const DataSync: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSeasons();
    loadLastSyncTime();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadConferences();
    }
  }, [selectedSeasonId]);

  const loadSeasons = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'season_year',
        IsAsc: false
      });

      if (error) throw error;

      const seasonsList = data?.List || [];
      setSeasons(seasonsList);

      // Auto-select current season or most recent
      const currentSeason = seasonsList.find((s: Season) => s.is_current_season);
      if (currentSeason) {
        setSelectedSeasonId(currentSeason.id);
      } else if (seasonsList.length > 0) {
        setSelectedSeasonId(seasonsList[0].id);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
      toast({
        title: "Error",
        description: `Failed to load seasons: ${error}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadConferences = async () => {
    if (!selectedSeasonId) return;

    try {
      const { data, error } = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: [
        {
          name: 'season_id',
          op: 'Equal',
          value: selectedSeasonId
        }]

      });

      if (error) throw error;
      setConferences(data?.List || []);
    } catch (error) {
      console.error('Error loading conferences:', error);
      toast({
        title: "Error",
        description: `Failed to load conferences: ${error}`,
        variant: "destructive"
      });
    }
  };

  const loadLastSyncTime = () => {
    const lastSync = localStorage.getItem('last_data_sync');
    if (lastSync) {
      setLastSyncTime(new Date(lastSync).toLocaleString());
    }
  };

  const syncConferenceData = async () => {
    if (!selectedSeasonId || conferences.length === 0) {
      toast({
        title: "No Data to Sync",
        description: "Please select a season with conferences to sync",
        variant: "destructive"
      });
      return;
    }

    setSyncing(true);
    setProgress(0);
    setSyncResults([]);

    const results: SyncResult[] = [];
    const total = conferences.length;

    for (let i = 0; i < conferences.length; i++) {
      const conference = conferences[i];
      setProgress((i + 1) / total * 100);

      try {
        console.log(`Syncing league ${conference.league_id}...`);

        // Fetch data from Sleeper API
        const response = await fetch(`https://api.sleeper.app/v1/league/${conference.league_id}`);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const leagueData = await response.json();
        console.log('Sleeper API response:', leagueData);

        // Map the API data to our conference fields
        const updatedConference = {
          ID: conference.id,
          conference_name: leagueData.name || conference.conference_name,
          league_id: leagueData.league_id || conference.league_id,
          season_id: conference.season_id,
          draft_id: leagueData.draft_id || conference.draft_id,
          status: leagueData.status || conference.status,
          league_logo_url: leagueData.avatar ?
          `https://sleepercdn.com/avatars/thumbs/${leagueData.avatar}` :
          conference.league_logo_url
        };

        // Update the conference in the database
        const { error: updateError } = await window.ezsite.apis.tableUpdate(12820, updatedConference);

        if (updateError) throw updateError;

        results.push({
          league_id: conference.league_id,
          success: true,
          data: leagueData
        });

        console.log(`Successfully synced league ${conference.league_id}`);

      } catch (error) {
        console.error(`Error syncing league ${conference.league_id}:`, error);
        results.push({
          league_id: conference.league_id,
          success: false,
          error: error.toString()
        });
      }

      // Small delay between requests to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setSyncResults(results);
    setSyncing(false);
    setProgress(100);

    // Update last sync time
    const now = new Date().toISOString();
    localStorage.setItem('last_data_sync', now);
    setLastSyncTime(new Date(now).toLocaleString());

    // Reload conferences to show updated data
    loadConferences();

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    toast({
      title: "Data Sync Complete",
      description: `${successCount} successful, ${failureCount} failed`,
      variant: failureCount > 0 ? "destructive" : "default"
    });
  };

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>);

  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Synchronization
          </CardTitle>
          <CardDescription>
            Sync conference data from Sleeper API to update database records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select
                  value={selectedSeasonId?.toString() || ''}
                  onValueChange={(value) => setSelectedSeasonId(parseInt(value))}>

                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) =>
                    <SelectItem key={season.id} value={season.id.toString()}>
                        {season.season_name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {lastSyncTime &&
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Last sync: {lastSyncTime}
                </div>
              }
            </div>

            <Button
              onClick={syncConferenceData}
              disabled={syncing || !selectedSeasonId || conferences.length === 0}>

              {syncing ?
              <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </> :

              <>
                  <Download className="h-4 w-4 mr-2" />
                  Sync Conference Data
                </>
              }
            </Button>
          </div>

          {syncing &&
          <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Synchronizing data...</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          }

          {selectedSeason && conferences.length === 0 &&
          <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No conferences found for {selectedSeason.season_name}. 
                Please add leagues in the League Manager tab first.
              </AlertDescription>
            </Alert>
          }

          {selectedSeason && conferences.length > 0 &&
          <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Conferences - {selectedSeason.season_name}
                </CardTitle>
                <CardDescription>
                  {conferences.length} conference{conferences.length !== 1 ? 's' : ''} ready for synchronization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conference Name</TableHead>
                      <TableHead>League ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Logo</TableHead>
                      <TableHead>Sync Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conferences.map((conference) => {
                    const syncResult = syncResults.find((r) => r.league_id === conference.league_id);

                    return (
                      <TableRow key={conference.id}>
                          <TableCell className="font-medium">
                            {conference.conference_name}
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {conference.league_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                          conference.status === 'in_season' ? 'default' :
                          conference.status === 'complete' ? 'secondary' :
                          'outline'
                          }>
                              {conference.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {conference.league_logo_url ?
                          <img
                            src={conference.league_logo_url}
                            alt="League logo"
                            className="w-8 h-8 rounded-full" /> :


                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">?</span>
                              </div>
                          }
                          </TableCell>
                          <TableCell>
                            {syncResult ?
                          syncResult.success ?
                          <div className="flex items-center gap-2 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="text-sm">Synced</span>
                                </div> :

                          <div className="flex items-center gap-2 text-red-600">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-sm">Failed</span>
                                </div> :


                          <span className="text-sm text-muted-foreground">Ready</span>
                          }
                          </TableCell>
                        </TableRow>);

                  })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          }

          {syncResults.length > 0 &&
          <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sync Results</CardTitle>
                <CardDescription>
                  Detailed results from the last synchronization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {syncResults.map((result, index) =>
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {result.success ?
                    <CheckCircle className="h-5 w-5 text-green-600" /> :

                    <AlertCircle className="h-5 w-5 text-red-600" />
                    }
                        <code className="text-sm">{result.league_id}</code>
                      </div>
                      <div className="text-sm">
                        {result.success ?
                    <span className="text-green-600">Success</span> :

                    <span className="text-red-600">{result.error}</span>
                    }
                      </div>
                    </div>
                )}
                </div>
              </CardContent>
            </Card>
          }
        </CardContent>
      </Card>
    </div>);

};

export default DataSync;