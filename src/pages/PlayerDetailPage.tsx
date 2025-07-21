import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, User, TrendingUp, Calendar, AlertCircle, Trophy, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { DatabaseService } from '@/services/databaseService';
import { SleeperApiService } from '@/services/sleeperApi';
import { useToast } from '@/hooks/use-toast';
import { DbPlayer } from '@/types/database';

// Interface for player roster information
interface PlayerRosterInfo {
  conference_id: number;
  conference_name: string;
  team_id: number;
  team_name: string;
  owner_name: string;
  roster_id: number;
  league_id: string;
}

// Interface for weekly performance data
interface WeeklyPerformance {
  week: number;
  points: number;
  opponent?: string;
  result?: 'W' | 'L' | 'T';
  projection?: number;
  league_id: string;
  conference_name: string;
}

// Interface for season statistics
interface SeasonStats {
  totalPoints: number;
  avgPoints: number;
  gamesPlayed: number;
  bestGame: number;
  worstGame: number;
  consistency: number;
  weeklyPerformance: WeeklyPerformance[];
}

// Enhanced player detail interface
interface PlayerDetail {
  // Basic player info
  id: number;
  sleeper_id: string;
  player_name: string;
  position: string;
  nfl_team: string;
  number: number;
  age: number;
  height: number;
  weight: number;
  college: string;
  playing_status: string;
  injury_status: string | null;
  depth_chart: number;
  
  // Roster ownership info
  rostered_by: PlayerRosterInfo[];
  availability_status: 'free_agent' | 'rostered' | 'multi_rostered';
  
  // Performance data
  season_stats: SeasonStats;
}

const PlayerDetailPage: React.FC = () => {
  const { playerId } = useParams<{playerId: string;}>();
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch comprehensive player data
  const fetchPlayerData = async () => {
    if (!playerId || !currentSeasonConfig) return;

    try {
      setLoading(true);
      setError(null);
      console.log('Fetching player detail for ID:', playerId);

      // Step 1: Get player basic info from database
      const playerResult = await DatabaseService.getPlayers({
        filters: [
          { column: 'sleeper_id', operator: 'eq', value: playerId },
          { column: 'playing_status', operator: 'eq', value: 'Active' },
          { column: 'position', operator: 'in', value: ['QB', 'RB', 'WR', 'TE'] }
        ]
      });

      if (playerResult.error || !playerResult.data || playerResult.data.length === 0) {
        throw new Error('Player not found or not active');
      }

      const dbPlayer = playerResult.data[0];
      console.log('Found player:', dbPlayer);

      // Step 2: Get roster ownership info (similar to PlayersPage)
      let targetConferences = currentSeasonConfig.conferences;
      
      // Filter by selected conference if specified
      if (selectedConference && selectedConference !== 'all') {
        targetConferences = currentSeasonConfig.conferences.filter(c => c.id === selectedConference);
      }

      const conferenceIds = targetConferences
        .filter(c => c.dbConferenceId)
        .map(c => c.dbConferenceId!);

      if (conferenceIds.length === 0) {
        throw new Error('No valid conference IDs found');
      }

      // Get team-conference junctions for current season
      const junctionResult = await DatabaseService.getTeamConferenceJunctions({
        filters: [
          { column: 'conference_id', operator: 'in', value: conferenceIds }
        ]
      });

      if (junctionResult.error || !junctionResult.data) {
        throw new Error('Failed to fetch team mappings');
      }

      // Get team data
      const teamIds = [...new Set(junctionResult.data.map(j => j.team_id))];
      const teamsResult = await DatabaseService.getTeams({
        filters: [
          { column: 'id', operator: 'in', value: teamIds }
        ]
      });

      if (teamsResult.error || !teamsResult.data) {
        throw new Error('Failed to fetch teams');
      }

      // Step 3: Get roster data from Sleeper API for each conference
      const allRosterData = await Promise.all(
        targetConferences.map(async (conference) => {
          try {
            if (!conference.leagueId) {
              console.warn(`No league ID for conference ${conference.name}`);
              return { conference, rosters: [] };
            }
            
            const rosters = await SleeperApiService.fetchLeagueRosters(conference.leagueId);
            return { conference, rosters };
          } catch (error) {
            console.warn(`Failed to fetch rosters for conference ${conference.name}:`, error);
            return { conference, rosters: [] };
          }
        })
      );

      // Step 4: Determine roster ownership
      const rosterInfo: PlayerRosterInfo[] = [];
      allRosterData.forEach(({ conference, rosters }) => {
        rosters.forEach(roster => {
          if (roster.players && roster.players.includes(playerId)) {
            // Find the team for this roster
            const junction = junctionResult.data?.find(j => 
              j.conference_id === conference.dbConferenceId && j.roster_id === roster.roster_id
            );
            
            if (junction) {
              const team = teamsResult.data?.find(t => t.id === junction.team_id);
              if (team) {
                rosterInfo.push({
                  conference_id: conference.dbConferenceId!,
                  conference_name: conference.name,
                  team_id: team.id,
                  team_name: team.team_name,
                  owner_name: team.owner_name,
                  roster_id: roster.roster_id,
                  league_id: conference.leagueId!
                });
              }
            }
          }
        });
      });

      // Step 5: Get weekly performance data from Sleeper matchups
      const weeklyPerformance: WeeklyPerformance[] = [];
      const currentWeek = getCurrentWeek(); // Helper to get current NFL week
      
      // Fetch matchup data for weeks 1-17 (or current week) for each league the player is in
      const uniqueLeagues = [...new Set(rosterInfo.map(r => r.league_id))];
      
      for (const leagueId of uniqueLeagues) {
        const leagueRosterInfo = rosterInfo.find(r => r.league_id === leagueId);
        if (!leagueRosterInfo) continue;

        for (let week = 1; week <= Math.min(currentWeek, 17); week++) {
          try {
            const matchups = await SleeperApiService.fetchMatchups(leagueId, week);
            const playerMatchup = matchups.find(m => m.players && m.players.includes(playerId));
            
            if (playerMatchup && playerMatchup.players_points) {
              const points = playerMatchup.players_points[playerId] || 0;
              
              weeklyPerformance.push({
                week,
                points,
                league_id: leagueId,
                conference_name: leagueRosterInfo.conference_name
              });
            }
          } catch (error) {
            console.warn(`Failed to fetch matchup data for league ${leagueId}, week ${week}:`, error);
          }
        }
      }

      // Step 6: Calculate season statistics
      const seasonStats: SeasonStats = {
        totalPoints: weeklyPerformance.reduce((sum, w) => sum + w.points, 0),
        gamesPlayed: weeklyPerformance.length,
        bestGame: weeklyPerformance.length > 0 ? Math.max(...weeklyPerformance.map(w => w.points)) : 0,
        worstGame: weeklyPerformance.length > 0 ? Math.min(...weeklyPerformance.map(w => w.points)) : 0,
        avgPoints: 0,
        consistency: 0,
        weeklyPerformance
      };

      // Calculate derived stats
      seasonStats.avgPoints = seasonStats.gamesPlayed > 0 ? seasonStats.totalPoints / seasonStats.gamesPlayed : 0;
      
      // Calculate consistency (inverse of coefficient of variation)
      if (seasonStats.gamesPlayed > 1) {
        const mean = seasonStats.avgPoints;
        const variance = weeklyPerformance.reduce((sum, w) => sum + Math.pow(w.points - mean, 2), 0) / seasonStats.gamesPlayed;
        const stdDev = Math.sqrt(variance);
        const coefficient = mean > 0 ? stdDev / mean : 0;
        seasonStats.consistency = Math.max(0, 100 - coefficient * 100);
      }

      // Determine availability status
      let availability_status: 'free_agent' | 'rostered' | 'multi_rostered';
      if (rosterInfo.length === 0) {
        availability_status = 'free_agent';
      } else if (rosterInfo.length === 1) {
        availability_status = 'rostered';
      } else {
        availability_status = 'multi_rostered';
      }

      // Step 7: Build final player detail object
      const playerDetail: PlayerDetail = {
        id: dbPlayer.id,
        sleeper_id: dbPlayer.sleeper_id,
        player_name: dbPlayer.player_name,
        position: dbPlayer.position,
        nfl_team: dbPlayer.nfl_team || 'FA',
        number: dbPlayer.number || 0,
        age: dbPlayer.age || 0,
        height: dbPlayer.height || 0,
        weight: dbPlayer.weight || 0,
        college: dbPlayer.college || 'Unknown',
        playing_status: dbPlayer.playing_status || 'Active',
        injury_status: dbPlayer.injury_status,
        depth_chart: dbPlayer.depth_chart || 1,
        rostered_by: rosterInfo,
        availability_status,
        season_stats: seasonStats
      };

      setPlayer(playerDetail);
      console.log('Loaded player detail:', playerDetail);

      toast({
        title: 'Player Loaded',
        description: `Found ${playerDetail.player_name} with ${seasonStats.gamesPlayed} games of data`
      });

    } catch (error) {
      console.error('Error fetching player data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch player data';
      setError(errorMessage);
      toast({
        title: 'Error Loading Player',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playerId && currentSeasonConfig) {
      fetchPlayerData();
    }
  }, [playerId, selectedSeason, selectedConference, currentSeasonConfig]);

  // Helper to get current NFL week (simplified - in real app might use external API)
  const getCurrentWeek = (): number => {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // Rough start of NFL season (September 1)
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weeksSinceStart + 1, 1), 17);
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status || status === 'Healthy') return null;

    const variants: {[key: string]: 'default' | 'destructive' | 'secondary' | 'outline';} = {
      'IR': 'destructive',
      'Out': 'destructive',
      'Doubtful': 'destructive',
      'Questionable': 'secondary',
      'Probable': 'secondary',
      'Q': 'secondary',
      'D': 'destructive',
      'O': 'destructive'
    };

    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading player data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Link to="/players">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Players
          </Button>
        </Link>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        
        <div className="text-center">
          <Button onClick={fetchPlayerData} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // No player found
  if (!player) {
    return (
      <div className="space-y-6">
        <Link to="/players">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Players
          </Button>
        </Link>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Player not found or not available in the current season configuration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/players">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Players
        </Button>
      </Link>

      {/* Player Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{player.player_name}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={getPositionColor(player.position)}>
                {player.position}
              </Badge>
              <Badge variant="outline">{player.nfl_team} #{player.number}</Badge>
              {getInjuryBadge(player.injury_status)}
            </div>
            <p className="text-muted-foreground mt-1">
              {player.age} years old • {player.height}"", {player.weight} lbs • {player.college}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{player.season_stats.totalPoints.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Total Points</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{player.season_stats.avgPoints.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg/Game</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{player.season_stats.bestGame.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Best Game</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{player.season_stats.consistency.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground">Consistency</div>
          </div>
        </div>
      </div>

      {/* Current Team Info */}
      {player.rostered_by.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Currently rostered by:</p>
              {player.rostered_by.map((roster, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold">{roster.team_name}</p>
                      <span className="text-muted-foreground">•</span>
                      <p className="text-muted-foreground">{roster.owner_name}</p>
                    </div>
                    {player.rostered_by.length > 1 && (
                      <p className="text-sm text-blue-600">{roster.conference_name}</p>
                    )}
                  </div>
                  <Link to={`/teams/${roster.team_id}`}>
                    <Button variant="outline" size="sm">
                      View Team
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5" />
                  <span>Season Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Fantasy Points</p>
                    <p className="text-2xl font-bold">{player.season_stats.totalPoints.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Games Played</p>
                    <p className="text-2xl font-bold">{player.season_stats.gamesPlayed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best Game</p>
                    <p className="text-2xl font-bold">{player.season_stats.bestGame.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Consistency</p>
                    <p className="text-2xl font-bold">{player.season_stats.consistency.toFixed(0)}%</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Availability Status</span>
                    <span className="capitalize">{player.availability_status.replace('_', ' ')}</span>
                  </div>
                  <Progress value={player.availability_status === 'multi_rostered' ? 100 : player.availability_status === 'rostered' ? 75 : 25} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Player Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Position</p>
                    <p className="font-medium">{player.position}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NFL Team</p>
                    <p className="font-medium">{player.nfl_team}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Number</p>
                    <p className="font-medium">#{player.number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Depth Chart</p>
                    <p className="font-medium">{player.depth_chart}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Height</p>
                    <p className="font-medium">{player.height}""</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Weight</p>
                    <p className="font-medium">{player.weight} lbs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">College</p>
                    <p className="font-medium">{player.college}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Age</p>
                    <p className="font-medium">{player.age}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Weekly Performance</span>
              </CardTitle>
              <CardDescription>
                Fantasy points by week across all leagues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {player.season_stats.weeklyPerformance.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead>Conference</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.season_stats.weeklyPerformance
                        .sort((a, b) => b.week - a.week)
                        .slice(0, 10)
                        .map((week, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">Week {week.week}</TableCell>
                          <TableCell>{week.conference_name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {week.points.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No performance data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Roster Information</CardTitle>
              <CardDescription>
                Current roster status across all conferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {player.rostered_by.length > 0 ? (
                <div className="space-y-4">
                  {player.rostered_by.map((roster, idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{roster.team_name}</h4>
                        <Badge variant="outline">{roster.conference_name}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Owner</p>
                          <p className="font-medium">{roster.owner_name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Roster ID</p>
                          <p className="font-medium">{roster.roster_id}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Player is currently a free agent</p>
                </div>
              )}
            </CardContent>
          </Card>

          {player.injury_status && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span>Injury Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-3 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                      Status: {player.injury_status}
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Player is currently listed with an injury designation. Monitor status updates.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerDetailPage;