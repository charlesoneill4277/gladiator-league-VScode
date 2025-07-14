import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Calendar, Search, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import HistoricalDataService from '../../services/historicalDataService';

interface RosterChange {
  id: number;
  week: number;
  player_name: string;
  position: string;
  action_type: string;
  team_name: string;
  from_team?: string;
  to_team?: string;
  transaction_date: string;
  faab_cost?: number;
  season_year: number;
}

interface HistoricalRosterTrackerProps {
  teamId?: number;
  playerId?: number;
  seasonId?: number;
}

const HistoricalRosterTracker: React.FC<HistoricalRosterTrackerProps> = ({
  teamId,
  playerId,
  seasonId
}) => {
  const [rosterChanges, setRosterChanges] = useState<RosterChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [seasons, setSeasons] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>(teamId?.toString() || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const { toast } = useToast();

  const historicalDataService = HistoricalDataService.getInstance();

  const actionTypeColors = {
    'add': 'bg-green-100 text-green-800',
    'drop': 'bg-red-100 text-red-800',
    'trade': 'bg-blue-100 text-blue-800',
    'waiver_claim': 'bg-purple-100 text-purple-800',
    'free_agent_pickup': 'bg-yellow-100 text-yellow-800'
  };

  const actionTypeIcons = {
    'add': <TrendingUp className="w-4 h-4" />,
    'drop': <TrendingDown className="w-4 h-4" />,
    'trade': <Filter className="w-4 h-4" />,
    'waiver_claim': <Calendar className="w-4 h-4" />,
    'free_agent_pickup': <Search className="w-4 h-4" />
  };

  useEffect(() => {
    loadSeasons();
    loadTeams();
  }, []);

  useEffect(() => {
    loadRosterChanges();
  }, [selectedSeason, selectedActionType, selectedTeam, currentPage]);

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

  const loadRosterChanges = async () => {
    try {
      setLoading(true);
      
      const filters = [];
      
      if (selectedSeason !== 'all') {
        filters.push({ name: 'season_id', op: 'Equal', value: parseInt(selectedSeason) });
      }
      
      if (selectedActionType !== 'all') {
        filters.push({ name: 'action_type', op: 'Equal', value: selectedActionType });
      }
      
      if (selectedTeam !== 'all') {
        filters.push({ name: 'team_id', op: 'Equal', value: parseInt(selectedTeam) });
      }
      
      if (playerId) {
        filters.push({ name: 'player_id', op: 'Equal', value: playerId });
      }

      const response = await window.ezsite.apis.tablePage(27936, {
        PageNo: currentPage,
        PageSize: pageSize,
        OrderByField: 'transaction_date',
        IsAsc: false,
        Filters: filters
      });

      if (response.error) throw response.error;

      // Transform data to include player, team, and season information
      const transformedChanges: RosterChange[] = [];
      
      for (const change of response.data.List) {
        // Get player information
        const playerResponse = await window.ezsite.apis.tablePage(12870, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: change.player_id }]
        });

        // Get team information
        const teamResponse = await window.ezsite.apis.tablePage(12852, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: change.team_id }]
        });

        // Get season information
        const seasonResponse = await window.ezsite.apis.tablePage(12818, {
          PageNo: 1,
          PageSize: 1,
          Filters: [{ name: 'id', op: 'Equal', value: change.season_id }]
        });

        // Get from/to team information if applicable
        let fromTeam = '';
        let toTeam = '';
        
        if (change.from_team_id) {
          const fromTeamResponse = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: change.from_team_id }]
          });
          fromTeam = fromTeamResponse.data.List[0]?.team_name || '';
        }

        if (change.to_team_id) {
          const toTeamResponse = await window.ezsite.apis.tablePage(12852, {
            PageNo: 1,
            PageSize: 1,
            Filters: [{ name: 'id', op: 'Equal', value: change.to_team_id }]
          });
          toTeam = toTeamResponse.data.List[0]?.team_name || '';
        }

        const player = playerResponse.data.List[0];
        const team = teamResponse.data.List[0];
        const season = seasonResponse.data.List[0];

        transformedChanges.push({
          id: change.id,
          week: change.week,
          player_name: player?.player_name || '',
          position: player?.position || '',
          action_type: change.action_type,
          team_name: team?.team_name || '',
          from_team: fromTeam,
          to_team: toTeam,
          transaction_date: change.transaction_date,
          faab_cost: change.faab_cost,
          season_year: season?.season_year || 0
        });
      }

      setRosterChanges(transformedChanges);
    } catch (error) {
      console.error('Error loading roster changes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load roster changes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredChanges = rosterChanges.filter(change =>
    searchTerm === '' || 
    change.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    change.team_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getActionDescription = (change: RosterChange) => {
    switch (change.action_type) {
      case 'trade':
        return `${change.from_team} → ${change.to_team}`;
      case 'add':
        return 'Added to roster';
      case 'drop':
        return 'Dropped from roster';
      case 'waiver_claim':
        return `Claimed via waivers${change.faab_cost ? ` ($${change.faab_cost})` : ''}`;
      case 'free_agent_pickup':
        return 'Picked up as free agent';
      default:
        return change.action_type;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Historical Roster Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search players or teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Seasons</SelectItem>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id.toString()}>
                  {season.season_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedActionType} onValueChange={setSelectedActionType}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="add">Add</SelectItem>
              <SelectItem value="drop">Drop</SelectItem>
              <SelectItem value="trade">Trade</SelectItem>
              <SelectItem value="waiver_claim">Waiver Claim</SelectItem>
              <SelectItem value="free_agent_pickup">Free Agent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Team" />
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
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    Loading roster changes...
                  </TableCell>
                </TableRow>
              ) : filteredChanges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    No roster changes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredChanges.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell className="font-mono text-sm">
                      {formatDate(change.transaction_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{change.season_year}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Week {change.week}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{change.player_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{change.position}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={`${actionTypeColors[change.action_type as keyof typeof actionTypeColors] || 'bg-gray-100 text-gray-800'} flex items-center gap-1`}
                      >
                        {actionTypeIcons[change.action_type as keyof typeof actionTypeIcons]}
                        {change.action_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{change.team_name}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {getActionDescription(change)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500">
            Showing {filteredChanges.length} roster changes
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={filteredChanges.length < pageSize}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricalRosterTracker;
