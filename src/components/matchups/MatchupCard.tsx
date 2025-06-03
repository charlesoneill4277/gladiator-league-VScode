import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Trophy, Clock, Users } from 'lucide-react';
import TeamLineup from './TeamLineup';

interface Team {
  id: number;
  name: string;
  owner: string;
  roster_id: number;
  points: number;
  starters: string[];
  players: string[];
  players_points?: { [key: string]: number };
}

interface MatchupCardProps {
  matchupId: number;
  conference: string;
  team1: Team;
  team2: Team;
  week: number;
  status: 'live' | 'completed' | 'upcoming';
  isPlayoff?: boolean;
}

const MatchupCard: React.FC<MatchupCardProps> = ({
  matchupId,
  conference,
  team1,
  team2,
  week,
  status,
  isPlayoff = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const getWinner = () => {
    if (status !== 'completed') return null;
    return team1.points > team2.points ? team1 : team2;
  };

  const winner = getWinner();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="w-full cursor-pointer">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-lg">{conference}</CardTitle>
                  {getStatusBadge()}
                  {isPlayoff && <Badge variant="destructive">Playoff</Badge>}
                </div>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`} 
                />
              </div>
            </CardHeader>
          </div>
        </CollapsibleTrigger>

        <CardContent className="pt-0">
          {/* Matchup Summary */}
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Team 1 */}
            <div className={`text-right space-y-1 ${winner?.id === team1.id ? 'text-green-600 font-semibold' : ''}`}>
              <div className="font-semibold">{team1.name}</div>
              <div className="text-sm text-muted-foreground">{team1.owner}</div>
              <div className="text-2xl font-bold">
                {status === 'upcoming' ? '--' : team1.points?.toFixed(1) || '0.0'}
              </div>
            </div>

            {/* VS Divider */}
            <div className="text-center">
              <div className="text-lg font-semibold text-muted-foreground">VS</div>
              {winner && (
                <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" />
              )}
            </div>

            {/* Team 2 */}
            <div className={`text-left space-y-1 ${winner?.id === team2.id ? 'text-green-600 font-semibold' : ''}`}>
              <div className="font-semibold">{team2.name}</div>
              <div className="text-sm text-muted-foreground">{team2.owner}</div>
              <div className="text-2xl font-bold">
                {status === 'upcoming' ? '--' : team2.points?.toFixed(1) || '0.0'}
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          <CollapsibleContent className="mt-6">
            <div className="border-t pt-4 space-y-4">
              {status !== 'upcoming' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TeamLineup
                    team={team1}
                    week={week}
                    isWinner={winner?.id === team1.id}
                  />
                  <TeamLineup
                    team={team2}
                    week={week}
                    isWinner={winner?.id === team2.id}
                  />
                </div>
              )}

              {/* Matchup Stats */}
              {status !== 'upcoming' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Points</div>
                    <div className="font-semibold">
                      {((team1.points || 0) + (team2.points || 0)).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Point Spread</div>
                    <div className="font-semibold">
                      {Math.abs((team1.points || 0) - (team2.points || 0)).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Week</div>
                    <div className="font-semibold">{week}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="text-xs capitalize">{status}</div>
                  </div>
                </div>
              )}

              {status === 'upcoming' && (
                <div className="text-center py-4 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p>Matchup details will be available once the week begins</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
};

export default MatchupCard;