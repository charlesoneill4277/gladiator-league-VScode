import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { UserCheck, Search, ArrowUpDown, ExternalLink, Filter } from 'lucide-react';

// Mock data for players - this will be replaced with real Sleeper API data
const mockPlayersData = [
{
  id: 'player1',
  name: 'Josh Allen',
  position: 'QB',
  nflTeam: 'BUF',
  points: 287.5,
  avgPoints: 22.1,
  status: 'rostered',
  rosteredBy: 'Galactic Gladiators',
  rosteredByOwner: 'John Doe',
  injuryStatus: null,
  gamesPlayed: 13,
  projectedPoints: 24.8
},
{
  id: 'player2',
  name: 'Christian McCaffrey',
  position: 'RB',
  nflTeam: 'SF',
  points: 245.8,
  avgPoints: 18.9,
  status: 'rostered',
  rosteredBy: 'Galactic Gladiators',
  rosteredByOwner: 'John Doe',
  injuryStatus: 'IR',
  gamesPlayed: 13,
  projectedPoints: 0
},
{
  id: 'player3',
  name: 'Tyreek Hill',
  position: 'WR',
  nflTeam: 'MIA',
  points: 198.2,
  avgPoints: 15.2,
  status: 'rostered',
  rosteredBy: 'Space Vikings',
  rosteredByOwner: 'Jane Smith',
  injuryStatus: null,
  gamesPlayed: 13,
  projectedPoints: 16.4
},
{
  id: 'player4',
  name: 'Saquon Barkley',
  position: 'RB',
  nflTeam: 'PHI',
  points: 234.6,
  avgPoints: 18.0,
  status: 'free_agent',
  rosteredBy: null,
  rosteredByOwner: null,
  injuryStatus: null,
  gamesPlayed: 13,
  projectedPoints: 18.5
},
{
  id: 'player5',
  name: 'Cooper Kupp',
  position: 'WR',
  nflTeam: 'LAR',
  points: 156.8,
  avgPoints: 14.2,
  status: 'rostered',
  rosteredBy: 'Meteor Crushers',
  rosteredByOwner: 'Bob Johnson',
  injuryStatus: 'Q',
  gamesPlayed: 11,
  projectedPoints: 15.8
},
{
  id: 'player6',
  name: 'Travis Kelce',
  position: 'TE',
  nflTeam: 'KC',
  points: 189.4,
  avgPoints: 14.6,
  status: 'rostered',
  rosteredBy: 'Nebula Warriors',
  rosteredByOwner: 'Sarah Wilson',
  injuryStatus: null,
  gamesPlayed: 13,
  projectedPoints: 15.2
},
{
  id: 'player7',
  name: 'Myles Garrett',
  position: 'DL',
  nflTeam: 'CLE',
  points: 98.5,
  avgPoints: 7.6,
  status: 'rostered',
  rosteredBy: 'Cosmic Defenders',
  rosteredByOwner: 'Mike Davis',
  injuryStatus: null,
  gamesPlayed: 13,
  projectedPoints: 8.1
},
{
  id: 'player8',
  name: 'Micah Parsons',
  position: 'LB',
  nflTeam: 'DAL',
  points: 112.8,
  avgPoints: 8.7,
  status: 'rostered',
  rosteredBy: 'Star Destroyers',
  rosteredByOwner: 'Lisa Brown',
  injuryStatus: null,
  gamesPlayed: 13,
  projectedPoints: 9.2
},
{
  id: 'player9',
  name: 'Trevon Diggs',
  position: 'DB',
  nflTeam: 'DAL',
  points: 87.3,
  avgPoints: 6.7,
  status: 'free_agent',
  rosteredBy: null,
  rosteredByOwner: null,
  injuryStatus: null,
  gamesPlayed: 13,
  projectedPoints: 7.1
}
// Add more mock players...
];

