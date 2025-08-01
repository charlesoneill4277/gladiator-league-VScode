import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

// Position color function to match consistent styling across the app
const getPositionColor = (position: string) => {
  switch (position) {
    case 'QB': return 'bg-red-100 text-red-800';
    case 'RB': return 'bg-green-100 text-green-800';
    case 'WR': return 'bg-blue-100 text-blue-800';
    case 'TE': return 'bg-yellow-100 text-yellow-800';
    case 'K': return 'bg-purple-100 text-purple-800';
    case 'DEF': return 'bg-gray-100 text-gray-800';
    case 'FLEX': return 'bg-orange-100 text-orange-800';
    case 'SUPER_FLEX': return 'bg-pink-100 text-pink-800';
    case 'SFLEX': return 'bg-pink-100 text-pink-800';
    case 'BENCH': return 'bg-slate-100 text-slate-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

interface PlayerCardProps {
  playerId: string;
  name: string;
  position: string;
  team: string;
  points: number;
  projected: number;
  status: 'playing' | 'played' | 'bye' | 'injured' | 'not_started';
  positionSlot: string;
  isStarter: boolean;
  gameTimeRemaining?: string;
  expandable?: boolean;
  onClick?: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  playerId,
  name,
  position,
  team,
  points,
  projected,
  status,
  positionSlot,
  isStarter,
  gameTimeRemaining,
  expandable = false,
  onClick
}) => {
  const variance = points - projected;
  // Don't show performance indicators for players who haven't started
  const shouldShowPerformance = status !== 'not_started';
  const isOutperforming = shouldShowPerformance && variance > 0;
  const isUnderperforming = shouldShowPerformance && variance < -2;

  const getStatusColor = () => {
    switch (status) {
      case 'playing':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'played':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'bye':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'injured':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'not_started':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPerformanceIcon = () => {
    if (isOutperforming) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (isUnderperforming) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    } else if (status === 'injured') {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  const cardClasses = `
    ${expandable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
    ${isStarter ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-gray-300'}
    ${isOutperforming ? 'bg-green-50' : isUnderperforming ? 'bg-red-50' : 'bg-white'}
  `;

  return (
    <Card className={cardClasses} onClick={expandable ? onClick : undefined}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Position Badge */}
            <Badge className={`text-xs shrink-0 ${getPositionColor(positionSlot)}`}>
              {positionSlot === 'FLEX' ? 'W/R/T' : 
               positionSlot === 'SUPER_FLEX' ? 'Q/W/R/T' :
               positionSlot === 'SFLEX' ? 'Q/W/R/T' :
               positionSlot}
            </Badge>
            
            {/* Player Info */}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{name}</div>
              <div className="text-xs text-muted-foreground">
                {position} - {team}
                {gameTimeRemaining && (
                  <span className="ml-2">• {gameTimeRemaining}</span>
                )}
              </div>
            </div>

            {/* Performance Icon */}
            <div className="shrink-0">
              {getPerformanceIcon()}
            </div>
          </div>
          
          {/* Points */}
          <div className="text-right shrink-0 ml-3">
            <div className={`font-bold text-sm ${
              isOutperforming ? 'text-green-600' : 
              isUnderperforming ? 'text-red-600' : ''
            }`}>
              {points.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">
              {projected.toFixed(1)}
            </div>
            {shouldShowPerformance && variance !== 0 && (
              <div className={`text-xs ${variance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {variance > 0 ? '+' : ''}{variance.toFixed(1)}
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-2">
          <Badge 
            variant="outline" 
            className={`text-xs ${getStatusColor()}`}
          >
            {status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerCard;