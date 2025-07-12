import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SleeperPlayer, SleeperRoster } from '@/services/sleeperApi';

interface Player {
  id: number;
  sleeper_player_id: string;
  player_name: string;
  position: string;
  team_id: number;
  nfl_team: string;
  jersey_number: number;
  status: string;
  injury_status: string;
}

interface StartingLineupProps {
  roster?: SleeperRoster | null;
  allPlayers: Record<string, SleeperPlayer>;
  teamName: string;
  playerPoints?: Record<string, number>;
  startersPoints?: number[];
  // New props for matchup-based starting lineup
  matchupStarters?: string[]; // Array of player IDs who actually started in this matchup
}

interface LineupPosition {
  label: string;
  abbreviation: string;
  eligiblePositions: string[];
  description: string;
}

const LINEUP_POSITIONS: LineupPosition[] = [
{ label: 'Quarterback', abbreviation: 'QB', eligiblePositions: ['QB'], description: 'Starting Quarterback' },
{ label: 'Running Back', abbreviation: 'RB', eligiblePositions: ['RB'], description: 'Starting Running Back #1' },
{ label: 'Running Back', abbreviation: 'RB', eligiblePositions: ['RB'], description: 'Starting Running Back #2' },
{ label: 'Wide Receiver', abbreviation: 'WR', eligiblePositions: ['WR'], description: 'Starting Wide Receiver #1' },
{ label: 'Wide Receiver', abbreviation: 'WR', eligiblePositions: ['WR'], description: 'Starting Wide Receiver #2' },
{ label: 'Wide Receiver', abbreviation: 'WR', eligiblePositions: ['WR'], description: 'Starting Wide Receiver #3' },
{ label: 'Tight End', abbreviation: 'TE', eligiblePositions: ['TE'], description: 'Starting Tight End' },
{ label: 'Flex', abbreviation: 'WRT', eligiblePositions: ['RB', 'WR', 'TE'], description: 'Flex Position (RB/WR/TE)' },
{ label: 'SuperFlex', abbreviation: 'WRTQ', eligiblePositions: ['QB', 'RB', 'WR', 'TE'], description: 'SuperFlex Position (QB/RB/WR/TE)' }];


const getPositionBadgeColor = (position: string): string => {
  switch (position) {
    case 'QB':return 'bg-purple-500 hover:bg-purple-600';
    case 'RB':return 'bg-green-500 hover:bg-green-600';
    case 'WR':return 'bg-blue-500 hover:bg-blue-600';
    case 'TE':return 'bg-orange-500 hover:bg-orange-600';
    case 'K':return 'bg-yellow-500 hover:bg-yellow-600';
    case 'DEF':return 'bg-gray-500 hover:bg-gray-600';
    default:return 'bg-gray-400 hover:bg-gray-500';
  }
};

const getInjuryStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'out':return 'text-red-600';
    case 'doubtful':return 'text-red-500';
    case 'questionable':return 'text-yellow-600';
    case 'probable':return 'text-yellow-500';
    case 'healthy':
    case 'active':
    default:return 'text-green-600';
  }
};

const getPlayerName = (playerId: string, allPlayers: Record<string, SleeperPlayer>): string => {
  const player = allPlayers[playerId];
  if (!player) return 'Unknown Player';

  const firstName = player.first_name || '';
  const lastName = player.last_name || '';

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (lastName) {
    return lastName;
  } else if (firstName) {
    return firstName;
  } else {
    return player.full_name || 'Unknown Player';
  }
};

const getPlayerInfo = (playerId: string, allPlayers: Record<string, SleeperPlayer>) => {
  const player = allPlayers[playerId];
  if (!player) {
    return {
      name: 'Unknown Player',
      position: 'N/A',
      nflTeam: 'N/A',
      injuryStatus: 'Unknown',
      jerseyNumber: null
    };
  }

  return {
    name: getPlayerName(playerId, allPlayers),
    position: player.position || 'N/A',
    nflTeam: player.team || 'FA',
    injuryStatus: player.injury_status || 'Healthy',
    jerseyNumber: player.number
  };
};