const PlayersPage: React.FC = () => {
  const { selectedSeason, selectedConference } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{key: string;direction: 'asc' | 'desc';} | null>(null);

  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];
  const offensePositions = ['QB', 'RB', 'WR', 'TE'];
  const defensePositions = ['DEF', 'DL', 'LB', 'DB'];

  // Filter players based on search term and filters
  const filteredPlayers = mockPlayersData.filter((player) => {
    const searchMatch = searchTerm === '' ||
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.nflTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.rosteredBy && player.rosteredBy.toLowerCase().includes(searchTerm.toLowerCase());

    const positionMatch = positionFilter === 'all' || 
      player.position === positionFilter ||
      (positionFilter === 'offense' && offensePositions.includes(player.position)) ||
      (positionFilter === 'defense' && defensePositions.includes(player.position));
    const statusMatch = statusFilter === 'all' || player.status === statusFilter;

    return searchMatch && positionMatch && statusMatch;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPlayers = React.useMemo(() => {
    let sortablePlayers = [...filteredPlayers];
    if (sortConfig !== null) {
      sortablePlayers.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key];
        const bValue = (b as any)[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortablePlayers;
  }, [filteredPlayers, sortConfig]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB':return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR':return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE':return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'K':return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'DEF':return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'DL':return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'LB':return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'DB':return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      default:return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusBadge = (status: string, injuryStatus: string | null) => {
    if (injuryStatus) {
      const variants: {[key: string]: string;} = {
        'IR': 'destructive',
        'O': 'destructive',
        'D': 'destructive',
        'Q': 'secondary',
        'P': 'outline'
      };
      return <Badge variant={variants[injuryStatus] || 'outline'} className="text-xs">{injuryStatus}</Badge>;
    }

    return status === 'free_agent' ?
    <Badge variant="outline" className="text-xs">FA</Badge> :
    <Badge variant="secondary" className="text-xs">Rostered</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Players</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {sortedPlayers.length} players
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players, teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10" />

        </div>

        {/* Position Filter */}
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Positions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="offense">All Offense (QB, RB, WR, TE)</SelectItem>
            <SelectItem value="defense">All Defense (DEF, DL, LB, DB)</SelectItem>
            {positions.map((pos) =>
            <SelectItem key={pos} value={pos}>{pos}</SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="rostered">Rostered</SelectItem>
            <SelectItem value="free_agent">Free Agent</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        <Button
          variant="outline"
          onClick={() => {
            setSearchTerm('');
            setPositionFilter('all');
            setStatusFilter('all');
          }}
          className="flex items-center space-x-2">

          <Filter className="h-4 w-4" />
          <span>Clear Filters</span>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Players</CardDescription>
            <CardTitle className="text-2xl">{sortedPlayers.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Free Agents</CardDescription>
            <CardTitle className="text-2xl">
              {sortedPlayers.filter((p) => p.status === 'free_agent').length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Injured Players</CardDescription>
            <CardTitle className="text-2xl">
              {sortedPlayers.filter((p) => p.injuryStatus).length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Points/Game</CardDescription>
            <CardTitle className="text-2xl">
              {sortedPlayers.length > 0 ?
              (sortedPlayers.reduce((sum, p) => sum + p.avgPoints, 0) / sortedPlayers.length).toFixed(1) :
              '0.0'
              }
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Players Table */}
      <Card>
        <CardHeader>
          <CardTitle>Player Database</CardTitle>
          <CardDescription>
            Click column headers to sort. Click player names for detailed stats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('name')}>
                      Player <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('position')}>
                      Pos <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">NFL Team</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('points')}>
                      Points <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('avgPoints')}>
                      Avg <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Rostered By</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player) =>
                <TableRow key={player.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-muted-foreground sm:hidden">
                        {player.nflTeam}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPositionColor(player.position)}>
                        {player.position}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{player.nflTeam}</TableCell>
                    <TableCell className="text-right font-mono">
                      {player.points.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      {player.avgPoints.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(player.status, player.injuryStatus)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {player.rosteredBy ?
                    <div>
                          <div className="text-sm font-medium">{player.rosteredBy}</div>
                          <div className="text-xs text-muted-foreground">{player.rosteredByOwner}</div>
                        </div> :

                    <span className="text-muted-foreground text-sm">Free Agent</span>
                    }
                    </TableCell>
                    <TableCell>
                      <Link to={`/players/${player.id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {sortedPlayers.length === 0 &&
          <div className="text-center py-8">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No players found</h3>
              <p className="text-muted-foreground">
                No players match your current search criteria.
              </p>
            </div>
          }
        </CardContent>
      </Card>
    </div>);

};

export default PlayersPage;