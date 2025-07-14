import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Trophy, Target, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import HistoricalDataService, { HistoricalPerformanceMetric } from '../../services/historicalDataService';

interface HistoricalPerformanceMetricsProps {
  teamId?: number;
  conferenceId?: number;
}

const HistoricalPerformanceMetrics: React.FC<HistoricalPerformanceMetricsProps> = ({
  teamId,
  conferenceId
}) => {
  const [performanceMetrics, setPerformanceMetrics] = useState<HistoricalPerformanceMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>(teamId?.toString() || 'all');
  const [selectedConference, setSelectedConference] = useState<string>(conferenceId?.toString() || 'all');
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);
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
    loadPerformanceMetrics();
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

  const loadPerformanceMetrics = async () => {
    try {
      setLoading(true);
      const metrics = await historicalDataService.getHistoricalPerformanceMetrics(
        selectedTeam !== 'all' ? parseInt(selectedTeam) : undefined,
        selectedSeasons.length > 0 ? selectedSeasons : undefined,
        selectedConference !== 'all' ? parseInt(selectedConference) : undefined
      );
      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error('Error loading performance metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load performance metrics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = (metric: keyof HistoricalPerformanceMetric) => {
    const data = performanceMetrics.reduce((acc, curr) => {
      const existing = acc.find(item => item.season_year === curr.season_year);
      if (existing) {
        existing[curr.team_name] = curr[metric];
      } else {
        acc.push({
          season_year: curr.season_year,
          [curr.team_name]: curr[metric]
        });
      }
      return acc;
    }, [] as any[]);

    return data.sort((a, b) => a.season_year - b.season_year);
  };

  const getTeamColors = () => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
    const uniqueTeams = [...new Set(performanceMetrics.map(m => m.team_name))];
    return uniqueTeams.reduce((acc, team, index) => {
      acc[team] = colors[index % colors.length];
      return acc;
    }, {} as Record<string, string>);
  };

  const calculateAverages = () => {
    if (performanceMetrics.length === 0) return null;

    const totalMetrics = performanceMetrics.length;
    const averages = {
      wins: performanceMetrics.reduce((sum, m) => sum + m.wins, 0) / totalMetrics,
      losses: performanceMetrics.reduce((sum, m) => sum + m.losses, 0) / totalMetrics,
      points_for: performanceMetrics.reduce((sum, m) => sum + m.points_for, 0) / totalMetrics,
      points_against: performanceMetrics.reduce((sum, m) => sum + m.points_against, 0) / totalMetrics,
      win_percentage: performanceMetrics.reduce((sum, m) => sum + m.win_percentage, 0) / totalMetrics
    };

    const championships = performanceMetrics.filter(m => m.is_conference_champion).length;
    const playoffAppearances = performanceMetrics.filter(m => m.playoff_eligible).length;

    return { ...averages, championships, playoffAppearances };
  };

  const teamColors = getTeamColors();
  const uniqueTeams = [...new Set(performanceMetrics.map(m => m.team_name))];
  const averages = calculateAverages();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Historical Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
          <Button
            variant="outline"
            onClick={loadPerformanceMetrics}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {averages && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">Championships</span>
                </div>
                <div className="text-2xl font-bold">{averages.championships}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Playoff Apps</span>
                </div>
                <div className="text-2xl font-bold">{averages.playoffAppearances}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Avg Win %</span>
                </div>
                <div className="text-2xl font-bold">{(averages.win_percentage * 100).toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Avg Points</span>
                </div>
                <div className="text-2xl font-bold">{averages.points_for.toFixed(1)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="wins" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="wins">Wins</TabsTrigger>
            <TabsTrigger value="points">Points</TabsTrigger>
            <TabsTrigger value="percentage">Win %</TabsTrigger>
            <TabsTrigger value="rankings">Rankings</TabsTrigger>
          </TabsList>

          <TabsContent value="wins" className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prepareChartData('wins')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="season_year" />
                  <YAxis />
                  <Tooltip />
                  {uniqueTeams.map((team) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={teamColors[team]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="points" className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prepareChartData('points_for')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="season_year" />
                  <YAxis />
                  <Tooltip />
                  {uniqueTeams.map((team) => (
                    <Bar
                      key={team}
                      dataKey={team}
                      fill={teamColors[team]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="percentage" className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prepareChartData('win_percentage')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="season_year" />
                  <YAxis domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(value) => `${((value as number) * 100).toFixed(1)}%`} />
                  {uniqueTeams.map((team) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={teamColors[team]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="rankings" className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prepareChartData('overall_rank')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="season_year" />
                  <YAxis reversed domain={[1, 36]} />
                  <Tooltip />
                  {uniqueTeams.map((team) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={teamColors[team]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading performance metrics...</p>
          </div>
        )}

        {!loading && performanceMetrics.length === 0 && (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No performance metrics found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoricalPerformanceMetrics;
