import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp } from '@/contexts/AppContext';
import { Search, Filter, User, Users, Heart, Activity, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PlayerDetailModal from '@/components/PlayerDetailModal';

interface Player {
  id: number;
  player_name: string;
  position: string;
  nfl_team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
  age: number;
  height: string;
  weight: number;
  years_experience: number;
  depth_chart_position: number;
  college: string;
  team_id: number;
  sleeper_player_id: string;
}

const PlayersPage: React.FC = () => {
  const { selectedSeason, selectedConference } = useApp();
  const { toast } = useToast();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [nflTeamFilter, setNflTeamFilter] = useState<string>('all');
  const [weekFilter, setWeekFilter] = useState<string>('14'); // Default to current week
  const [freeAgentFilter, setFreeAgentFilter] = useState(false);
  const [rookieFilter, setRookieFilter] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // NFL teams for the filter dropdown
  const nflTeams = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
    'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
    'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB',
    'TEN', 'WSH'
  ];

  // Weeks for the filter dropdown
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const response = await window.ezsite.apis.tablePage(12870, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'player_name',
        IsAsc: true,
        Filters: [
          {
            name: 'status',
            op: 'Equal',
            value: 'Active'
          }
        ]
      });

      if (response.error) {
        throw response.error;
      }

      // Filter for offensive positions only (QB, RB, WR, TE)
      const offensivePlayers = response.data.List.filter((player: Player) => 
        ['QB', 'RB', 'WR', 'TE'].includes(player.position)
      );

      setPlayers(offensivePlayers);
    } catch (error) {
      console.error('Error fetching players:', error);
      toast({
        title: 'Error',
        description: 'Failed to load players. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      // Search filter
      const searchMatch = searchTerm === '' ||
        player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.nfl_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.college.toLowerCase().includes(searchTerm.toLowerCase());

      // NFL team filter
      const nflTeamMatch = nflTeamFilter === 'all' || player.nfl_team === nflTeamFilter;

      // Free agent filter
      const freeAgentMatch = !freeAgentFilter || player.team_id === 0;

      // Rookie filter
      const rookieMatch = !rookieFilter || player.years_experience <= 1;

      return searchMatch && nflTeamMatch && freeAgentMatch && rookieMatch;
    });
  }, [players, searchTerm, nflTeamFilter, freeAgentFilter, rookieFilter]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getInjuryStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Questionable': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Doubtful': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Out': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'IR': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setNflTeamFilter('all');
    setWeekFilter('14');
    setFreeAgentFilter(false);
    setRookieFilter(false);
  };

  const freeAgents = filteredPlayers.filter(p => p.team_id === 0);
  const rookies = filteredPlayers.filter(p => p.years_experience <= 1);
  const injuredPlayers = filteredPlayers.filter(p => p.injury_status !== 'Healthy');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <User className="h-6 w-6 text-primary animate-pulse" />
          <h1 className="text-3xl font-bold">Loading Players...</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Players</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {weekFilter} • {filteredPlayers.length} players
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Search and dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players, teams, college..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* NFL Team Filter */}
          <Select value={nflTeamFilter} onValueChange={setNflTeamFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All NFL Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All NFL Teams</SelectItem>
              {nflTeams.map((team) => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Week Filter */}
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select Week" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Checkboxes and Clear Button */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="freeAgent"
              checked={freeAgentFilter}
              onCheckedChange={setFreeAgentFilter}
            />
            <label htmlFor="freeAgent" className="text-sm font-medium">
              Free Agents Only
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rookie"
              checked={rookieFilter}
              onCheckedChange={setRookieFilter}
            />
            <label htmlFor="rookie" className="text-sm font-medium">
              Rookies Only
            </label>
          </div>

          <Button variant="outline" onClick={clearFilters} className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Clear Filters</span>
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>Total Players</span>
            </CardDescription>
            <CardTitle className="text-2xl">{filteredPlayers.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span>Free Agents</span>
            </CardDescription>
            <CardTitle className="text-2xl">{freeAgents.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <Activity className="h-4 w-4" />
              <span>Rookies</span>
            </CardDescription>
            <CardTitle className="text-2xl">{rookies.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center space-x-1">
              <Heart className="h-4 w-4" />
              <span>Injured</span>
            </CardDescription>
            <CardTitle className="text-2xl">{injuredPlayers.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Players Grid */}
      {filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map((player) => (
            <Card 
              key={player.id} 
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handlePlayerClick(player)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Player Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                        {player.player_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {player.nfl_team} • #{player.jersey_number}
                      </p>
                    </div>
                    <Badge className={getPositionColor(player.position)} variant="secondary">
                      {player.position}
                    </Badge>
                  </div>

                  {/* Player Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Age:</span>
                      <span>{player.age}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Experience:</span>
                      <span>{player.years_experience} yr{player.years_experience !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">College:</span>
                      <span className="truncate ml-2">{player.college}</span>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-1">
                    <Badge 
                      className={getInjuryStatusColor(player.injury_status)} 
                      variant="outline"
                      size="sm"
                    >
                      {player.injury_status}
                    </Badge>
                    {player.team_id === 0 && (
                      <Badge variant="outline" size="sm" className="bg-green-100 text-green-800">
                        FA
                      </Badge>
                    )}
                    {player.years_experience <= 1 && (
                      <Badge variant="outline" size="sm" className="bg-purple-100 text-purple-800">
                        ROO
                      </Badge>
                    )}
                    {player.depth_chart_position === 1 && (
                      <Badge variant="outline" size="sm" className="bg-blue-100 text-blue-800">
                        ST
                      </Badge>
                    )}
                  </div>

                  {/* Week Info */}
                  <div className="pt-2 border-t border-muted/20">
                    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Week {weekFilter} vs Opponent</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No players found</h3>
          <p className="text-muted-foreground mb-4">
            No players match your current search criteria.
          </p>
          <Button onClick={clearFilters} variant="outline">
            Clear all filters
          </Button>
        </div>
      )}

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayer}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPlayer(null);
        }}
      />
    </div>
  );
};

export default PlayersPage;