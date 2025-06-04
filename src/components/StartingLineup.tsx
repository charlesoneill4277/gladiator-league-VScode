import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SleeperPlayer, SleeperRoster } from '@/services/sleeperApi';
import { AlertTriangle, Info, ChevronDown, CheckCircle, XCircle, Clock, Eye, Database } from 'lucide-react';

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
  // Enhanced props for validation
  ownerId?: string;
  teamId?: number;
  rosterId?: string;
  week?: number;
  matchupId?: string;
}

interface LineupPosition {
  label: string;
  abbreviation: string;
  eligiblePositions: string[];
  description: string;
}

interface DataQualityMetrics {
  completeness: number; // 0-100%
  consistency: number; // 0-100%
  accuracy: number; // 0-100%
  timeliness: number; // 0-100%
  overall: number; // 0-100%
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

interface DataLineage {
  source: 'matchup-specific' | 'roster-fallback' | 'none';
  timestamp: string;
  confidence: 'high' | 'medium' | 'low';
  dataPath: string[];
  validationChecks: Record<string, boolean>;
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
  { label: 'SuperFlex', abbreviation: 'WRTQ', eligiblePositions: ['QB', 'RB', 'WR', 'TE'], description: 'SuperFlex Position (QB/RB/WR/TE)' }
];

const getPositionBadgeColor = (position: string): string => {
  switch (position) {
    case 'QB': return 'bg-purple-500 hover:bg-purple-600';
    case 'RB': return 'bg-green-500 hover:bg-green-600';
    case 'WR': return 'bg-blue-500 hover:bg-blue-600';
    case 'TE': return 'bg-orange-500 hover:bg-orange-600';
    case 'K': return 'bg-yellow-500 hover:bg-yellow-600';
    case 'DEF': return 'bg-gray-500 hover:bg-gray-600';
    default: return 'bg-gray-400 hover:bg-gray-500';
  }
};

const getInjuryStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'out': return 'text-red-600';
    case 'doubtful': return 'text-red-500';
    case 'questionable': return 'text-yellow-600';
    case 'probable': return 'text-yellow-500';
    case 'healthy':
    case 'active':
    default: return 'text-green-600';
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

const validateLineupConfiguration = (starters: string[], allPlayers: Record<string, SleeperPlayer>): {
  isValid: boolean;
  violations: string[];
  suggestions: string[];
} => {
  const violations: string[] = [];
  const suggestions: string[] = [];
  
  if (starters.length !== LINEUP_POSITIONS.length) {
    violations.push(`Incorrect lineup size: expected ${LINEUP_POSITIONS.length}, got ${starters.length}`);
  }

  starters.forEach((playerId, index) => {
    if (!playerId) {
      violations.push(`Empty slot at position ${index + 1} (${LINEUP_POSITIONS[index]?.label || 'Unknown'})`);
      return;
    }

    const player = allPlayers[playerId];
    if (!player) {
      violations.push(`Unknown player at position ${index + 1}: ${playerId}`);
      return;
    }

    const position = LINEUP_POSITIONS[index];
    if (position && !position.eligiblePositions.includes(player.position)) {
      violations.push(`Position mismatch: ${player.position} player ${getPlayerName(playerId, allPlayers)} in ${position.abbreviation} slot`);
      suggestions.push(`Move ${getPlayerName(playerId, allPlayers)} to appropriate ${player.position} slot`);
    }

    if (player.injury_status === 'Out') {
      violations.push(`Inactive player in lineup: ${getPlayerName(playerId, allPlayers)} (${player.injury_status})`);
      suggestions.push(`Replace ${getPlayerName(playerId, allPlayers)} with healthy alternative`);
    }
  });

  return {
    isValid: violations.length === 0,
    violations,
    suggestions
  };
};

const calculateDataQualityMetrics = (
  starters: string[],
  allPlayers: Record<string, SleeperPlayer>,
  playerPoints: Record<string, number>,
  startersPoints: number[],
  dataLineage: DataLineage
): DataQualityMetrics => {
  let completeness = 0;
  let consistency = 0;
  let accuracy = 0;
  let timeliness = 100; // Assume current data is timely
  const issues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Calculate completeness
  const nonEmptyStarters = starters.filter(id => id && id.trim() !== '').length;
  const playersWithData = starters.filter(id => id && allPlayers[id]).length;
  const playersWithPoints = starters.filter(id => id && playerPoints[id] !== undefined).length;
  
  completeness = Math.round((
    (nonEmptyStarters / LINEUP_POSITIONS.length) * 0.4 +
    (playersWithData / starters.length) * 0.3 +
    (playersWithPoints / starters.length) * 0.3
  ) * 100);

  // Calculate consistency
  const startersPointsMatch = starters.length === startersPoints.length;
  const validPlayerIds = starters.filter(id => id && typeof id === 'string' && id.length > 0).length;
  
  consistency = Math.round((
    (startersPointsMatch ? 1 : 0) * 0.5 +
    (validPlayerIds / starters.length) * 0.5
  ) * 100);

  // Calculate accuracy based on position validation
  const lineupValidation = validateLineupConfiguration(starters, allPlayers);
  accuracy = Math.round(Math.max(0, 100 - (lineupValidation.violations.length * 10)));

  // Identify issues and recommendations
  if (completeness < 90) {
    issues.push(`Data completeness below threshold (${completeness}%)`);
    recommendations.push('Verify all player data is properly loaded');
  }

  if (consistency < 90) {
    issues.push(`Data consistency issues detected (${consistency}%)`);
    recommendations.push('Check data synchronization between sources');
  }

  if (accuracy < 90) {
    issues.push(`Lineup accuracy concerns (${accuracy}%)`);
    recommendations.push('Review player position assignments');
  }

  if (dataLineage.confidence === 'low') {
    warnings.push('Low confidence in data source reliability');
    recommendations.push('Consider refreshing data from primary source');
  }

  const overall = Math.round((completeness * 0.3 + consistency * 0.3 + accuracy * 0.25 + timeliness * 0.15));

  return {
    completeness,
    consistency,
    accuracy,
    timeliness,
    overall,
    issues,
    warnings,
    recommendations
  };
};

const StartingLineup: React.FC<StartingLineupProps> = ({
  roster,
  allPlayers,
  teamName,
  playerPoints = {},
  startersPoints = [],
  matchupStarters,
  ownerId,
  teamId,
  rosterId,
  week,
  matchupId
}) => {
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);
  const [showDataLineage, setShowDataLineage] = React.useState(false);

  // Enhanced starters selection with detailed logging
  const starters = React.useMemo(() => {
    console.log(`🔍 [${teamName}] Lineup Data Source Selection:`, {
      matchupStarters: {
        available: !!matchupStarters,
        isArray: Array.isArray(matchupStarters),
        length: matchupStarters?.length || 0,
        data: matchupStarters
      },
      rosterStarters: {
        available: !!roster?.starters,
        isArray: Array.isArray(roster?.starters),
        length: roster?.starters?.length || 0,
        data: roster?.starters
      }
    });

    // Prefer matchup starters (specific to this matchup/week)
    if (Array.isArray(matchupStarters) && matchupStarters.length > 0) {
      console.log(`✅ [${teamName}] Using matchup-specific starters (${matchupStarters.length} players)`);
      return matchupStarters;
    }

    // Fallback to roster starters (general roster configuration)
    if (roster?.starters && Array.isArray(roster.starters) && roster.starters.length > 0) {
      console.log(`⚠️ [${teamName}] Using roster fallback starters (${roster.starters.length} players)`);
      return roster.starters;
    }

    // Last resort: empty array
    console.log(`❌ [${teamName}] No starter data available`);
    return [];
  }, [matchupStarters, roster?.starters, teamName]);

  // Generate comprehensive data lineage
  const dataLineage: DataLineage = React.useMemo(() => {
    const hasMatchupStarters = Array.isArray(matchupStarters) && matchupStarters.length > 0;
    const hasRosterStarters = roster?.starters && Array.isArray(roster.starters) && roster.starters.length > 0;
    
    let source: DataLineage['source'] = 'none';
    let confidence: DataLineage['confidence'] = 'low';
    const dataPath: string[] = [];
    
    if (hasMatchupStarters) {
      source = 'matchup-specific';
      confidence = 'high';
      dataPath.push('Sleeper API → Matchup Data → Starters Array');
    } else if (hasRosterStarters) {
      source = 'roster-fallback';
      confidence = 'medium';
      dataPath.push('Sleeper API → Roster Data → Starters Array');
    } else {
      dataPath.push('No valid data source found');
    }

    const validationChecks = {
      hasPlayerData: starters.every(id => id && allPlayers[id]),
      hasPointsData: starters.some(id => id && playerPoints[id] !== undefined),
      correctLineupSize: starters.length === LINEUP_POSITIONS.length,
      allPositionsFilled: starters.every(id => id && id.trim() !== ''),
      ownershipVerified: !!(ownerId && teamId),
      weekSpecific: !!week
    };

    return {
      source,
      timestamp: new Date().toISOString(),
      confidence,
      dataPath,
      validationChecks
    };
  }, [starters, matchupStarters, roster?.starters, allPlayers, playerPoints, ownerId, teamId, week]);

  // Calculate comprehensive data quality metrics
  const dataQualityMetrics = React.useMemo(() => {
    return calculateDataQualityMetrics(starters, allPlayers, playerPoints, startersPoints, dataLineage);
  }, [starters, allPlayers, playerPoints, startersPoints, dataLineage]);

  // Validate lineup configuration
  const lineupValidation = React.useMemo(() => {
    return validateLineupConfiguration(starters, allPlayers);
  }, [starters, allPlayers]);

  // Enhanced debug information
  const debugInfo = React.useMemo(() => {
    const info = {
      // Basic data availability
      hasMatchupStarters: !!matchupStarters && Array.isArray(matchupStarters),
      matchupStartersLength: matchupStarters?.length || 0,
      hasRosterStarters: !!roster?.starters && Array.isArray(roster?.starters),
      rosterStartersLength: roster?.starters?.length || 0,
      finalStartersLength: starters.length,
      startersPointsLength: startersPoints.length,
      playerPointsKeys: Object.keys(playerPoints).length,
      
      // Data relationships
      dataConsistency: {
        startersMatchPoints: starters.length === startersPoints.length,
        playersHavePoints: starters.filter((playerId) => playerPoints[playerId] !== undefined).length,
        expectedLineupSize: LINEUP_POSITIONS.length,
        allPlayersExist: starters.filter(id => id && allPlayers[id]).length
      },
      
      // Metadata
      dataSource: dataLineage.source,
      confidence: dataLineage.confidence,
      teamMetadata: {
        ownerId,
        teamId,
        rosterId,
        week,
        matchupId
      },
      
      // Quality metrics
      qualityMetrics: dataQualityMetrics,
      lineupValidation
    };

    return info;
  }, [starters, startersPoints, playerPoints, allPlayers, dataLineage, dataQualityMetrics, lineupValidation, ownerId, teamId, rosterId, week, matchupId]);

  // Comprehensive logging
  React.useEffect(() => {
    console.group(`🏈 Enhanced StartingLineup Analysis: ${teamName}`);
    
    console.log('📊 Data Quality Metrics:', dataQualityMetrics);
    console.log('🔍 Data Lineage:', dataLineage);
    console.log('✅ Lineup Validation:', lineupValidation);
    console.log('🧮 Debug Information:', debugInfo);
    
    // Log warnings for data inconsistencies
    if (debugInfo.finalStartersLength > 0) {
      const warnings: string[] = [];
      
      if (!debugInfo.dataConsistency.startersMatchPoints) {
        warnings.push(`Starters count (${debugInfo.finalStartersLength}) doesn't match points count (${debugInfo.startersPointsLength})`);
      }
      
      if (debugInfo.dataConsistency.playersHavePoints < debugInfo.finalStartersLength) {
        warnings.push(`Only ${debugInfo.dataConsistency.playersHavePoints}/${debugInfo.finalStartersLength} starters have player points data`);
      }
      
      if (debugInfo.finalStartersLength !== debugInfo.dataConsistency.expectedLineupSize) {
        warnings.push(`Lineup size (${debugInfo.finalStartersLength}) doesn't match expected size (${debugInfo.dataConsistency.expectedLineupSize})`);
      }
      
      if (debugInfo.dataConsistency.allPlayersExist < debugInfo.finalStartersLength) {
        warnings.push(`${debugInfo.finalStartersLength - debugInfo.dataConsistency.allPlayersExist} player(s) missing from player database`);
      }
      
      if (warnings.length > 0) {
        console.warn('⚠️ Data Quality Warnings:', warnings);
      }
    }
    
    console.groupEnd();
  }, [teamName, debugInfo, dataQualityMetrics, dataLineage, lineupValidation]);