const StartingLineup: React.FC<StartingLineupProps> = ({
  roster,
  allPlayers,
  teamName,
  playerPoints = {},
  startersPoints = [],
  matchupStarters
}) => {
  // Use matchup starters if available, otherwise fall back to roster starters
  const starters = matchupStarters || roster?.starters || [];

  // Debug logging to help identify the issue
  console.log(`🔧 StartingLineup Debug for ${teamName}:`, {
    hasMatchupStarters: !!matchupStarters,
    matchupStartersLength: matchupStarters?.length || 0,
    hasRosterStarters: !!roster?.starters,
    rosterStartersLength: roster?.starters?.length || 0,
    finalStartersLength: starters.length,
    finalStarters: starters.slice(0, 3), // Show first 3 player IDs
    startersPointsLength: startersPoints.length,
    playerPointsKeys: Object.keys(playerPoints).length
  });

  if (starters.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{teamName} Starting Lineup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">No lineup data available</p>
          </div>
        </CardContent>
      </Card>);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{teamName} Starting Lineup</span>
          <Badge variant="outline" className="text-xs">
            {starters.length}/9 positions
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {LINEUP_POSITIONS.map((position, index) => {
            const playerId = starters[index];
            const playerInfo = playerId ? getPlayerInfo(playerId, allPlayers) : null;
            const points = startersPoints[index];
            const playerPoints_individual = playerId ? playerPoints[playerId] : undefined;

            return (
              <div
                key={`${position.abbreviation}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">

                <div className="flex items-center space-x-3 flex-1">
                  {/* Position Badge */}
                  <div className="flex flex-col items-center min-w-[60px]">
                    <Badge
                      className={`text-xs font-bold ${position.abbreviation === 'WRT' || position.abbreviation === 'WRTQ' ? 'bg-indigo-500 hover:bg-indigo-600' : getPositionBadgeColor(position.abbreviation)}`}>

                      {position.abbreviation}
                    </Badge>
                    <span className="text-xs text-muted-foreground mt-1 text-center leading-tight">
                      {position.eligiblePositions.join('/')}
                    </span>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1">
                    {playerInfo ?
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">{playerInfo.name}</span>
                          {playerInfo.injuryStatus !== 'Healthy' && playerInfo.injuryStatus !== 'Active' &&
                        <Badge
                          variant="outline"
                          className={`text-xs ${getInjuryStatusColor(playerInfo.injuryStatus)}`}>

                              {playerInfo.injuryStatus}
                            </Badge>
                        }
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <span className="flex items-center space-x-1">
                            <Badge
                            variant="outline"
                            className={`text-xs ${getPositionBadgeColor(playerInfo.position)}`}>

                              {playerInfo.position}
                            </Badge>
                          </span>
                          <span className="font-medium">{playerInfo.nflTeam}</span>
                          {playerInfo.jerseyNumber &&
                        <span>#{playerInfo.jerseyNumber}</span>
                        }
                        </div>
                      </div> :

                    <div className="space-y-1">
                        <span className="font-medium text-sm text-muted-foreground">Empty Slot</span>
                        <div className="text-xs text-muted-foreground">
                          No player assigned
                        </div>
                      </div>
                    }
                  </div>
                </div>

                {/* Points */}
                <div className="text-right min-w-[60px]">
                  <div className="font-bold text-sm">
                    {points !== undefined ? points.toFixed(1) : '0.0'}
                  </div>
                  {playerPoints_individual !== undefined && points !== playerPoints_individual &&
                  <div className="text-xs text-muted-foreground">
                      ({playerPoints_individual.toFixed(1)})
                    </div>
                  }
                </div>
              </div>);

          })}
        </div>

        {/* Lineup Summary */}
        <div className="mt-4 pt-3 border-t">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="font-medium">Total Starters</div>
              <div className="text-muted-foreground">{starters.length}</div>
            </div>
            <div>
              <div className="font-medium">Projected</div>
              <div className="text-muted-foreground">
                {startersPoints.length > 0 ? startersPoints.reduce((a, b) => a + (b || 0), 0).toFixed(1) : '0.0'}
              </div>
            </div>
            <div>
              <div className="font-medium">Active</div>
              <div className="text-green-600">
                {starters.filter((playerId) => {
                  const playerInfo = getPlayerInfo(playerId, allPlayers);
                  return playerInfo.injuryStatus === 'Healthy' || playerInfo.injuryStatus === 'Active';
                }).length}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>);

};

export default StartingLineup;