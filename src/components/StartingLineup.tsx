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
      <Card data-id="ky0x5c8pj">
        <CardHeader className="pb-2" data-id="ej94xfn4o">
          <CardTitle className="text-sm" data-id="u9jzv22lz">{teamName} Starting Lineup</CardTitle>
        </CardHeader>
        <CardContent data-id="9p7m1k8hj">
          <div className="text-center py-4" data-id="9kc33dntc">
            <p className="text-muted-foreground text-sm" data-id="4oox7iddg">No lineup data available</p>
          </div>
        </CardContent>
      </Card>);
  }

  return (
    <Card data-id="cz74k79b7">
      <CardHeader className="pb-3" data-id="hiyphzdk4">
        <CardTitle className="text-sm flex items-center justify-between" data-id="2er9us0e2">
          <span data-id="ql0p9k31t">{teamName} Starting Lineup</span>
          <Badge variant="outline" className="text-xs" data-id="qjor62zlc">
            {starters.length}/9 positions
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent data-id="01n7t05qk">
        <div className="space-y-3" data-id="84vuf6qch">
          {LINEUP_POSITIONS.map((position, index) => {
            const playerId = starters[index];
            const playerInfo = playerId ? getPlayerInfo(playerId, allPlayers) : null;
            const points = startersPoints[index];
            const playerPoints_individual = playerId ? playerPoints[playerId] : undefined;

            return (
              <div
                key={`${position.abbreviation}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" data-id="d5q8qoplj">

                <div className="flex items-center space-x-3 flex-1" data-id="4n3a3gdh3">
                  {/* Position Badge */}
                  <div className="flex flex-col items-center min-w-[60px]" data-id="onjei04dp">
                    <Badge
                      className={`text-xs font-bold ${position.abbreviation === 'WRT' || position.abbreviation === 'WRTQ' ? 'bg-indigo-500 hover:bg-indigo-600' : getPositionBadgeColor(position.abbreviation)}`} data-id="5ihbmfmcf">

                      {position.abbreviation}
                    </Badge>
                    <span className="text-xs text-muted-foreground mt-1 text-center leading-tight" data-id="rweg8109x">
                      {position.eligiblePositions.join('/')}
                    </span>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1" data-id="cucbkb3ml">
                    {playerInfo ?
                    <div className="space-y-1" data-id="cwrzxmsme">
                        <div className="flex items-center space-x-2" data-id="k6kd5iykd">
                          <span className="font-medium text-sm" data-id="w7gwguj8u">{playerInfo.name}</span>
                          {playerInfo.injuryStatus !== 'Healthy' && playerInfo.injuryStatus !== 'Active' &&
                        <Badge
                          variant="outline"
                          className={`text-xs ${getInjuryStatusColor(playerInfo.injuryStatus)}`} data-id="9s12t4ctp">

                              {playerInfo.injuryStatus}
                            </Badge>
                        }
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground" data-id="7u9rismon">
                          <span className="flex items-center space-x-1" data-id="560lz2klc">
                            <Badge
                            variant="outline"
                            className={`text-xs ${getPositionBadgeColor(playerInfo.position)}`} data-id="nwxr79nh7">

                              {playerInfo.position}
                            </Badge>
                          </span>
                          <span className="font-medium" data-id="cfk6kvlk4">{playerInfo.nflTeam}</span>
                          {playerInfo.jerseyNumber &&
                        <span data-id="a16u3pnbr">#{playerInfo.jerseyNumber}</span>
                        }
                        </div>
                      </div> :

                    <div className="space-y-1" data-id="fpzbzzbfz">
                        <span className="font-medium text-sm text-muted-foreground" data-id="yk4hy1m6q">Empty Slot</span>
                        <div className="text-xs text-muted-foreground" data-id="v5vhqcw15">
                          No player assigned
                        </div>
                      </div>
                    }
                  </div>
                </div>

                {/* Points */}
                <div className="text-right min-w-[60px]" data-id="o9ljgtkkv">
                  <div className="font-bold text-sm" data-id="1ql2kwjil">
                    {points !== undefined ? points.toFixed(1) : '0.0'}
                  </div>
                  {playerPoints_individual !== undefined && points !== playerPoints_individual &&
                  <div className="text-xs text-muted-foreground" data-id="p5fcauf80">
                      ({playerPoints_individual.toFixed(1)})
                    </div>
                  }
                </div>
              </div>);

          })}
        </div>

        {/* Lineup Summary */}
        <div className="mt-4 pt-3 border-t" data-id="9hu59rc5q">
          <div className="grid grid-cols-3 gap-4 text-center text-sm" data-id="cwkw0udt6">
            <div data-id="twbt9c87p">
              <div className="font-medium" data-id="02r5xspig">Total Starters</div>
              <div className="text-muted-foreground" data-id="ae1theu9n">{starters.length}</div>
            </div>
            <div data-id="lsfyep2qv">
              <div className="font-medium" data-id="0vwpep2vy">Projected</div>
              <div className="text-muted-foreground" data-id="pdzsucna9">
                {startersPoints.length > 0 ? startersPoints.reduce((a, b) => a + (b || 0), 0).toFixed(1) : '0.0'}
              </div>
            </div>
            <div data-id="ooislmn7f">
              <div className="font-medium" data-id="8eq7bxo4p">Active</div>
              <div className="text-green-600" data-id="eppui1tnw">
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