  if (starters.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>{teamName} Starting Lineup</span>
            <Badge variant="destructive" className="text-xs">
              <XCircle className="w-3 h-3 mr-1" />
              No Data
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">No lineup data available</p>
            <div className="mt-4 space-y-2">
              <Badge variant="outline" className="text-xs">
                <Database className="w-3 h-3 mr-1" />
                Data source: {dataLineage.source}
              </Badge>
              <div className="text-xs text-muted-foreground">
                Confidence: {dataLineage.confidence}
              </div>
            </div>
          </div>
          
          {/* Debug information for empty lineup */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                <Info className="w-4 h-4 mr-2" />
                Show Debug Info
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-2">
                <div><strong>Owner ID:</strong> {ownerId || 'Unknown'}</div>
                <div><strong>Team ID:</strong> {teamId || 'Unknown'}</div>
                <div><strong>Roster ID:</strong> {rosterId || 'Unknown'}</div>
                <div><strong>Week:</strong> {week || 'Unknown'}</div>
                <div><strong>Matchup ID:</strong> {matchupId || 'Unknown'}</div>
                <div><strong>Available Players:</strong> {Object.keys(allPlayers).length}</div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  }

  const getDataQualityColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDataQualityIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="w-3 h-3" />;
    if (score >= 70) return <Clock className="w-3 h-3" />;
    return <XCircle className="w-3 h-3" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{teamName} Starting Lineup</span>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {starters.length}/{LINEUP_POSITIONS.length} positions
            </Badge>
            <Badge 
              variant={dataLineage.source === 'matchup-specific' ? 'default' : 'secondary'} 
              className="text-xs"
            >
              <Database className="w-3 h-3 mr-1" />
              {dataLineage.source}
            </Badge>
            <Badge 
              variant="outline" 
              className={`text-xs ${getDataQualityColor(dataQualityMetrics.overall)}`}
            >
              {getDataQualityIcon(dataQualityMetrics.overall)}
              <span className="ml-1">{dataQualityMetrics.overall}%</span>
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Data Quality Alerts */}
        {(dataQualityMetrics.issues.length > 0 || dataQualityMetrics.warnings.length > 0 || !lineupValidation.isValid) && (
          <div className="mb-4 space-y-2">
            {dataQualityMetrics.issues.map((issue, index) => (
              <Alert key={index} variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{issue}</AlertDescription>
              </Alert>
            ))}
            {dataQualityMetrics.warnings.map((warning, index) => (
              <Alert key={index}>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">{warning}</AlertDescription>
              </Alert>
            ))}
            {!lineupValidation.isValid && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Lineup configuration issues detected: {lineupValidation.violations.length} violations found
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Roster Verification Display */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs font-medium text-blue-800 mb-2">Roster Verification</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
            <div>Owner ID → Team ID: {ownerId || 'N/A'} → {teamId || 'N/A'}</div>
            <div>Roster ID: {rosterId || 'N/A'}</div>
            <div>Week: {week || 'N/A'}</div>
            <div>Matchup ID: {matchupId || 'N/A'}</div>
          </div>
        </div>

        <div className="space-y-3">
          {LINEUP_POSITIONS.map((position, index) => {
            const playerId = starters[index];
            const playerInfo = playerId ? getPlayerInfo(playerId, allPlayers) : null;
            const points = startersPoints[index];
            const playerPoints_individual = playerId ? playerPoints[playerId] : undefined;
            const hasDataInconsistency = playerInfo?.name === 'Unknown Player' || 
              (playerPoints_individual !== undefined && points !== undefined && Math.abs(playerPoints_individual - points) > 0.1);

            return (
              <div
                key={`${position.abbreviation}-${index}`}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  hasDataInconsistency ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 hover:bg-gray-100'
                }`}>

                <div className="flex items-center space-x-3 flex-1">
                  {/* Position Badge */}
                  <div className="flex flex-col items-center min-w-[60px]">
                    <Badge
                      className={`text-xs font-bold ${
                        position.abbreviation === 'WRT' || position.abbreviation === 'WRTQ' 
                          ? 'bg-indigo-500 hover:bg-indigo-600' 
                          : getPositionBadgeColor(position.abbreviation)
                      }`}>
                      {position.abbreviation}
                    </Badge>
                    <span className="text-xs text-muted-foreground mt-1 text-center leading-tight">
                      {position.eligiblePositions.join('/')}
                    </span>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1">
                    {playerInfo ? (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">{playerInfo.name}</span>
                          {hasDataInconsistency && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Data Issue
                            </Badge>
                          )}
                          {playerInfo.injuryStatus !== 'Healthy' && playerInfo.injuryStatus !== 'Active' && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${getInjuryStatusColor(playerInfo.injuryStatus)}`}>
                              {playerInfo.injuryStatus}
                            </Badge>
                          )}
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
                          {playerInfo.jerseyNumber && (
                            <span>#{playerInfo.jerseyNumber}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm text-muted-foreground">Empty Slot</span>
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="w-3 h-3 mr-1" />
                            Missing
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          No player assigned
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right min-w-[60px]">
                  <div className="font-bold text-sm">
                    {points !== undefined ? points.toFixed(1) : '0.0'}
                  </div>
                  {playerPoints_individual !== undefined && points !== playerPoints_individual && (
                    <div className="text-xs text-muted-foreground">
                      ({playerPoints_individual.toFixed(1)})
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Enhanced Lineup Summary */}
        <div className="mt-4 pt-3 border-t">
          <div className="grid grid-cols-4 gap-4 text-center text-sm">
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
            <div>
              <div className="font-medium">Quality</div>
              <div className={getDataQualityColor(dataQualityMetrics.overall)}>
                {dataQualityMetrics.overall}%
              </div>
            </div>
          </div>

          {/* Data Quality Metrics Display */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-700 mb-2">Data Quality Metrics</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="font-medium">Completeness</div>
                <div className={getDataQualityColor(dataQualityMetrics.completeness)}>
                  {dataQualityMetrics.completeness}%
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium">Consistency</div>
                <div className={getDataQualityColor(dataQualityMetrics.consistency)}>
                  {dataQualityMetrics.consistency}%
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium">Accuracy</div>
                <div className={getDataQualityColor(dataQualityMetrics.accuracy)}>
                  {dataQualityMetrics.accuracy}%
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium">Timeliness</div>
                <div className={getDataQualityColor(dataQualityMetrics.timeliness)}>
                  {dataQualityMetrics.timeliness}%
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Debug Information */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-2">
                <Eye className="w-4 h-4 mr-2" />
                Show Debug Information
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-3">
                {/* Data Lineage */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs font-medium text-blue-800 mb-2">Complete Data Lineage</div>
                  <div className="space-y-1 text-xs text-blue-700">
                    <div><strong>Source:</strong> {dataLineage.source}</div>
                    <div><strong>Confidence:</strong> {dataLineage.confidence}</div>
                    <div><strong>Timestamp:</strong> {new Date(dataLineage.timestamp).toLocaleString()}</div>
                    <div><strong>Data Path:</strong></div>
                    {dataLineage.dataPath.map((path, index) => (
                      <div key={index} className="ml-4">→ {path}</div>
                    ))}
                  </div>
                </div>

                {/* Validation Checks */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-xs font-medium text-green-800 mb-2">Validation Checks</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(dataLineage.validationChecks).map(([check, passed]) => (
                      <div key={check} className={`flex items-center ${passed ? 'text-green-700' : 'text-red-700'}`}>
                        {passed ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        {check.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {dataQualityMetrics.recommendations.length > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-xs font-medium text-yellow-800 mb-2">Recommendations</div>
                    {dataQualityMetrics.recommendations.map((rec, index) => (
                      <div key={index} className="text-xs text-yellow-700 mb-1">• {rec}</div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
};

export default StartingLineup;