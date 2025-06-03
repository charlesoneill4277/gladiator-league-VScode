import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, User } from 'lucide-react';

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

interface Player {
  sleeper_player_id: string;
  player_name: string;
  position: string;
  nfl_team: string;
  status: string;
  injury_status: string;
}

interface TeamLineupProps {
  team: Team;
  week: number;
  isWinner?: boolean;
}

const POSITIONS = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'SUPERFLEX'];

const TeamLineup: React.FC<TeamLineupProps> = ({ team, week, isWinner = false }) => {
  const [players, setPlayers] = useState<{ [key: string]: Player }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        
        // Get all unique player IDs from starters and players
        const allPlayerIds = [...new Set([...team.starters, ...team.players])];
        
        if (allPlayerIds.length === 0) {
          setLoading(false);
          return;
        }

        // Query players from database
        const response = await window.ezsite.apis.tablePage('12870', {
          PageNo: 1,
          PageSize: 100,
          Filters: allPlayerIds.map(playerId => ({
            name: 'sleeper_player_id',
            op: 'Equal',
            value: playerId
          }))
        });

        if (response.error) {
          console.error('Error fetching players:', response.error);
          setLoading(false);
          return;
        }

        const playersMap: { [key: string]: Player } = {};
        response.data?.List?.forEach((player: any) => {
          playersMap[player.sleeper_player_id] = player;
        });

        setPlayers(playersMap);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [team.starters, team.players]);

  const getPlayerDisplay = (playerId: string, isStarter: boolean, index?: number) => {
    const player = players[playerId];
    const points = team.players_points?.[playerId] || 0;
    const position = isStarter && index !== undefined ? POSITIONS[index] : player?.position || 'UNK';

    if (loading) {
      return (
        <div className="flex items-center justify-between py-2 px-3 border rounded">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      );
    }

    const getInjuryBadge = () => {
      if (!player || player.injury_status === 'Healthy') return null;
      
      const colorMap: { [key: string]: string } = {
        'Questionable': 'bg-yellow-500',
        'Doubtful': 'bg-orange-500',
        'Out': 'bg-red-500',
        'IR': 'bg-red-700'
      };

      return (
        <Badge 
          className={`text-xs ${colorMap[player.injury_status] || 'bg-gray-500'} text-white`}
        >
          {player.injury_status}
        </Badge>
      );
    };

    return (
      <div 
        key={playerId}
        className={`flex items-center justify-between py-2 px-3 border rounded ${
          isStarter ? 'border-green-200 bg-green-50' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-3 flex-1">
          <Badge variant={isStarter ? 'default' : 'secondary'} className="text-xs font-mono">
            {position}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {player?.player_name || `Player ${playerId}`}
            </div>
            {player && (
              <div className="text-xs text-muted-foreground flex items-center space-x-2">
                <span>{player.nfl_team}</span>
                {getInjuryBadge()}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-sm">
            {points?.toFixed(1) || '0.0'}
          </div>
          <div className="text-xs text-muted-foreground">pts</div>
        </div>
      </div>
    );
  };

  const benchPlayers = team.players.filter(playerId => !team.starters.includes(playerId));

  return (
    <Card className={isWinner ? 'border-green-500 border-2' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          {isWinner && <Crown className="h-4 w-4 text-yellow-500" />}
          <span>{team.name}</span>
          <Badge variant="outline" className="text-xs">
            {team.points?.toFixed(1) || '0.0'} pts
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Starters */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span>STARTERS</span>
          </div>
          <div className="space-y-1">
            {team.starters.map((playerId, index) => 
              getPlayerDisplay(playerId, true, index)
            )}
          </div>
        </div>

        {/* Bench */}
        {benchPlayers.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              BENCH
            </div>
            <div className="space-y-1">
              {benchPlayers.map(playerId => 
                getPlayerDisplay(playerId, false)
              )}
            </div>
          </div>
        )}

        {/* Team Summary */}
        <div className="border-t pt-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Total Players:</span>
            <span>{team.players.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Starters:</span>
            <span>{team.starters.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Bench:</span>
            <span>{benchPlayers.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamLineup;