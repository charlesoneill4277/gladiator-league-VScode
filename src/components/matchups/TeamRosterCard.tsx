import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TeamRosterData, PlayerWithPoints } from '@/services/matchupService';
import { User, Activity, Clock, AlertTriangle } from 'lucide-react';

interface TeamRosterCardProps {
  teamData: TeamRosterData;
  isLoading?: boolean;
}

const PlayerRow: React.FC<{ player: PlayerWithPoints }> = ({ player }) => {
  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'K': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'DEF': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'DST': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'UNK': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getInjuryStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'out':
      case 'ir':
        return 'text-red-600';
      case 'doubtful':
        return 'text-red-500';
      case 'questionable':
        return 'text-yellow-600';
      default:
        return 'text-green-600';
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex items-center space-x-2 flex-1">
          <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${getPositionColor(player.position)}`}>
            {player.isStarter && player.starterPosition ? player.starterPosition : player.position}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm truncate">
                {player.player_name || `Player ${player.sleeper_player_id}`}
              </span>
              {player.injury_status !== 'Healthy' && player.injury_status !== 'Unknown' && (
                <AlertTriangle className={`h-3 w-3 ${getInjuryStatusColor(player.injury_status)}`} />
              )}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {player.nfl_team && <span>{player.nfl_team}</span>}
              {player.jersey_number > 0 && (
                <>
                  <span>•</span>
                  <span>#{player.jersey_number}</span>
                </>
              )}
              {player.injury_status !== 'Healthy' && player.injury_status !== 'Unknown' && (
                <>
                  <span>•</span>
                  <span className={getInjuryStatusColor(player.injury_status)}>
                    {player.injury_status}
                  </span>
                </>
              )}
              {player.position === 'UNK' && (
                <>
                  <span>•</span>
                  <span className="text-orange-600">Missing Data</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-sm">
          {player.points > 0 ? player.points.toFixed(1) : '--'}
        </div>
        {player.points > 0 && (
          <div className="text-xs text-muted-foreground">pts</div>
        )}
      </div>
    </div>
  );
};

const TeamRosterCard: React.FC<TeamRosterCardProps> = ({ teamData, isLoading = false }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Loading Roster...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-12 h-5 bg-muted animate-pulse rounded"></div>
                  <div className="w-24 h-4 bg-muted animate-pulse rounded"></div>
                </div>
                <div className="w-8 h-4 bg-muted animate-pulse rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalStarterPoints = teamData.starters.reduce((sum, player) => sum + player.points, 0);
  const totalBenchPoints = teamData.bench.reduce((sum, player) => sum + player.points, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{teamData.teamName}</CardTitle>
          <div className="text-right">
            <div className="font-bold text-lg">{teamData.totalPoints.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Total Points</div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{teamData.ownerName}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Starters Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span className="font-medium text-sm">Starters</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {totalStarterPoints.toFixed(1)} pts
            </Badge>
          </div>
          <div className="space-y-1">
            {teamData.starters.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </div>
        </div>

        {/* Bench Section */}
        {teamData.bench.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium text-sm">Bench</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {totalBenchPoints.toFixed(1)} pts
                </Badge>
              </div>
              <div className="space-y-1">
                {teamData.bench.map((player) => (
                  <PlayerRow key={player.id} player={player} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Team Summary */}
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-center text-xs">
          <div>
            <div className="font-medium">{teamData.starters.length}</div>
            <div className="text-muted-foreground">Starters</div>
          </div>
          <div>
            <div className="font-medium">{teamData.bench.length}</div>
            <div className="text-muted-foreground">Bench</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamRosterCard;