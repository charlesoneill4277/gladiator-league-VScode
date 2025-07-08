import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DatabaseMatchup {
  id: number;
  conference_id: number;
  week: number;
  team_1_id: number;
  team_2_id: number;
  is_playoff: boolean;
  sleeper_matchup_id: string;
  team_1_score: number;
  team_2_score: number;
  winner_id: number;
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
}

const MatchupsDebugger: React.FC = () => {
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<number>(14);
  const [matchups, setMatchups] = useState<DatabaseMatchup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    totalMatchups: number;
    uniqueMatchups: number;
    duplicates: DatabaseMatchup[];
    issues: string[];
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log(`🔍 Fetching debug data for week ${selectedWeek}...`);

      // Fetch matchups
      const matchupsResponse = await window.ezsite.apis.tablePage('13329', {
        PageNo: 1,
        PageSize: 500,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
          {
            name: 'week',
            op: 'Equal',
            value: selectedWeek
          }
        ]
      });

      if (matchupsResponse.error) {
        throw new Error(matchupsResponse.error);
      }

      const matchupsData = matchupsResponse.data.List as DatabaseMatchup[];
      setMatchups(matchupsData);
      console.log(`Found ${matchupsData.length} matchups in database`);

      // Fetch teams
      const teamsResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 200,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (teamsResponse.error) {
        throw new Error(teamsResponse.error);
      }

      const teamsData = teamsResponse.data.List as Team[];
      setTeams(teamsData);

      // Fetch conferences
      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: []
      });

      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }

      const conferencesData = conferencesResponse.data.List as Conference[];
      setConferences(conferencesData);

      // Analyze for duplicates
      analyzeMatchups(matchupsData, teamsData, conferencesData);

    } catch (error) {
      console.error('Error fetching debug data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch debug data.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeMatchups = (matchupsData: DatabaseMatchup[], teamsData: Team[], conferencesData: Conference[]) => {
    const issues: string[] = [];
    const duplicates: DatabaseMatchup[] = [];
    const uniqueMatchups = new Set<string>();

    // Check for duplicate matchups
    const matchupPairs = new Map<string, DatabaseMatchup[]>();

    matchupsData.forEach(matchup => {
      // Create unique key for matchup pair (order-independent)
      const team1 = Math.min(matchup.team_1_id, matchup.team_2_id);
      const team2 = Math.max(matchup.team_1_id, matchup.team_2_id);
      const key = `${team1}-${team2}-${matchup.week}`;
      
      if (!matchupPairs.has(key)) {
        matchupPairs.set(key, []);
      }
      matchupPairs.get(key)!.push(matchup);
      
      uniqueMatchups.add(key);
    });

    // Find duplicates
    matchupPairs.forEach((matchups, key) => {
      if (matchups.length > 1) {
        issues.push(`Duplicate matchup found: ${key} (${matchups.length} entries)`);
        duplicates.push(...matchups);
      }
    });

    // Check for other issues
    matchupsData.forEach(matchup => {
      const team1 = teamsData.find(t => t.id === matchup.team_1_id);
      const team2 = teamsData.find(t => t.id === matchup.team_2_id);
      
      if (!team1) {
        issues.push(`Missing team 1 data for matchup ${matchup.id} (team_id: ${matchup.team_1_id})`);
      }
      if (!team2) {
        issues.push(`Missing team 2 data for matchup ${matchup.id} (team_id: ${matchup.team_2_id})`);
      }
      
      const conference = conferencesData.find(c => c.id === matchup.conference_id);
      if (!conference) {
        issues.push(`Missing conference data for matchup ${matchup.id} (conference_id: ${matchup.conference_id})`);
      }
    });

    setAnalysisResult({
      totalMatchups: matchupsData.length,
      uniqueMatchups: uniqueMatchups.size,
      duplicates,
      issues
    });
  };

  const removeDuplicates = async () => {
    if (!analysisResult?.duplicates.length) return;

    try {
      setLoading(true);
      
      // Group duplicates by matchup pair
      const duplicateGroups = new Map<string, DatabaseMatchup[]>();
      
      analysisResult.duplicates.forEach(matchup => {
        const team1 = Math.min(matchup.team_1_id, matchup.team_2_id);
        const team2 = Math.max(matchup.team_1_id, matchup.team_2_id);
        const key = `${team1}-${team2}-${matchup.week}`;
        
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key)!.push(matchup);
      });

      // Keep the first entry of each group, delete the rest
      for (const [key, group] of duplicateGroups) {
        const [keep, ...toDelete] = group.sort((a, b) => a.id - b.id);
        
        for (const matchup of toDelete) {
          const response = await window.ezsite.apis.tableDelete('13329', { ID: matchup.id });
          if (response.error) {
            console.error(`Failed to delete matchup ${matchup.id}:`, response.error);
          } else {
            console.log(`Deleted duplicate matchup ${matchup.id}`);
          }
        }
      }

      toast({
        title: 'Success',
        description: 'Duplicate matchups removed successfully.',
        variant: 'default'
      });

      // Refresh data
      await fetchData();

    } catch (error) {
      console.error('Error removing duplicates:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove duplicate matchups.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWeek]);

  const getTeamName = (teamId: number) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.team_name : `Team ${teamId}`;
  };

  const getConferenceName = (conferenceId: number) => {
    const conference = conferences.find(c => c.id === conferenceId);
    return conference ? conference.conference_name : `Conference ${conferenceId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Matchups Debugger</h2>
        <div className="flex items-center space-x-4">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Analysis Summary */}
      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Analysis Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{analysisResult.totalMatchups}</div>
                <div className="text-sm text-muted-foreground">Total Matchups</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{analysisResult.uniqueMatchups}</div>
                <div className="text-sm text-muted-foreground">Unique Matchups</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{analysisResult.duplicates.length}</div>
                <div className="text-sm text-muted-foreground">Duplicates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{analysisResult.issues.length}</div>
                <div className="text-sm text-muted-foreground">Issues</div>
              </div>
            </div>

            {analysisResult.duplicates.length > 0 && (
              <div className="mt-4">
                <Button onClick={removeDuplicates} disabled={loading} variant="destructive">
                  Remove Duplicates
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Issues */}
      {analysisResult?.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>Issues Found</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysisResult.issues.map((issue, index) => (
                <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {issue}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matchups List */}
      <Card>
        <CardHeader>
          <CardTitle>Matchups for Week {selectedWeek}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {matchups.map((matchup) => (
              <div key={matchup.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-4">
                  <Badge variant="outline">#{matchup.id}</Badge>
                  <div>
                    <div className="font-medium">
                      {getTeamName(matchup.team_1_id)} vs {getTeamName(matchup.team_2_id)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getConferenceName(matchup.conference_id)} • Week {matchup.week}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {matchup.is_manual_override && (
                    <Badge variant="outline" className="text-orange-600">Override</Badge>
                  )}
                  {matchup.is_playoff && (
                    <Badge variant="outline" className="text-purple-600">Playoff</Badge>
                  )}
                  <Badge variant="secondary">{matchup.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchupsDebugger;