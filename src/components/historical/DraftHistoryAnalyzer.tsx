import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Search, Trophy, TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import HistoricalDataService, { DraftHistoryEntry } from '../../services/historicalDataService';

interface DraftHistoryAnalyzerProps {
  teamId?: number;
  conferenceId?: number;
}

const DraftHistoryAnalyzer: React.FC<DraftHistoryAnalyzerProps> = ({
  teamId,
  conferenceId
}) => {
  const [draftHistory, setDraftHistory] = useState<DraftHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>(teamId?.toString() || 'all');
  const [selectedConference, setSelectedConference] = useState<string>(conferenceId?.toString() || 'all');
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [teams, setTeams] = useState<any[]>([]);
  const [conferences, setConferences] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const { toast } = useToast();

  const historicalDataService = HistoricalDataService.getInstance();

  useEffect(() => {
    loadTeams();
    loadConferences();
    loadSeasons();
  }, []);

  useEffect(() => {
    loadDraftHistory();
  }, [selectedTeam, selectedConference, selectedSeasons]);

  const loadTeams = async () => {
    try {
      const response = await window.ezsite.apis.tablePage(12852, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (response.error) throw response.error;
      setTeams(response.data.List);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive'
      });
    }
  };

  const loadConferences = async () => {
    try {
      const response = await window.ezsite.apis.tablePage(12820, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: []
      });

      if (response.error) throw response.error;
      setConferences(response.data.List);
    } catch (error) {
      console.error('Error loading conferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conferences',
        variant: 'destructive'
      });
    }
  };

  const loadSeasons = async () => {
    try {
      const response = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: []
      });

      if (response.error) throw response.error;
      setSeasons(response.data.List);
    } catch (error) {
      console.error('Error loading seasons:', error);
      toast({
        title: 'Error',
        description: 'Failed to load seasons',
        variant: 'destructive'
      });
    }
  };

  const loadDraftHistory = async () => {
    try {
      setLoading(true);
      const history = await historicalDataService.getDraftHistory(
        selectedSeasons.length > 0 ? selectedSeasons : undefined,
        selectedConference !== 'all' ? parseInt(selectedConference) : undefined,
        selectedTeam !== 'all' ? parseInt(selectedTeam) : undefined
      );
      setDraftHistory(history);
    } catch (error) {
      console.error('Error loading draft history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load draft history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = draftHistory.filter(pick => {
    const matchesSearch = searchTerm === '' || 
      pick.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pick.team_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPosition = selectedPosition === 'all' || pick.position === selectedPosition;
    
    return matchesSearch && matchesPosition;
  });

  const calculateDraftStats = () => {
    if (filteredHistory.length === 0) return null;

    const totalPicks = filteredHistory.length;
    const stillOwned = filteredHistory.filter(pick => pick.still_owned).length;
    const retentionRate = (stillOwned / totalPicks) * 100;

    const positionBreakdown = filteredHistory.reduce((acc, pick) => {
      acc[pick.position] = (acc[pick.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const roundBreakdown = filteredHistory.reduce((acc, pick) => {
      acc[pick.round] = (acc[pick.round] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const teamBreakdown = filteredHistory.reduce((acc, pick) => {
      acc[pick.team_name] = (acc[pick.team_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPicks,
      stillOwned,
      retentionRate,
      positionBreakdown,
      roundBreakdown,
      teamBreakdown
    };
  };

  const stats = calculateDraftStats();
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Draft History Analyzer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search players or teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedConference} onValueChange={setSelectedConference}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Conference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conferences</SelectItem>
                {conferences.map((conference) => (
                  <SelectItem key={conference.id} value={conference.id.toString()}>
                    {conference.conference_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                {positions.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={loadDraftHistory}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Total Picks</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalPicks}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Still Owned</span>
                </div>
                <div className="text-2xl font-bold">{stats.stillOwned}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">Retention Rate</span>
                </div>
                <div className="text-2xl font-bold">{stats.retentionRate.toFixed(1)}%</div>
                <Progress value={stats.retentionRate} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="picks" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="picks">Draft Picks</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="success">Success Rate</TabsTrigger>
          </TabsList>

          <TabsContent value="picks" className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Season</TableHead>
                    <TableHead>Conference</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Pick</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Current Team</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4">
                        Loading draft history...
                      </TableCell>
                    </TableRow>
                  ) : filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4">
                        No draft picks found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((pick, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline">{pick.season_year}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{pick.conference_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{pick.round}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{pick.pick_number}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{pick.player_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pick.position}</Badge>
                        </TableCell>
                        <TableCell>{pick.team_name}</TableCell>
                        <TableCell>{pick.current_team || 'Free Agent'}</TableCell>
                        <TableCell>
                          <Badge 
                            className={pick.still_owned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {pick.still_owned ? 'Owned' : 'Released'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Position Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.positionBreakdown).map(([position, count]) => (
                        <div key={position} className="flex justify-between items-center">
                          <span className="font-medium">{position}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{ width: `${(count / stats.totalPicks) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Round Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.roundBreakdown).map(([round, count]) => (
                        <div key={round} className="flex justify-between items-center">
                          <span className="font-medium">Round {round}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ width: `${(count / stats.totalPicks) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="success" className="space-y-4">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Retention by Position</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.positionBreakdown).map(([position, count]) => {
                        const retained = filteredHistory.filter(pick => 
                          pick.position === position && pick.still_owned
                        ).length;
                        const retentionRate = (retained / count) * 100;
                        
                        return (
                          <div key={position} className="flex justify-between items-center">
                            <span className="font-medium">{position}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-yellow-500 h-2 rounded-full" 
                                  style={{ width: `${retentionRate}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">
                                {retentionRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Retention by Round</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.roundBreakdown).map(([round, count]) => {
                        const retained = filteredHistory.filter(pick => 
                          pick.round === parseInt(round) && pick.still_owned
                        ).length;
                        const retentionRate = (retained / count) * 100;
                        
                        return (
                          <div key={round} className="flex justify-between items-center">
                            <span className="font-medium">Round {round}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-purple-500 h-2 rounded-full" 
                                  style={{ width: `${retentionRate}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">
                                {retentionRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DraftHistoryAnalyzer;
