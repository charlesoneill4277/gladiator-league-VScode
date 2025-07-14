import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, UserCheck, Activity, AlertTriangle, Trophy, Clock } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  points: number;
  avgPoints: number;
  projectedPoints: number;
  status: string;
  rosteredBy: string | null;
  rosteredByOwner: string | null;
  injuryStatus: string | null;
  gamesPlayed: number;
  age?: number;
  draftPosition?: number;
  experience?: number;
  conference?: string;
  isOwnedByMultipleTeams?: boolean;
}

interface PlayerStatsCardsProps {
  players: Player[];
  totalCount: number;
  isLoading?: boolean;
  className?: string;
}

const PlayerStatsCards: React.FC<PlayerStatsCardsProps> = ({
  players,
  totalCount,
  isLoading = false,
  className = ''
}) => {
  // Calculate stats
  const stats = {
    totalPlayers: players.length,
    totalAvailable: totalCount,
    freeAgents: players.filter(p => p.status === 'free_agent').length,
    rosteredPlayers: players.filter(p => p.status === 'rostered').length,
    injuredPlayers: players.filter(p => p.injuryStatus && p.injuryStatus !== 'healthy').length,
    multiOwnedPlayers: players.filter(p => p.isOwnedByMultipleTeams).length,
    avgPoints: players.length > 0 ? 
      players.reduce((sum, p) => sum + (p.avgPoints || 0), 0) / players.length : 0,
    totalPoints: players.reduce((sum, p) => sum + (p.points || 0), 0),
    topScorer: players.sort((a, b) => (b.points || 0) - (a.points || 0))[0],
    positionBreakdown: players.reduce((acc, p) => {
      acc[p.position] = (acc[p.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  // Calculate availability percentage
  const availabilityPercentage = totalCount > 0 ? (stats.freeAgents / totalCount) * 100 : 0;

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {/* Total Players */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            Total Players
          </CardDescription>
          <CardTitle className="text-2xl">
            {stats.totalPlayers.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            of {stats.totalAvailable.toLocaleString()} available
          </div>
          <Progress 
            value={(stats.totalPlayers / stats.totalAvailable) * 100} 
            className="mt-2 h-2"
          />
        </CardContent>
      </Card>

      {/* Free Agents */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center">
            <UserCheck className="h-4 w-4 mr-1" />
            Free Agents
          </CardDescription>
          <CardTitle className="text-2xl">
            {stats.freeAgents.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            {availabilityPercentage.toFixed(1)}% available
          </div>
          <Progress 
            value={availabilityPercentage} 
            className="mt-2 h-2"
          />
        </CardContent>
      </Card>

      {/* Injured Players */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Injured Players
          </CardDescription>
          <CardTitle className="text-2xl">
            {stats.injuredPlayers.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            {((stats.injuredPlayers / stats.totalPlayers) * 100).toFixed(1)}% of filtered
          </div>
          {stats.multiOwnedPlayers > 0 && (
            <Badge variant="outline" className="mt-2 text-xs">
              {stats.multiOwnedPlayers} multi-owned
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Average Points */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center">
            <Activity className="h-4 w-4 mr-1" />
            Avg Points/Game
          </CardDescription>
          <CardTitle className="text-2xl">
            {stats.avgPoints.toFixed(1)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            {stats.totalPoints.toFixed(1)} total points
          </div>
          {stats.topScorer && (
            <div className="mt-1 text-xs text-muted-foreground">
              Top: {stats.topScorer.name} ({stats.topScorer.points?.toFixed(1)})
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Breakdown */}
      {Object.keys(stats.positionBreakdown).length > 0 && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <Trophy className="h-4 w-4 mr-1" />
              Position Breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-3">
              {Object.entries(stats.positionBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([position, count]) => (
                  <div key={position} className="text-center">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">{position}</div>
                    <div className="text-xs text-muted-foreground">
                      {((count / stats.totalPlayers) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlayerStatsCards;
