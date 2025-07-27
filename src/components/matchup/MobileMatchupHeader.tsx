import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Clock } from 'lucide-react';

interface MatchupTeam {
  id: number;
  name: string;
  owner: string;
  avatar?: string;
  record: { wins: number; losses: number };
  points: number;
  projectedPoints: number;
}

interface MobileMatchupHeaderProps {
  team1: MatchupTeam;
  team2?: MatchupTeam;
  status: 'live' | 'completed' | 'upcoming';
  week: number;
  winningTeam: MatchupTeam | null;
  gameTimeRemaining?: string;
  startTime?: Date;
  isBye: boolean;
}

const MobileMatchupHeader: React.FC<MobileMatchupHeaderProps> = ({
  team1,
  team2,
  status,
  week,
  winningTeam,
  gameTimeRemaining,
  startTime,
  isBye
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500 hover:bg-green-600">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          {getStatusBadge()}
          {gameTimeRemaining && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {gameTimeRemaining}
            </Badge>
          )}
        </div>
        {startTime && (
          <div className="text-xs text-muted-foreground text-center">
            {startTime.toLocaleDateString()} at {startTime.toLocaleTimeString()}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Team 1 */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={team1.avatar} />
              <AvatarFallback>{team1.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <div className={`font-bold ${winningTeam?.id === team1.id ? 'text-green-600' : ''}`}>
                {team1.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {team1.owner} • {team1.record.wins}-{team1.record.losses}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${winningTeam?.id === team1.id ? 'text-green-600' : ''}`}>
              {team1.points.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">
              Proj: {team1.projectedPoints.toFixed(1)}
            </div>
          </div>
        </div>

        {/* VS Divider */}
        <div className="text-center py-2">
          <div className="text-sm font-medium text-muted-foreground">VS</div>
          {status === 'completed' && winningTeam && (
            <Trophy className="h-5 w-5 mx-auto mt-1 text-yellow-500" />
          )}
        </div>

        {/* Team 2 or Bye */}
        {isBye || !team2 ? (
          <div className="flex items-center justify-center p-3 bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className="text-xl font-bold text-muted-foreground">BYE</div>
              <div className="text-xs text-muted-foreground">Bye Week</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={team2.avatar} />
                <AvatarFallback>{team2.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className={`font-bold ${winningTeam?.id === team2.id ? 'text-green-600' : ''}`}>
                  {team2.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {team2.owner} • {team2.record.wins}-{team2.record.losses}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${winningTeam?.id === team2.id ? 'text-green-600' : ''}`}>
                {team2.points.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">
                Proj: {team2.projectedPoints.toFixed(1)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MobileMatchupHeader;