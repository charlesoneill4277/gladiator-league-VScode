import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { ArrowUpDown, Trophy, TrendingUp, TrendingDown } from 'lucide-react';

// Mock data for standings - this will be replaced with real Sleeper API data
const mockStandingsData = [
{
  id: '1',
  teamName: 'Galactic Gladiators',
  ownerName: 'John Doe',
  conference: 'Legions of Mars',
  rank: 1,
  wins: 11,
  losses: 2,
  ties: 0,
  pointsFor: 1485.2,
  pointsAgainst: 1289.5,
  pointsDiff: 195.7,
  streak: 'W5',
  avgPointsFor: 114.2
},
{
  id: '2',
  teamName: 'Space Vikings',
  ownerName: 'Jane Smith',
  conference: 'Guardians of Jupiter',
  rank: 2,
  wins: 10,
  losses: 3,
  ties: 0,
  pointsFor: 1442.8,
  pointsAgainst: 1321.4,
  pointsDiff: 121.4,
  streak: 'W3',
  avgPointsFor: 111.0
},
{
  id: '3',
  teamName: 'Meteor Crushers',
  ownerName: 'Bob Johnson',
  conference: "Vulcan's Oathsworn",
  rank: 3,
  wins: 9,
  losses: 4,
  ties: 0,
  pointsFor: 1398.6,
  pointsAgainst: 1356.2,
  pointsDiff: 42.4,
  streak: 'L1',
  avgPointsFor: 107.6
}
// Add more mock data...
];

const StandingsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const [sortConfig, setSortConfig] = useState<{key: string;direction: 'asc' | 'desc';} | null>(null);

  // Filter standings based on selected conference
  const filteredStandings = selectedConference ?
  mockStandingsData.filter((team) => {
    const conference = currentSeasonConfig.conferences.find((c) => c.id === selectedConference);
    return team.conference === conference?.name;
  }) :
  mockStandingsData;

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStandings = React.useMemo(() => {
    let sortableStandings = [...filteredStandings];
    if (sortConfig !== null) {
      sortableStandings.sort((a, b) => {
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
    return sortableStandings;
  }, [filteredStandings, sortConfig]);

  const getStreakIcon = (streak: string) => {
    if (streak.startsWith('W')) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (streak.startsWith('L')) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  const getRecordBadgeVariant = (wins: number, losses: number) => {
    const winPercentage = wins / (wins + losses);
    if (winPercentage >= 0.7) return 'default';
    if (winPercentage >= 0.5) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">League Standings</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          }
        </p>
      </div>

      {/* Standings Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Teams</CardDescription>
            <CardTitle className="text-2xl">{filteredStandings.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Highest Scoring Team</CardDescription>
            <CardTitle className="text-xl">
              {filteredStandings.length > 0 &&
              filteredStandings.reduce((prev, current) =>
              prev.pointsFor > current.pointsFor ? prev : current
              ).teamName
              }
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>League Average PPG</CardDescription>
            <CardTitle className="text-2xl">
              {filteredStandings.length > 0 &&
              (filteredStandings.reduce((sum, team) => sum + team.avgPointsFor, 0) / filteredStandings.length).toFixed(1)
              }
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Standings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Standings</CardTitle>
          <CardDescription>
            Click column headers to sort. Current standings for the {selectedSeason} season.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('rank')}>
                      Rank <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('teamName')}>
                      Team <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead className="hidden lg:table-cell">Conference</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('wins')}>
                      Record <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('pointsFor')}>
                      PF <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('pointsAgainst')}>
                      PA <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('pointsDiff')}>
                      Diff <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Streak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStandings.map((team, index) =>
                <TableRow key={team.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-1">
                        {team.rank === 1 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        <span>{team.rank}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{team.teamName}</div>
                      <div className="text-sm text-muted-foreground md:hidden">{team.ownerName}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{team.ownerName}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {team.conference}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRecordBadgeVariant(team.wins, team.losses)}>
                        {team.wins}-{team.losses}
                        {team.ties > 0 && `-${team.ties}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {team.pointsFor.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {team.pointsAgainst.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      <span className={team.pointsDiff > 0 ? 'text-green-600' : 'text-red-600'}>
                        {team.pointsDiff > 0 ? '+' : ''}{team.pointsDiff.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center space-x-1">
                        {getStreakIcon(team.streak)}
                        <span className="text-sm">{team.streak}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default StandingsPage;