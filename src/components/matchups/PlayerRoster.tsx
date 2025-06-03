import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayerInfo } from '@/services/matchupService';
import { User, TrendingUp, AlertTriangle, Minus } from 'lucide-react';

interface PlayerRosterProps {
  teamName: string;
  starters: PlayerInfo[];
  bench: PlayerInfo[];
  totalScore: number;
  projectedScore: number;
}

const PlayerRoster: React.FC<PlayerRosterProps> = ({
  teamName,
  starters,
  bench,
  totalScore,
  projectedScore
}) => {
  const getPositionBadgeColor = (position: string) => {
    switch (position) {
      case 'QB':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'RB':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'WR':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'TE':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      case 'K':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'DEF':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getInjuryStatusIcon = (status: string) => {
    switch (status) {
      case 'Questionable':
      case 'Doubtful':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'Out':
      case 'IR':
        return <Minus className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const PlayerRow: React.FC<{ player: PlayerInfo; isStarter: boolean; positionSlot?: string }> = ({ 
    player, 
    isStarter, 
    positionSlot 
  }) => (
    <div className={`flex items-center justify-between p-2 rounded-lg ${
      isStarter ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
    }`}>
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex items-center space-x-2">
          <Badge className={getPositionBadgeColor(player.position)} variant="secondary">
            {positionSlot || player.position}
          </Badge>
          {getInjuryStatusIcon(player.injury_status)}
        </div>
        
        <div className="flex-1">
          <div className="font-medium text-sm">{player.name}</div>
          <div className="text-xs text-muted-foreground">
            {player.nfl_team} • {player.position}
            {player.injury_status !== 'Healthy' && (
              <span className="ml-1 text-yellow-600">({player.injury_status})</span>
            )}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="font-semibold text-sm">
          {player.points > 0 ? player.points.toFixed(1) : '--'}
        </div>
        {player.projected > 0 && (
          <div className="text-xs text-muted-foreground">
            Proj: {player.projected.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );

  // Starting lineup positions in order
  const startingPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'WRT', 'WRTQ'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>{teamName}</span>
          </CardTitle>
          <div className="text-right">
            <div className="font-bold text-lg">{totalScore > 0 ? totalScore.toFixed(1) : '--'}</div>
            {projectedScore > 0 && (
              <div className="text-xs text-muted-foreground">
                Proj: {projectedScore.toFixed(1)}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Starting Lineup */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <h4 className="font-medium text-sm">Starters ({starters.length})</h4>
          </div>
          
          <div className="space-y-1">
            {startingPositions.map((position, index) => {
              const player = starters[index];
              return player ? (
                <PlayerRow 
                  key={`starter-${index}`}
                  player={player}
                  isStarter={true}
                  positionSlot={position}
                />
              ) : (
                <div key={`empty-${index}`} className="flex items-center justify-between p-2 rounded-lg border border-dashed border-gray-300">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="bg-gray-100">
                      {position}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Empty</span>
                  </div>
                  <div className="text-sm text-muted-foreground">--</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <User className="h-4 w-4 text-gray-600" />
              <h4 className="font-medium text-sm">Bench ({bench.length})</h4>
            </div>
            
            <div className="space-y-1">
              {bench.map((player, index) => (
                <PlayerRow 
                  key={`bench-${index}`}
                  player={player}
                  isStarter={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Team Summary */}
        <div className="border-t pt-3 mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Active Players</div>
              <div className="font-semibold">{starters.length + bench.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Points vs Proj</div>
              <div className="font-semibold">
                {totalScore > 0 && projectedScore > 0 
                  ? (totalScore - projectedScore > 0 ? '+' : '') + (totalScore - projectedScore).toFixed(1)
                  : '--'
                }
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerRoster;