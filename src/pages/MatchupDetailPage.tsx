import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import MobileMatchupHeader from '@/components/matchup/MobileMatchupHeader';
import PlayerCard from '@/components/matchup/PlayerCard';
import SimpleLineChart from '@/components/charts/SimpleLineChart';
import SimpleBarChart from '@/components/charts/SimpleBarChart';
import { 
  ArrowLeft, 
  Trophy, 
  Clock, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  BarChart3,
  Activity,
  Calendar,
  Star
} from 'lucide-react';
import SupabaseMatchupService from '@/services/supabaseMatchupService';
import SleeperApiService, { SleeperPlayer } from '@/services/sleeperApi';
import MatchupCache from '@/services/matchupCache';

// Position color function to match TeamDetailPage styling
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
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Types for matchup details
interface MatchupTeam {
  id: number;
  name: string;
  owner: string;
  avatar?: string;
  logoUrl?: string;
  record: { wins: number; losses: number };
  points: number;
  projectedPoints: number;
  rosterId: number;
  starters: string[];
  bench: string[];
  playersPoints: Record<string, number>;
  playersProjected: Record<string, number>;
}

interface DetailedMatchup {
  id: number;
  week: number;
  status: 'live' | 'completed' | 'upcoming';
  startTime?: Date;
  endTime?: Date;
  isPlayoff: boolean;
  playoffRound?: string;
  conference: { id: number; name: string };
  teams: [MatchupTeam, MatchupTeam?];
  isBye: boolean;
  scoreDifferential: number;
  gameTimeRemaining?: string;
}

interface PlayerPerformance {
  playerId: string;
  name: string;
  position: string;
  team: string;
  points: number;
  projected: number;
  status: 'playing' | 'played' | 'bye' | 'injured' | 'not_started';
  gameTimeRemaining?: string;
  isOutperforming: boolean;
  variance: number;
}

interface HistoricalMatchup {
  week: number;
  season: string;
  team1Score: number;
  team2Score: number;
  winner: string;
  date: Date;
  status: 'complete' | 'scheduled' | string;
}

const MatchupDetailPage: React.FC = () => {
  const { matchupId } = useParams<{ matchupId: string }>();
  const navigate = useNavigate();
  const { selectedSeason, seasonConfigs } = useApp();
  const { toast } = useToast();

  const [matchup, setMatchup] = useState<DetailedMatchup | null>(null);
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [historicalMatchups, setHistoricalMatchups] = useState<HistoricalMatchup[]>([]);
  const [weeklyPerformanceData, setWeeklyPerformanceData] = useState<{ week: number; team1: number; team2?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('live-scoring');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const seasonConfig = useMemo(() => 
    seasonConfigs.find(s => s.year === selectedSeason),
    [seasonConfigs, selectedSeason]
  );

  // Load matchup data
  const loadMatchupData = async () => {
    if (!matchupId || !selectedSeason || !seasonConfig) return;

    try {
      setLoading(true);
      
      // Load players data
      const players = await MatchupCache.getPlayers();
      setAllPlayers(players);

      const seasonId = typeof seasonConfig.seasonId === 'string' 
        ? parseInt(seasonConfig.seasonId) 
        : (seasonConfig.seasonId || selectedSeason);

      // Load detailed matchup data
      const matchupData = await SupabaseMatchupService.getDetailedMatchup(
        parseInt(matchupId),
        seasonId
      );

      if (matchupData) {
        // Fetch player projections for the matchup week
        try {
          const seasonYear = selectedSeason;
          const weekNumber = matchupData.week;
          const playerIds = [
            ...matchupData.teams[0].starters, 
            ...matchupData.teams[0].bench,
            ...(matchupData.teams[1] ? [...matchupData.teams[1].starters, ...matchupData.teams[1].bench] : [])
          ];
          
          // Fetch projections
          const projections = await SleeperApiService.fetchPlayerProjections(
            seasonYear,
            weekNumber
          );
          
          // Map projections to player IDs
          const projectedPoints: Record<string, number> = {};
          projections.forEach(projection => {
            if (playerIds.includes(projection.player_id) && projection.stats.pts_ppr !== undefined) {
              projectedPoints[projection.player_id] = projection.stats.pts_ppr;
            }
          });
          
          // Update the projected points for each team
          matchupData.teams.forEach(team => {
            team.starters.forEach(playerId => {
              if (projectedPoints[playerId] !== undefined) {
                team.playersProjected[playerId] = projectedPoints[playerId];
              }
            });
            
            team.bench.forEach(playerId => {
              if (projectedPoints[playerId] !== undefined) {
                team.playersProjected[playerId] = projectedPoints[playerId];
              }
            });
            
            // Recalculate total projected points for the team
            team.projectedPoints = team.starters.reduce((total, playerId) => {
              return total + (team.playersProjected[playerId] || 0);
            }, 0);
          });
        } catch (projError) {
          console.error('Error fetching player projections:', projError);
          // Non-critical error, don't block the rest of the data loading
        }
        
        setMatchup(matchupData);
        
        // Load historical data and weekly performance between these teams
        if (matchupData.teams[1]) {
          const [history, weeklyPerformance] = await Promise.all([
            // Get head-to-head history across all seasons (seasonId is only used for context)
            SupabaseMatchupService.getHeadToHeadHistory(
              matchupData.teams[0].id,
              matchupData.teams[1].id,
              seasonId
            ),
            SupabaseMatchupService.getTeamWeeklyPerformance(
              matchupData.teams[0].id,
              matchupData.teams[1].id,
              seasonId
            )
          ]);
          setHistoricalMatchups(history);
          setWeeklyPerformanceData(weeklyPerformance);
        } else {
          // For bye weeks, only get team1's weekly performance
          const weeklyPerformance = await SupabaseMatchupService.getTeamWeeklyPerformance(
            matchupData.teams[0].id,
            null,
            seasonId
          );
          setWeeklyPerformanceData(weeklyPerformance);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading matchup data:', error);
      toast({
        title: 'Error Loading Matchup',
        description: 'Failed to load matchup details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await loadMatchupData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadMatchupData();
  }, [matchupId, selectedSeason, seasonConfig]);

  // Auto-refresh for live matchups
  useEffect(() => {
    if (matchup?.status === 'live') {
      const interval = setInterval(refreshData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [matchup?.status]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/matchups')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Matchups
          </Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p>Loading matchup details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!matchup) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/matchups')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Matchups
          </Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p>Matchup not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [team1, team2] = matchup.teams;
  const winningTeam = matchup.status === 'completed' && team2
    ? (team1.points > team2.points ? team1 : team2)
    : null;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile/Desktop Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/matchups')} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Back to Matchups</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">
              Week {matchup.week} Matchup
              {matchup.playoffRound && ` - ${matchup.playoffRound}`}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {matchup.conference.name} • {selectedSeason} Season
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between md:justify-end space-x-2">
          <div className="text-xs text-muted-foreground md:order-2">
            Updated: {lastUpdated.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="md:order-1"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Mobile Header (< 768px) */}
      <div className="md:hidden">
        <MobileMatchupHeader
          team1={team1}
          team2={team2}
          status={matchup.status}
          week={matchup.week}
          winningTeam={winningTeam}
          gameTimeRemaining={matchup.gameTimeRemaining}
          startTime={matchup.startTime}
          isBye={matchup.isBye}
        />
      </div>

      {/* Desktop Header (>= 768px) */}
      <div className="hidden md:block">
        <MatchupHeader matchup={matchup} winningTeam={winningTeam} />
      </div>

      {/* Quick Stats Bar - Collapsible on Mobile */}
      <Collapsible defaultOpen={false} className="md:block">
        <CollapsibleTrigger asChild className="md:hidden">
          <Button variant="outline" className="w-full">
            <BarChart3 className="h-4 w-4 mr-2" />
            Quick Stats
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="md:block">
          <div className="mt-2 md:mt-0">
            <QuickStatsBar matchup={matchup} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Main Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="live-scoring" className="text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Live Scoring</span>
            <span className="sm:hidden">Live</span>
          </TabsTrigger>
          <TabsTrigger value="team-analysis" className="text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Team Analysis</span>
            <span className="sm:hidden">Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="head-to-head" className="text-xs sm:text-sm">
            <Trophy className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Head-to-Head</span>
            <span className="sm:hidden">H2H</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live-scoring" className="space-y-4">
          <LiveScoringTab matchup={matchup} allPlayers={allPlayers} />
        </TabsContent>

        <TabsContent value="team-analysis" className="space-y-4">
          <TeamAnalysisTab matchup={matchup} weeklyPerformanceData={weeklyPerformanceData} />
        </TabsContent>

        <TabsContent value="head-to-head" className="space-y-4">
          <HeadToHeadTab 
            matchup={matchup} 
            historicalMatchups={historicalMatchups} 
          />
        </TabsContent>
      </Tabs>

      {/* Insights Panel - Mobile Collapsible, Desktop Sidebar */}
      <div className="lg:hidden">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Matchup Insights
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2">
              {/* MatchupInsightsPanel component temporarily commented out */}
              {/* <MatchupInsightsPanel matchup={matchup} /> */}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="hidden lg:block">
        {/* MatchupInsightsPanel component temporarily commented out */}
        {/* <MatchupInsightsPanel matchup={matchup} /> */}
      </div>
    </div>
  );
};

// Header component showing team matchup
const MatchupHeader: React.FC<{
  matchup: DetailedMatchup;
  winningTeam: MatchupTeam | null;
}> = ({ matchup, winningTeam }) => {
  const [team1, team2] = matchup.teams;

  const getStatusBadge = () => {
    switch (matchup.status) {
      case 'live':
        return <Badge className="bg-green-500 hover:bg-green-600">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Upcoming</Badge>;
      default:
        return <Badge variant="secondary">{matchup.status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusBadge()}
            {matchup.gameTimeRemaining && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {matchup.gameTimeRemaining}
              </Badge>
            )}
          </div>
          {matchup.startTime && (
            <div className="text-sm text-muted-foreground">
              {matchup.startTime.toLocaleDateString()} at {matchup.startTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          {/* Team 1 */}
          <div className="md:col-span-2">
            <TeamCard 
              team={team1} 
              isWinner={winningTeam?.id === team1.id} 
              matchupStatus={matchup.status}
              isLeftSide={true}
            />
          </div>

          {/* VS Section */}
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground mb-2">VS</div>
            {matchup.status === 'completed' && winningTeam && (
              <Trophy className="h-6 w-6 mx-auto text-yellow-500" />
            )}
            {matchup.scoreDifferential > 0 && matchup.status !== 'upcoming' && (
              <div className="text-xs text-muted-foreground mt-1">
                {matchup.scoreDifferential.toFixed(1)} pt difference
              </div>
            )}
          </div>

          {/* Team 2 */}
          <div className="md:col-span-2">
            {matchup.isBye || !team2 ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">BYE</div>
                <div className="text-sm text-muted-foreground">Bye Week</div>
              </div>
            ) : (
              <TeamCard 
                team={team2} 
                isWinner={winningTeam?.id === team2.id} 
                matchupStatus={matchup.status}
                isLeftSide={false}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Team card component
const TeamCard: React.FC<{
  team: MatchupTeam;
  isWinner: boolean;
  matchupStatus?: 'live' | 'completed' | 'upcoming';
  isLeftSide?: boolean;
}> = ({ team, isWinner, matchupStatus = 'completed', isLeftSide = true }) => {
  const isScheduled = matchupStatus === 'upcoming';
  
  // Construct Sleeper avatar URL
  const avatarUrl = team.logoUrl ? `https://sleepercdn.com/avatars/thumbs/${team.logoUrl}` : team.avatar;
  
  if (isLeftSide) {
    // Left side layout: avatar left, info center, scores right
    return (
      <div className="flex items-center justify-between w-full">
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 text-left ml-3">
          <div className={`text-lg font-bold ${isWinner && !isScheduled ? 'text-green-600' : ''}`}>
            {team.name}
          </div>
          <div className="text-sm text-muted-foreground">{team.owner}</div>
          <div className="text-xs text-muted-foreground">
            {team.record.wins}-{team.record.losses}
          </div>
        </div>
        
        <div className="text-right">
          {isScheduled ? (
            <div className="text-3xl font-bold text-muted-foreground">
              --
            </div>
          ) : (
            <div className={`text-3xl font-bold ${isWinner ? 'text-green-600' : ''}`}>
              {team.points.toFixed(1)}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Proj: {team.projectedPoints.toFixed(1)}
          </div>
        </div>
      </div>
    );
  } else {
    // Right side layout: scores left, info center (right-aligned), avatar right
    return (
      <div className="flex items-center justify-between w-full">
        <div className="text-left">
          {isScheduled ? (
            <div className="text-3xl font-bold text-muted-foreground">
              --
            </div>
          ) : (
            <div className={`text-3xl font-bold ${isWinner ? 'text-green-600' : ''}`}>
              {team.points.toFixed(1)}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Proj: {team.projectedPoints.toFixed(1)}
          </div>
        </div>
        
        <div className="flex-1 text-right mr-3">
          <div className={`text-lg font-bold ${isWinner && !isScheduled ? 'text-green-600' : ''}`}>
            {team.name}
          </div>
          <div className="text-sm text-muted-foreground">{team.owner}</div>
          <div className="text-xs text-muted-foreground">
            {team.record.wins}-{team.record.losses}
          </div>
        </div>
        
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
        </Avatar>
      </div>
    );
  }
};

export default MatchupDetailPage;

// Quick Stats Bar Component
const QuickStatsBar: React.FC<{ matchup: DetailedMatchup }> = ({ matchup }) => {
  const [team1, team2] = matchup.teams;
  
  const getPlayersStillPlaying = (team: MatchupTeam) => {
    // For scheduled games, all starters are considered "to play"
    if (matchup.status === 'upcoming') {
      return team.starters.length;
    }
    return team.starters.filter(playerId => {
      // This would need to be implemented based on your player status logic
      return true; // Placeholder
    }).length;
  };

  const getBenchPoints = (team: MatchupTeam) => {
    // For scheduled games, don't show actual bench points since no one has played yet
    if (matchup.status === 'upcoming') {
      return 0;
    }
    return team.bench.reduce((total, playerId) => {
      return total + (team.playersPoints[playerId] || 0);
    }, 0);
  };

  const isScheduled = matchup.status === 'upcoming';

  const stats = [
    {
      label: isScheduled ? "Projected Points" : "Projected vs Actual",
      value: team2 
        ? isScheduled
          ? `${team1.projectedPoints.toFixed(1)} vs ${team2.projectedPoints.toFixed(1)}`
          : `${team1.points.toFixed(1)}/${team1.projectedPoints.toFixed(1)} vs ${team2.points.toFixed(1)}/${team2.projectedPoints.toFixed(1)}`
        : isScheduled
          ? `${team1.projectedPoints.toFixed(1)}`
          : `${team1.points.toFixed(1)} / ${team1.projectedPoints.toFixed(1)}`,
      mobileValue: team2
        ? isScheduled
          ? `${team1.projectedPoints.toFixed(1)}\nvs\n${team2.projectedPoints.toFixed(1)}`
          : `${team1.points.toFixed(1)}/${team1.projectedPoints.toFixed(1)}\nvs\n${team2.points.toFixed(1)}/${team2.projectedPoints.toFixed(1)}`
        : isScheduled
          ? `${team1.projectedPoints.toFixed(1)}`
          : `${team1.points.toFixed(1)} / ${team1.projectedPoints.toFixed(1)}`
    },
    {
      label: isScheduled ? "Starters Set" : "Players Playing",
      value: team2 
        ? `${getPlayersStillPlaying(team1)} vs ${getPlayersStillPlaying(team2)}`
        : `${getPlayersStillPlaying(team1)}`,
      mobileValue: team2
        ? `${getPlayersStillPlaying(team1)} vs ${getPlayersStillPlaying(team2)}`
        : `${getPlayersStillPlaying(team1)}`
    },
    {
      label: isScheduled ? "Bench Size" : "Bench Points",
      value: team2 
        ? isScheduled
          ? `${team1.bench.length} vs ${team2.bench.length}`
          : `${getBenchPoints(team1).toFixed(1)} vs ${getBenchPoints(team2).toFixed(1)}`
        : isScheduled
          ? `${team1.bench.length}`
          : `${getBenchPoints(team1).toFixed(1)}`,
      mobileValue: team2
        ? isScheduled
          ? `${team1.bench.length} vs ${team2.bench.length}`
          : `${getBenchPoints(team1).toFixed(1)} vs ${getBenchPoints(team2).toFixed(1)}`
        : isScheduled
          ? `${team1.bench.length}`
          : `${getBenchPoints(team1).toFixed(1)}`
    },
    {
      label: "Season Record",
      value: team2 
        ? `${team1.record.wins}-${team1.record.losses} vs ${team2.record.wins}-${team2.record.losses}`
        : `${team1.record.wins}-${team1.record.losses}`,
      mobileValue: team2
        ? `${team1.record.wins}-${team1.record.losses} vs ${team2.record.wins}-${team2.record.losses}`
        : `${team1.record.wins}-${team1.record.losses}`
    }
  ];

  return (
    <Card>
      <CardContent className="py-4">
        {/* Mobile Layout - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
              <div className="text-sm font-semibold whitespace-pre-line">
                {stat.mobileValue}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Layout - 1x4 Grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-4 text-center">
          {stats.map((stat, index) => (
            <div key={index}>
              <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
              <div className="text-lg font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Live Scoring Tab Component
const LiveScoringTab: React.FC<{
  matchup: DetailedMatchup;
  allPlayers: Record<string, SleeperPlayer>;
}> = ({ matchup, allPlayers }) => {
  const [team1, team2] = matchup.teams;

  const getPlayerInfo = (playerId: string): PlayerPerformance => {
    const player = allPlayers[playerId];
    const team1Points = team1.playersPoints[playerId] || 0;
    const team2Points = team2?.playersPoints[playerId] || 0;
    const points = team1Points || team2Points;
    
    const team1Projected = team1.playersProjected[playerId] || 0;
    const team2Projected = team2?.playersProjected[playerId] || 0;
    const projected = team1Projected || team2Projected;
    
    // Check if the matchup is scheduled/upcoming
    const isScheduled = matchup.status === 'upcoming';
    
    // For scheduled games, don't show performance indicators or variance
    const actualPoints = isScheduled ? 0 : points;
    const hasPlayed = !isScheduled && points > 0;

    return {
      playerId,
      name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() : 'Unknown',
      position: player?.position || 'N/A',
      team: player?.team || 'N/A',
      points: actualPoints,
      projected,
      // Only show status if the player has actually played or the game is live/completed
      status: isScheduled ? 'not_started' : (hasPlayed ? 'played' : 'not_started'),
      // Only show performance indicators for completed/live games
      isOutperforming: isScheduled ? false : points > projected,
      variance: isScheduled ? 0 : points - projected
    };
  };

  const renderPlayerCard = (playerId: string, position: string, isStarter: boolean = true) => {
    const playerInfo = getPlayerInfo(playerId);
    
    return (
      <PlayerCard
        key={playerId}
        playerId={playerId}
        name={playerInfo.name}
        position={playerInfo.position}
        team={playerInfo.team}
        points={playerInfo.points}
        projected={playerInfo.projected}
        status={playerInfo.status}
        positionSlot={position}
        isStarter={isStarter}
        gameTimeRemaining={playerInfo.gameTimeRemaining}
        expandable={false}
      />
    );
  };

  const renderTeamLineup = (team: MatchupTeam, teamName: string) => {
    const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'SFLEX', 'DEF'];
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Users className="h-5 w-5 mr-2" />
            {teamName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Starters */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Starting Lineup
            </h4>
            <div className="space-y-2">
              {team.starters.map((playerId, index) => 
                renderPlayerCard(playerId, positions[index] || 'FLEX', true)
              )}
            </div>
          </div>
          
          {/* Bench - Collapsible on Mobile */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full md:hidden">
                <Users className="h-4 w-4 mr-2" />
                Show Bench ({team.bench.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="md:block">
              <div className="space-y-2 mt-2 md:mt-0">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide hidden md:block">
                  Bench
                </h4>
                <div className="space-y-2">
                  {team.bench.map((playerId) => 
                    renderPlayerCard(playerId, 'BENCH', false)
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
      {renderTeamLineup(team1, team1.name)}
      {team2 && renderTeamLineup(team2, team2.name)}
    </div>
  );
};

// Team Analysis Tab Component
const TeamAnalysisTab: React.FC<{ 
  matchup: DetailedMatchup; 
  weeklyPerformanceData: { week: number; team1: number; team2?: number }[];
}> = ({ matchup, weeklyPerformanceData }) => {
  const [team1, team2] = matchup.teams;

  const positionPerformanceData = [
    { position: 'QB', team1: 85, team2: 78 },
    { position: 'RB', team1: 72, team2: 88 },
    { position: 'WR', team1: 91, team2: 82 },
    { position: 'TE', team1: 65, team2: 71 },
    { position: 'K', team1: 88, team2: 85 },
    { position: 'DEF', team1: 76, team2: 69 },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Weekly Performance Chart */}
      {weeklyPerformanceData.length > 0 ? (
        <SimpleLineChart
          title="Weekly Performance Comparison"
          data={weeklyPerformanceData}
          team1Name={team1.name}
          team2Name={team2?.name || 'BYE'}
          height={200}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent className="py-8 text-center">
            <div className="text-muted-foreground">
              No completed matchups found for this season
            </div>
          </CardContent>
        </Card>
      )}

      {/* Position Group Performance */}
      <div className="grid md:grid-cols-2 gap-4">
        <SimpleBarChart
          title={`${team1.name} Position Performance`}
          data={positionPerformanceData.map(pos => ({
            label: pos.position,
            value: pos.team1,
            color: 'bg-blue-500'
          }))}
          maxValue={100}
          height={180}
        />
        
        {team2 && (
          <SimpleBarChart
            title={`${team2.name} Position Performance`}
            data={positionPerformanceData.map(pos => ({
              label: pos.position,
              value: pos.team2,
              color: 'bg-red-500'
            }))}
            maxValue={100}
            height={180}
          />
        )}
      </div>

      {/* Consistency Metrics */}
      <div className="grid md:grid-cols-2 gap-4">
        <TeamMetricsCard 
          teamName={team1.name} 
          scores={weeklyPerformanceData.map(d => d.team1).filter(score => score > 0)} 
        />

        {team2 && (
          <TeamMetricsCard 
            teamName={team2.name} 
            scores={weeklyPerformanceData.map(d => d.team2).filter(score => score !== undefined && score > 0) as number[]} 
          />
        )}
      </div>
    </div>
  );
};

// Head-to-Head Tab Component
const HeadToHeadTab: React.FC<{
  matchup: DetailedMatchup;
  historicalMatchups: HistoricalMatchup[];
}> = ({ matchup, historicalMatchups }) => {
  const [team1, team2] = matchup.teams;

  const headToHeadRecord = useMemo(() => {
    if (!team2) return { team1Wins: 0, team2Wins: 0, ties: 0 };
    
    // Only count completed games for head-to-head record
    const completedMatchups = historicalMatchups.filter(game => game.status === 'complete');
    
    return completedMatchups.reduce(
      (record, game) => {
        if (game.team1Score > game.team2Score) {
          record.team1Wins++;
        } else if (game.team2Score > game.team1Score) {
          record.team2Wins++;
        } else {
          record.ties++;
        }
        return record;
      },
      { team1Wins: 0, team2Wins: 0, ties: 0 }
    );
  }, [historicalMatchups, team2]);

  const averageScoring = useMemo(() => {
    // Only consider completed matchups for average scoring
    const completedMatchups = historicalMatchups.filter(game => game.status === 'complete');
    if (completedMatchups.length === 0) return { team1Avg: 0, team2Avg: 0 };
    
    const totals = completedMatchups.reduce(
      (acc, game) => ({
        team1Total: acc.team1Total + game.team1Score,
        team2Total: acc.team2Total + game.team2Score,
      }),
      { team1Total: 0, team2Total: 0 }
    );

    return {
      team1Avg: totals.team1Total / completedMatchups.length,
      team2Avg: totals.team2Total / completedMatchups.length,
    };
  }, [historicalMatchups]);

  return (
    <div className="space-y-6">
      {/* Head-to-Head Record */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            All-Time Head-to-Head Record
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Showing completed games across all seasons
          </div>
        </CardHeader>
        <CardContent>
          {team2 ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {headToHeadRecord.team1Wins}
                </div>
                <div className="text-sm text-muted-foreground">{team1.name} Wins</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {headToHeadRecord.ties}
                </div>
                <div className="text-sm text-muted-foreground">Ties</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {headToHeadRecord.team2Wins}
                </div>
                <div className="text-sm text-muted-foreground">{team2.name} Wins</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              No head-to-head history available for bye week
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Matchups Table */}
      {historicalMatchups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Previous Matchups
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Showing completed and scheduled matchups across all seasons
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historicalMatchups.slice(0, 10).map((game, index) => {
                const isCompleted = game.status === 'complete';
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 ${isCompleted ? 'bg-gray-50' : 'bg-blue-50'} rounded-lg`}
                  >
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">Week {game.week}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {game.season}
                      </span>
                      {!isCompleted && (
                        <Badge variant="secondary" className="bg-blue-100">Upcoming</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {isCompleted ? (
                        <>
                          <div className="text-right">
                            <div className="font-medium">
                              {game.team1Score.toFixed(1)} - {game.team2Score.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Winner: {game.winner}
                            </div>
                          </div>
                          {game.team1Score > game.team2Score ? (
                            <Star className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Star className="h-4 w-4 text-red-500" />
                          )}
                        </>
                      ) : (
                        <div className="text-right">
                          <div className="font-medium text-blue-600">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Scheduled
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Not yet played
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Matchup Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Average Scoring in Matchups</h4>
              <div className="text-sm text-muted-foreground">
                {team1.name}: {averageScoring.team1Avg.toFixed(1)} pts/game
              </div>
              {team2 && (
                <div className="text-sm text-muted-foreground">
                  {team2.name}: {averageScoring.team2Avg.toFixed(1)} pts/game
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Notable Performances</h4>
              {historicalMatchups.filter(game => game.status === 'complete').length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  Highest scoring: {Math.max(...historicalMatchups
                    .filter(game => game.status === 'complete')
                    .map(g => Math.max(g.team1Score, g.team2Score))).toFixed(1)} pts
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No historical data available
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Team Metrics Card Component
const TeamMetricsCard: React.FC<{ 
  teamName: string; 
  scores: number[]; 
}> = ({ teamName, scores }) => {
  const calculateMetrics = (scores: number[]) => {
    if (scores.length === 0) {
      return {
        average: 0,
        floor: 0,
        ceiling: 0,
        consistency: 'No Data'
      };
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const floor = Math.min(...scores);
    const ceiling = Math.max(...scores);
    
    // Calculate standard deviation for consistency
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Determine consistency level based on coefficient of variation
    const coefficientOfVariation = standardDeviation / average;
    let consistency = 'Medium';
    if (coefficientOfVariation < 0.15) {
      consistency = 'High';
    } else if (coefficientOfVariation > 0.25) {
      consistency = 'Low';
    }

    return {
      average: average.toFixed(1),
      floor: floor.toFixed(1),
      ceiling: ceiling.toFixed(1),
      consistency
    };
  };

  const metrics = calculateMetrics(scores);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{teamName} Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Average Score</span>
          <span className="font-medium">{metrics.average}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Floor</span>
          <span className="font-medium">{metrics.floor}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Ceiling</span>
          <span className="font-medium">{metrics.ceiling}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Consistency</span>
          <span className="font-medium">{metrics.consistency}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Games Played</span>
          <span className="font-medium">{scores.length}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Matchup Insights Panel Component
const MatchupInsightsPanel: React.FC<{ matchup: DetailedMatchup }> = ({ matchup }) => {
  const [team1, team2] = matchup.teams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="h-5 w-5 mr-2" />
          Matchup Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Advantages */}
        <div>
          <h4 className="font-medium mb-2">Key Advantages</h4>
          <div className="space-y-2 text-sm">
            <div className="p-2 bg-blue-50 rounded">
              <strong>{team1.name}</strong> has stronger QB play this week
            </div>
            {team2 && (
              <div className="p-2 bg-red-50 rounded">
                <strong>{team2.name}</strong> has better RB depth
              </div>
            )}
          </div>
        </div>

        {/* Weather Alerts */}
        <div>
          <h4 className="font-medium mb-2 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Weather Alerts
          </h4>
          <div className="text-sm text-muted-foreground">
            No weather concerns for this week
          </div>
        </div>

        {/* Injury Reports */}
        <div>
          <h4 className="font-medium mb-2">Injury Updates</h4>
          <div className="text-sm text-muted-foreground">
            All players healthy and active
          </div>
        </div>

        {/* Waiver Suggestions */}
        <div>
          <h4 className="font-medium mb-2">Waiver Wire</h4>
          <div className="text-sm text-muted-foreground">
            Consider picking up handcuff RBs
          </div>
        </div>

        <Separator />

        {/* Social Features */}
        <div>
          <h4 className="font-medium mb-2 flex items-center">
            <MessageSquare className="h-4 w-4 mr-1" />
            Trash Talk
          </h4>
          <Button variant="outline" size="sm" className="w-full">
            Add Comment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};