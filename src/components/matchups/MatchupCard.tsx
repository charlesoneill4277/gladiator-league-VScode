import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { LiveMatchupData } from '@/services/matchupDataService';
import TeamRosterCard from './TeamRosterCard';
import { 
  ChevronDown, 
  Clock, 
  Trophy, 
  Users, 
  RefreshCw,
  Swords,
  Calendar
} from 'lucide-react';

interface MatchupCardProps {
  matchup: LiveMatchupData;
  onRefresh?: (matchupId: number) => void;
  isRefreshing?: boolean;
}

const MatchupCard: React.FC<MatchupCardProps> = ({
  matchup,
  onRefresh,
  isRefreshing = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getWinningTeam = () => {
    if (matchup.status === 'upcoming') return null;
    
    const team1Points = matchup.team1Roster.totalPoints;
    const team2Points = matchup.team2Roster.totalPoints;
    
    if (team1Points > team2Points) return 'team1';
    if (team2Points > team1Points) return 'team2';
    return 'tie';
  };

  const winningTeam = getWinningTeam();

  const handleRefresh = () => {
    if (onRefresh && !isRefreshing) {
      onRefresh(matchup.id);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Swords className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{matchup.conference.name}</CardTitle>
                </div>
                {getStatusBadge(matchup.status)}
                {matchup.isPlayoff && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Trophy className="h-3 w-3 mr-1" />
                    Playoff
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {matchup.lastUpdate && (
                  <div className="text-xs text-muted-foreground flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(matchup.lastUpdate).toLocaleTimeString()}</span>
                  </div>
                )}
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`} 
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CardContent className="pt-0">
          {/* Matchup Summary */}
          <div className="grid grid-cols-3 gap-4 items-center mb-4">
            {/* Team 1 */}
            <div className={`text-right space-y-1 ${
              winningTeam === 'team1' ? 'text-green-700 font-semibold' : ''
            }`}>
              <div className="font-semibold text-lg">{matchup.team1.name}</div>
              <div className="text-sm text-muted-foreground">{matchup.team1.ownerName}</div>
              <div className="text-3xl font-bold">
                {matchup.status === 'upcoming' ? '--' : matchup.team1Roster.totalPoints.toFixed(1)}
              </div>
              {matchup.status !== 'upcoming' && (
                <div className="text-xs text-muted-foreground">
                  {matchup.team1Roster.starters.length} starters
                </div>
              )}
            </div>

            {/* VS Divider */}
            <div className="text-center space-y-2">
              <div className="text-xl font-semibold text-muted-foreground">VS</div>
              {winningTeam === 'team1' || winningTeam === 'team2' ? (
                <Trophy className="h-6 w-6 mx-auto text-yellow-500" />
              ) : (
                <div className="flex items-center justify-center space-x-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Week {matchup.week}</span>
                </div>
              )}
            </div>

            {/* Team 2 */}
            <div className={`text-left space-y-1 ${
              winningTeam === 'team2' ? 'text-green-700 font-semibold' : ''
            }`}>
              <div className="font-semibold text-lg">{matchup.team2.name}</div>
              <div className="text-sm text-muted-foreground">{matchup.team2.ownerName}</div>
              <div className="text-3xl font-bold">
                {matchup.status === 'upcoming' ? '--' : matchup.team2Roster.totalPoints.toFixed(1)}
              </div>
              {matchup.status !== 'upcoming' && (
                <div className="text-xs text-muted-foreground">
                  {matchup.team2Roster.starters.length} starters
                </div>
              )}
            </div>
          </div>

          {/* Expanded Content */}
          <CollapsibleContent className="space-y-4">
            <Separator />
            
            {/* Refresh Button */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Team Rosters</h3>
              {matchup.status !== 'upcoming' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </Button>
              )}
            </div>

            {matchup.status === 'upcoming' ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Roster information will be available once the matchup begins.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamRosterCard
                  teamName={matchup.team1.name}
                  ownerName={matchup.team1.ownerName}
                  rosterData={matchup.team1Roster}
                  isExpanded={true}
                />
                <TeamRosterCard
                  teamName={matchup.team2.name}
                  ownerName={matchup.team2.ownerName}
                  rosterData={matchup.team2Roster}
                  isExpanded={true}
                />
              </div>
            )}

            {/* Matchup Stats */}
            {matchup.status !== 'upcoming' && (
              <>
                <Separator />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold">
                      {(matchup.team1Roster.totalPoints + matchup.team2Roster.totalPoints).toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Points</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {Math.abs(matchup.team1Roster.totalPoints - matchup.team2Roster.totalPoints).toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">Point Margin</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {matchup.team1Roster.starters.length + matchup.team2Roster.starters.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Players</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold capitalize">
                      {matchup.status}
                    </div>
                    <div className="text-sm text-muted-foreground">Status</div>
                  </div>
                </div>
              </>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
};

export default MatchupCard;