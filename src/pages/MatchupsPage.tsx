import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, Activity, AlertCircle, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LiveMatchupService, { LiveMatchupData, MatchupSummary } from '../services/liveMatchupService';
import MatchupDataService from '../services/matchupDataService';

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  
  // State management
  const [selectedWeek, setSelectedWeek] = useState<number>(14);
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  const [liveMatchups, setLiveMatchups] = useState<LiveMatchupData[]>([]);
  const [matchupSummary, setMatchupSummary] = useState<MatchupSummary | null>(null);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Service instances
  const liveMatchupService = LiveMatchupService.getInstance();
  const matchupDataService = MatchupDataService.getInstance();

  // Load available weeks on component mount
  useEffect(() => {
    loadAvailableWeeks();
  }, []);

  // Load matchups when week changes
  useEffect(() => {
    if (selectedWeek) {
      loadMatchupsForWeek(selectedWeek);
    }
  }, [selectedWeek]);

  /**
   * Load available weeks from database
   */
  const loadAvailableWeeks = async () => {
    try {
      const weeks = await matchupDataService.getAvailableWeeks();
      setAvailableWeeks(weeks);
      
      // Set current week if not already set
      if (weeks.length > 0 && !selectedWeek) {
        setSelectedWeek(Math.max(...weeks));
      }
    } catch (error) {
      console.error('❌ Error loading available weeks:', error);
      toast({
        title: "Error Loading Weeks",
        description: "Failed to load available weeks. Using default values.",
        variant: "destructive"
      });
      // Fallback to default weeks
      setAvailableWeeks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    }
  };

  /**
   * Load live matchups for a specific week
   */
  const loadMatchupsForWeek = async (week: number, forceRefresh = false) => {
    try {
      setIsLoading(true);
      if (forceRefresh) {
        setIsRefreshing(true);
        await liveMatchupService.forceRefresh();
      }

      console.log(`🔄 Loading matchups for week ${week}`);

      // Get live matchups and summary
      const [matchups, summary] = await Promise.all([
        liveMatchupService.getLiveMatchupsForWeek(week),
        liveMatchupService.getMatchupSummary(week)
      ]);

      setLiveMatchups(matchups);
      setMatchupSummary(summary);
      setLastRefresh(new Date());

      console.log(`✅ Loaded ${matchups.length} matchups with ${summary.live_matchups} live`);

      if (forceRefresh) {
        toast({
          title: "Data Refreshed",
          description: `Updated matchups for week ${week}. ${summary.live_matchups} live games found.`,
        });
      }
    } catch (error) {
      console.error('❌ Error loading matchups:', error);
      toast({
        title: "Error Loading Matchups",
        description: error instanceof Error ? error.message : "Failed to load matchup data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Handle manual refresh
   */
  const handleRefresh = () => {
    loadMatchupsForWeek(selectedWeek, true);
  };

  /**
   * Filter matchups based on selected conference
   */
  const filteredMatchups = liveMatchups.filter((liveMatchup) => {
    if (!selectedConference) return true;
    
    const conference = currentSeasonConfig.conferences.find((c) => c.id === selectedConference);
    return liveMatchup.matchup.conference_name === conference?.name;
  });

  /**
   * Toggle matchup expansion
   */
  const toggleMatchupExpansion = (matchupId: number) => {
    const newExpanded = new Set(expandedMatchups);
    if (newExpanded.has(matchupId)) {
      newExpanded.delete(matchupId);
    } else {
      newExpanded.add(matchupId);
    }
    setExpandedMatchups(newExpanded);
  };

  /**
   * Get status badge for matchup
   */
  const getStatusBadge = (liveMatchupData: LiveMatchupData) => {
    if (liveMatchupData.error) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Error
      </Badge>;
    }
    
    if (liveMatchupData.is_live) {
      return <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
        <Activity className="h-3 w-3" />
        Live
      </Badge>;
    }
    
    const hasScoring = liveMatchupData.team_1_scoring || liveMatchupData.team_2_scoring;
    if (hasScoring) {
      return <Badge variant="secondary">Final</Badge>;
    }
    
    return <Badge variant="outline">Upcoming</Badge>;
  };

  /**
   * Format player scoring data for display
   */
  const renderPlayerScoring = (liveMatchupData: LiveMatchupData, teamNumber: 1 | 2) => {
    const scoring = teamNumber === 1 ? liveMatchupData.team_1_scoring : liveMatchupData.team_2_scoring;
    
    if (!scoring) {
      return (
        <div className="text-sm text-muted-foreground">
          No scoring data available
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total Points:</span>
          <span className="text-lg font-bold">{scoring.team_points.toFixed(1)}</span>
        </div>
        
        <div className="space-y-1">
          <div className="text-sm font-medium">Starters:</div>
          {scoring.starters.slice(0, 5).map((starter, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span>{liveMatchupService.getPlayerName(starter.playerId)} ({starter.position})</span>
              <span>{starter.points.toFixed(1)} pts</span>
            </div>
          ))}
          {scoring.starters.length > 5 && (
            <div className="text-xs text-muted-foreground">
              +{scoring.starters.length - 5} more starters
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Live Matchups</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {selectedWeek} • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          }
        </p>
      </div>

      {/* Controls and Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Week Selector */}
          <Select 
            value={selectedWeek.toString()} 
            onValueChange={(value) => setSelectedWeek(parseInt(value))}
            disabled={isLoading}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableWeeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          {matchupSummary && (
            <>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{matchupSummary.total_matchups} matchups</span>
              </div>
              
              {matchupSummary.live_matchups > 0 && (
                <div className="flex items-center space-x-1 text-green-600">
                  <Zap className="h-4 w-4" />
                  <span>{matchupSummary.live_matchups} live</span>
                </div>
              )}
              
              {matchupSummary.failed_matchups > 0 && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{matchupSummary.failed_matchups} errors</span>
                </div>
              )}
            </>
          )}

          {lastRefresh && (
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Updated {lastRefresh.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <p className="text-muted-foreground">Loading live matchup data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matchups Grid */}
      {!isLoading && (
        <div className="grid gap-4">
          {filteredMatchups.map((liveMatchupData) => {
            const { matchup } = liveMatchupData;
            const isExpanded = expandedMatchups.has(matchup.id);
            
            return (
              <Card key={matchup.id} className="hover:shadow-md transition-shadow">
                <Collapsible>
                  <CollapsibleTrigger
                    className="w-full"
                    onClick={() => toggleMatchupExpansion(matchup.id)}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg">
                            {matchup.conference_name}
                          </CardTitle>
                          {getStatusBadge(liveMatchupData)}
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CardContent className="pt-0">
                    {/* Matchup Summary */}
                    <div className="grid grid-cols-3 gap-4 items-center">
                      {/* Team 1 */}
                      <div className="text-right space-y-1">
                        <div className="font-semibold">{matchup.team_1.team_name}</div>
                        <div className="text-sm text-muted-foreground">{matchup.team_1.owner_name}</div>
                        <div className="text-2xl font-bold">
                          {liveMatchupData.team_1_scoring 
                            ? liveMatchupData.team_1_scoring.team_points.toFixed(1)
                            : '--'
                          }
                        </div>
                        {liveMatchupData.error && (
                          <div className="text-xs text-red-500">
                            Data Error
                          </div>
                        )}
                      </div>

                      {/* VS Divider */}
                      <div className="text-center">
                        <div className="text-lg font-semibold text-muted-foreground">VS</div>
                        {liveMatchupData.is_live && !liveMatchupData.error && (
                          <Activity className="h-6 w-6 mx-auto mt-2 text-green-500" />
                        )}
                        {liveMatchupData.error && (
                          <AlertCircle className="h-6 w-6 mx-auto mt-2 text-red-500" />
                        )}
                      </div>

                      {/* Team 2 */}
                      <div className="text-left space-y-1">
                        <div className="font-semibold">{matchup.team_2.team_name}</div>
                        <div className="text-sm text-muted-foreground">{matchup.team_2.owner_name}</div>
                        <div className="text-2xl font-bold">
                          {liveMatchupData.team_2_scoring 
                            ? liveMatchupData.team_2_scoring.team_points.toFixed(1)
                            : '--'
                          }
                        </div>
                        {liveMatchupData.error && (
                          <div className="text-xs text-red-500">
                            Data Error
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Error Display */}
                    {liveMatchupData.error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <div className="text-sm text-red-700">
                            <div className="font-medium">Error loading live data:</div>
                            <div>{liveMatchupData.error}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expanded Content */}
                    <CollapsibleContent className="mt-6">
                      <div className="border-t pt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Team 1 Scoring Details */}
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center justify-between">
                                {matchup.team_1.team_name} 
                                <span className="text-xs text-muted-foreground">
                                  Roster ID: {matchup.team_1.roster_id || 'N/A'}
                                </span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {renderPlayerScoring(liveMatchupData, 1)}
                            </CardContent>
                          </Card>

                          {/* Team 2 Scoring Details */}
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center justify-between">
                                {matchup.team_2.team_name}
                                <span className="text-xs text-muted-foreground">
                                  Roster ID: {matchup.team_2.roster_id || 'N/A'}
                                </span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {renderPlayerScoring(liveMatchupData, 2)}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Matchup Stats */}
                        {(liveMatchupData.team_1_scoring || liveMatchupData.team_2_scoring) && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                              <div className="text-sm text-muted-foreground">Total Points</div>
                              <div className="font-semibold">
                                {(
                                  (liveMatchupData.team_1_scoring?.team_points || 0) +
                                  (liveMatchupData.team_2_scoring?.team_points || 0)
                                ).toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Point Spread</div>
                              <div className="font-semibold">
                                {Math.abs(
                                  (liveMatchupData.team_1_scoring?.team_points || 0) -
                                  (liveMatchupData.team_2_scoring?.team_points || 0)
                                ).toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">League ID</div>
                              <div className="text-xs font-mono">
                                {matchup.league_id}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Last Updated</div>
                              <div className="text-xs">
                                {liveMatchupData.last_updated.toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              </Card>
            );
          })}

          {/* No Matchups Found */}
          {filteredMatchups.length === 0 && !isLoading && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No matchups found for the selected filters.
                </p>
                {availableWeeks.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Try loading some matchup data first.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchupsPage;