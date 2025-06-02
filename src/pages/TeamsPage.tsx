import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useApp } from '@/contexts/AppContext';
import { Users, Search, ExternalLink, Trophy, TrendingUp } from 'lucide-react';

// Mock data for teams - this will be replaced with real Sleeper API data
const mockTeamsData = [
{
  id: '1',
  teamName: 'Galactic Gladiators',
  ownerName: 'John Doe',
  ownerAvatar: null,
  conference: 'Legions of Mars',
  record: { wins: 11, losses: 2, ties: 0 },
  pointsFor: 1485.2,
  pointsAgainst: 1289.5,
  rank: 1,
  streak: 'W5',
  rosterCount: 16,
  waiversCount: 24,
  tradesCount: 3
},
{
  id: '2',
  teamName: 'Space Vikings',
  ownerName: 'Jane Smith',
  ownerAvatar: null,
  conference: 'Guardians of Jupiter',
  record: { wins: 10, losses: 3, ties: 0 },
  pointsFor: 1442.8,
  pointsAgainst: 1321.4,
  rank: 2,
  streak: 'W3',
  rosterCount: 15,
  waiversCount: 18,
  tradesCount: 1
},
{
  id: '3',
  teamName: 'Meteor Crushers',
  ownerName: 'Bob Johnson',
  ownerAvatar: null,
  conference: "Vulcan's Oathsworn",
  record: { wins: 9, losses: 4, ties: 0 },
  pointsFor: 1398.6,
  pointsAgainst: 1356.2,
  rank: 3,
  streak: 'L1',
  rosterCount: 16,
  waiversCount: 31,
  tradesCount: 5
},
{
  id: '4',
  teamName: 'Asteroid Miners',
  ownerName: 'Alice Brown',
  ownerAvatar: null,
  conference: 'Guardians of Jupiter',
  record: { wins: 8, losses: 5, ties: 0 },
  pointsFor: 1376.4,
  pointsAgainst: 1398.7,
  rank: 4,
  streak: 'W2',
  rosterCount: 15,
  waiversCount: 12,
  tradesCount: 2
},
{
  id: '5',
  teamName: 'Solar Flares',
  ownerName: 'Charlie Wilson',
  ownerAvatar: null,
  conference: "Vulcan's Oathsworn",
  record: { wins: 7, losses: 6, ties: 0 },
  pointsFor: 1298.8,
  pointsAgainst: 1345.1,
  rank: 5,
  streak: 'L2',
  rosterCount: 16,
  waiversCount: 22,
  tradesCount: 1
},
{
  id: '6',
  teamName: 'Nebula Nomads',
  ownerName: 'Diana Prince',
  ownerAvatar: null,
  conference: 'Legions of Mars',
  record: { wins: 6, losses: 7, ties: 0 },
  pointsFor: 1245.2,
  pointsAgainst: 1389.4,
  rank: 6,
  streak: 'W1',
  rosterCount: 14,
  waiversCount: 19,
  tradesCount: 0
}];


const TeamsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter teams based on selected conference and search term
  const filteredTeams = mockTeamsData.filter((team) => {
    const conferenceMatch = selectedConference ?
    team.conference === currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
    true;

    const searchMatch = searchTerm === '' ||
    team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.ownerName.toLowerCase().includes(searchTerm.toLowerCase());

    return conferenceMatch && searchMatch;
  });

  const getRecordBadgeVariant = (wins: number, losses: number) => {
    const winPercentage = wins / (wins + losses);
    if (winPercentage >= 0.7) return 'default';
    if (winPercentage >= 0.5) return 'secondary';
    return 'destructive';
  };

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) return 'text-green-600';
    if (streak.startsWith('L')) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Teams</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          } • {filteredTeams.length} teams
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams or owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10" />

        </div>
        <Button variant="outline" onClick={() => setSearchTerm('')}>
          Clear
        </Button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.map((team) =>
        <Card key={team.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={team.ownerAvatar || undefined} />
                    <AvatarFallback className="bg-primary/10">
                      {team.ownerName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg leading-tight">{team.teamName}</CardTitle>
                    <CardDescription>{team.ownerName}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {team.rank <= 3 && <Trophy className="h-4 w-4 text-yellow-500" />}
                  <span className="text-sm font-semibold">#{team.rank}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Conference Badge */}
              <Badge variant="outline" className="text-xs">
                {team.conference}
              </Badge>

              {/* Record and Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Record</p>
                  <Badge variant={getRecordBadgeVariant(team.record.wins, team.record.losses)}>
                    {team.record.wins}-{team.record.losses}
                    {team.record.ties > 0 && `-${team.record.ties}`}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Streak</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className={`h-4 w-4 ${getStreakColor(team.streak)}`} />
                    <span className={`font-semibold ${getStreakColor(team.streak)}`}>
                      {team.streak}
                    </span>
                  </div>
                </div>
              </div>

              {/* Points */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Points For</p>
                  <p className="font-semibold">{team.pointsFor.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Points Against</p>
                  <p className="font-semibold">{team.pointsAgainst.toFixed(1)}</p>
                </div>
              </div>

              {/* Team Activity */}
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium">{team.rosterCount}</p>
                  <p>Roster</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{team.waiversCount}</p>
                  <p>Waivers</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{team.tradesCount}</p>
                  <p>Trades</p>
                </div>
              </div>

              {/* View Team Button */}
              <Link to={`/teams/${team.id}`} className="w-full">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Team Details
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* No Results */}
      {filteredTeams.length === 0 &&
      <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams found</h3>
            <p className="text-muted-foreground mb-4">
              No teams match your current search criteria.
            </p>
            <Button variant="outline" onClick={() => setSearchTerm('')}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      }

      {/* Summary Stats */}
      {filteredTeams.length > 0 &&
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Points For</CardDescription>
              <CardTitle className="text-2xl">
                {(filteredTeams.reduce((sum, team) => sum + team.pointsFor, 0) / filteredTeams.length).toFixed(1)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Most Active Team</CardDescription>
              <CardTitle className="text-lg">
                {filteredTeams.reduce((prev, current) =>
              prev.waiversCount + prev.tradesCount > current.waiversCount + current.tradesCount ? prev : current
              ).teamName}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Trades</CardDescription>
              <CardTitle className="text-2xl">
                {filteredTeams.reduce((sum, team) => sum + team.tradesCount, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    </div>);

};

export default TeamsPage;