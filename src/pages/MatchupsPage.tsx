import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { matchupService, LiveMatchupData } from '@/services/matchupService';
import PlayerRoster from '@/components/matchups/PlayerRoster';
import { useToast } from '@/hooks/use-toast';

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<number>(14);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());
  const [matchups, setMatchups] = useState<LiveMatchupData[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<{ week: number; status: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Load available weeks on component mount
  useEffect(() => {
    const loadWeeks = async () => {
      try {
        const weeks = await matchupService.getAvailableWeeks();
        setAvailableWeeks(weeks);
        
        // Set current week as default
        const currentWeek = weeks.find(w => w.status === 'current');
        if (currentWeek) {
          setSelectedWeek(currentWeek.week);
        }
      } catch (error) {
        console.error('Error loading weeks:', error);
      }
    };
    
    loadWeeks();
  }, []);

  // Load matchups when week or conference changes
  useEffect(() => {
    loadMatchups();
  }, [selectedWeek, selectedConference]);

  const loadMatchups = async () => {
    if (!selectedWeek) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Loading matchups for week ${selectedWeek}, conference: ${selectedConference || 'all'}`);
      const data = await matchupService.getMatchupsForWeek(selectedWeek, selectedConference || undefined);
      setMatchups(data);
      setLastRefresh(new Date());
      
      if (data.length === 0) {
        toast({
          title: "No matchups found",
          description: `No matchups available for week ${selectedWeek}`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error loading matchups:', error);
      setError(error instanceof Error ? error.message : 'Failed to load matchups');
      toast({
        title: "Error loading matchups",
        description: "Failed to fetch matchup data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter matchups based on selected conference
  const filteredMatchups = matchups.filter((matchup) => {
    if (!selectedConference) return true;
    return matchup.conference.id === selectedConference;
  });

  const toggleMatchupExpansion = (matchupId: string) => {
    const newExpanded = new Set(expandedMatchups);
    if (newExpanded.has(matchupId)) {
      newExpanded.delete(matchupId);
    } else {
      newExpanded.add(matchupId);
    }
    setExpandedMatchups(newExpanded);
  };

  const getStatusBadge = (status: string) => {
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

  const getWeekStatus = (weekNum: number) => {
    const weekData = availableWeeks.find((w) => w.week === weekNum);
    return weekData?.status || 'upcoming';
  };

  const refreshMatchups = () => {
    loadMatchups();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {selectedWeek} • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          } {lastRefresh && (
            <span className="ml-2 text-xs">
              • Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      {/* Week Selector and Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableWeeks.map((week) =>
              <SelectItem key={week.week} value={week.week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week.week}</span>
                    {week.status === 'current' && <Badge variant="outline" className="text-xs">Current</Badge>}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshMatchups}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {getWeekStatus(selectedWeek) === 'current' &&
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Games in progress</span>
            </div>
          }
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{filteredMatchups.length} matchups</span>
          </div>
          {loading && (
            <div className="flex items-center space-x-1">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error loading matchups</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={refreshMatchups}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Matchups Grid */}
      <div className="grid gap-4">
        {filteredMatchups.map((matchup) =>
        <Card key={matchup.id} className="hover:shadow-md transition-shadow">
            <Collapsible>
              <CollapsibleTrigger
              className="w-full"
              onClick={() => toggleMatchupExpansion(matchup.id)}>

                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg">
                        {matchup.conference.name}
                      </CardTitle>
                      {getStatusBadge(matchup.status)}
                      {matchup.isPlayoff && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          Playoff
                        </Badge>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                  expandedMatchups.has(matchup.id) ? 'rotate-180' : ''
                  }` } />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CardContent className="pt-0">
                {/* Matchup Summary */}
                <div className="grid grid-cols-3 gap-4 items-center">
                  {/* Home Team */}
                  <div className="text-right space-y-1">
                    <div className="font-semibold">{matchup.homeTeam.name}</div>
                    <div className="text-sm text-muted-foreground">{matchup.homeTeam.owner}</div>
                    <div className="text-2xl font-bold">
                      {matchup.status === 'upcoming' ? '--' : matchup.homeTeam.score > 0 ? matchup.homeTeam.score.toFixed(1) : '0.0'}
                    </div>
                    {matchup.homeTeam.projected > 0 &&
                  <div className="text-xs text-muted-foreground">
                        Proj: {matchup.homeTeam.projected.toFixed(1)}
                      </div>
                  }
                  </div>

                  {/* VS Divider */}
                  <div className="text-center">
                    <div className="text-lg font-semibold text-muted-foreground">VS</div>
                    {matchup.status === 'completed' && (
                      <Trophy className={`h-6 w-6 mx-auto mt-2 ${
                        matchup.homeTeam.score > matchup.awayTeam.score ? 'text-yellow-500' : 'text-gray-400'
                      }`} />
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="text-left space-y-1">
                    <div className="font-semibold">{matchup.awayTeam.name}</div>
                    <div className="text-sm text-muted-foreground">{matchup.awayTeam.owner}</div>
                    <div className="text-2xl font-bold">
                      {matchup.status === 'upcoming' ? '--' : matchup.awayTeam.score > 0 ? matchup.awayTeam.score.toFixed(1) : '0.0'}
                    </div>
                    {matchup.awayTeam.projected > 0 &&
                  <div className="text-xs text-muted-foreground">
                        Proj: {matchup.awayTeam.projected.toFixed(1)}
                      </div>
                  }
                  </div>
                </div>

                {/* Expanded Content */}
                <CollapsibleContent className="mt-6">
                  <div className="border-t pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Home Team Roster */}
                      <PlayerRoster 
                        teamName={matchup.homeTeam.name}
                        starters={matchup.homeTeam.starters}
                        bench={matchup.homeTeam.bench}
                        totalScore={matchup.homeTeam.score}
                        projectedScore={matchup.homeTeam.projected}
                      />

                      {/* Away Team Roster */}
                      <PlayerRoster 
                        teamName={matchup.awayTeam.name}
                        starters={matchup.awayTeam.starters}
                        bench={matchup.awayTeam.bench}
                        totalScore={matchup.awayTeam.score}
                        projectedScore={matchup.awayTeam.projected}
                      />
                    </div>

                    {/* Matchup Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Points</div>
                        <div className="font-semibold">
                          {matchup.status === 'upcoming' ? '--' : 
                           (matchup.homeTeam.score + matchup.awayTeam.score).toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Point Spread</div>
                        <div className="font-semibold">
                          {matchup.status === 'upcoming' ? '--' : 
                           Math.abs(matchup.homeTeam.score - matchup.awayTeam.score).toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Season</div>
                        <div className="text-xs">{matchup.season.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">League ID</div>
                        <div className="text-xs font-mono">{matchup.conference.league_id}</div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Collapsible>
          </Card>
        )}

        {filteredMatchups.length === 0 && !loading &&
        <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No matchups found for the selected filters.</p>
              <Button variant="outline" className="mt-4" onClick={refreshMatchups}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        }
      </div>
    </div>);

};

export default MatchupsPage;