import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TeamRosterData, PlayerData } from '@/services/matchupDataService';
import { Users, Star, User } from 'lucide-react';

interface TeamRosterCardProps {
  teamName: string;
  ownerName: string;
  rosterData: TeamRosterData;
  isExpanded?: boolean;
}

const TeamRosterCard: React.FC<TeamRosterCardProps> = ({
  teamName,
  ownerName,
  rosterData,
  isExpanded = false
}) => {
  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'RB':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'WR':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'TE':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'K':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DEF':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const PlayerRow: React.FC<{ player: PlayerData; showPoints?: boolean }> = ({ 
    player, 
    showPoints = true 
  }) => (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex items-center space-x-2">
          {player.isStarter && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
          <Badge 
            variant="outline" 
            className={`text-xs px-2 py-0 ${getPositionColor(player.position)}`}
          >
            {player.position}
          </Badge>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {player.playerName}
          </div>
          {player.nflTeam && (
            <div className="text-xs text-muted-foreground">
              {player.nflTeam}
            </div>
          )}
        </div>
      </div>
      {showPoints && (
        <div className="text-right">
          <div className="font-semibold text-sm">
            {player.points?.toFixed(1) || '0.0'}
          </div>
          <div className="text-xs text-muted-foreground">pts</div>
        </div>
      )}
    </div>
  );

  if (!isExpanded) {
    // Condensed view
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{teamName}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {rosterData.totalPoints.toFixed(1)} pts
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">{ownerName}</div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Starters</span>
              <span className="font-medium">{rosterData.starters.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Bench</span>
              <span className="font-medium">{rosterData.bench.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Expanded view
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{teamName}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {rosterData.totalPoints.toFixed(1)} pts
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">{ownerName}</div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Starters Section */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Star className="h-4 w-4 text-yellow-500" />
            <h4 className="font-semibold text-sm">Starters ({rosterData.starters.length})</h4>
          </div>
          <div className="space-y-1">
            {rosterData.starters.map((player, index) => (
              <PlayerRow key={`starter-${player.id}-${index}`} player={player} />
            ))}
          </div>
        </div>

        {rosterData.bench.length > 0 && (
          <>
            <Separator />
            {/* Bench Section */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Bench ({rosterData.bench.length})</h4>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {rosterData.bench.map((player, index) => (
                  <PlayerRow key={`bench-${player.id}-${index}`} player={player} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Team Summary */}
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <div className="font-semibold text-base">
              {rosterData.starters.reduce((sum, p) => sum + (p.points || 0), 0).toFixed(1)}
            </div>
            <div className="text-muted-foreground">Starter Points</div>
          </div>
          <div>
            <div className="font-semibold text-base">
              {rosterData.bench.reduce((sum, p) => sum + (p.points || 0), 0).toFixed(1)}
            </div>
            <div className="text-muted-foreground">Bench Points</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamRosterCard;