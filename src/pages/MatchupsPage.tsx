import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import MatchupDataService, { MatchupData, LiveMatchupData } from '@/services/matchupDataService';
import MatchupCard from '@/components/matchups/MatchupCard';
import { 
  Swords, 
  Clock, 
  Users, 
  RefreshCw, 
  AlertCircle,
  Loader2,
  Calendar,
  Trophy
} from 'lucide-react';

const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { toast } = useToast();
  
  // State
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [matchupsData, setMatchupsData] = useState<MatchupData[]>([]);
  const [liveMatchupsData, setLiveMatchupsData] = useState<LiveMatchupData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingMatchups, setRefreshingMatchups] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // Get weeks data
  const weeks = MatchupDataService.getWeeksForSeason();
  const currentWeek = weeks.find(w => w.status === 'current')?.week || 1;

  // Set initial week to current week
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  // Load matchups data
  const loadMatchupsData = useCallback(async () => {
    if (!selectedSeason) return;

    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading matchups data...', { 
        selectedSeason, 
        selectedConference, 
        selectedWeek 
      });

      // Find the season ID based on selected season
      const seasonResponse = await window.ezsite.apis.tablePage(12818, {
        PageNo: 1,
        PageSize: 10,
        Filters: [{ name: 'season_year', op: 'Equal', value: selectedSeason }]
      });

      if (seasonResponse.error) {
        throw new Error(seasonResponse.error);
      }

      const season = seasonResponse.data?.List[0];
      if (!season) {
        throw new Error(`Season ${selectedSeason} not found`);
      }

      console.log('Found season:', season);

      // Get conference ID if one is selected
      let conferenceId: number | undefined;
      if (selectedConference) {
        const conference = currentSeasonConfig.conferences.find(c => c.id === selectedConference);
        if (conference) {
          // Find the conference in the database
          const conferenceResponse = await window.ezsite.apis.tablePage(12820, {
            PageNo: 1,
            PageSize: 1,
            Filters: [
              { name: 'league_id', op: 'Equal', value: conference.leagueId },
              { name: 'season_id', op: 'Equal', value: season.ID }
            ]
          });

          if (conferenceResponse.error) {
            throw new Error(conferenceResponse.error);
          }

          const dbConference = conferenceResponse.data?.List[0];
          if (dbConference) {
            conferenceId = dbConference.ID;
          }
        }
      }

      console.log('Conference ID:', conferenceId);

      // Load matchups using our service
      const matchups = await MatchupDataService.getMatchupsData(
        season.ID,
        conferenceId,
        selectedWeek
      );

      console.log('Loaded matchups:', matchups);
      setMatchupsData(matchups);

      // Load live data for each matchup
      await loadLiveDataForMatchups(matchups);

    } catch (error) {
      console.error('Error loading matchups:', error);
      setError(error instanceof Error ? error.message : 'Failed to load matchups');
      toast({
        title: 'Error Loading Matchups',
        description: error instanceof Error ? error.message : 'Failed to load matchups',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedSeason, selectedConference, selectedWeek, currentSeasonConfig, toast]);

  // Load live data for matchups
  const loadLiveDataForMatchups = async (matchups: MatchupData[]) => {
    console.log('Loading live data for matchups...');
    const liveData: LiveMatchupData[] = [];

    for (const matchup of matchups) {
      try {
        const liveMatchup = await MatchupDataService.getLiveMatchupData(matchup);
        liveData.push(liveMatchup);
      } catch (error) {
        console.error('Error loading live data for matchup:', matchup.id, error);
        // Create a fallback live matchup without Sleeper data
        liveData.push({
          ...matchup,
          team1Roster: {
            teamId: matchup.team1.id,
            rosterId: matchup.team1.rosterId,
            totalPoints: 0,
            starters: [],
            bench: []
          },
          team2Roster: {
            teamId: matchup.team2.id,
            rosterId: matchup.team2.rosterId,
            totalPoints: 0,
            starters: [],
            bench: []
          },
          status: 'upcoming'
        });
      }
    }

    console.log('Live matchups data:', liveData);
    setLiveMatchupsData(liveData);
  };

  // Refresh specific matchup
  const refreshMatchup = async (matchupId: number) => {
    const matchup = matchupsData.find(m => m.id === matchupId);
    if (!matchup) return;

    setRefreshingMatchups(prev => new Set([...prev, matchupId]));

    try {
      const updatedLiveMatchup = await MatchupDataService.getLiveMatchupData(matchup);
      
      setLiveMatchupsData(prev => 
        prev.map(m => m.id === matchupId ? updatedLiveMatchup : m)
      );

      toast({
        title: 'Matchup Refreshed',
        description: `Updated data for ${matchup.team1.name} vs ${matchup.team2.name}`,
      });
    } catch (error) {
      console.error('Error refreshing matchup:', error);
      toast({
        title: 'Refresh Failed',
        description: error instanceof Error ? error.message : 'Failed to refresh matchup',
        variant: 'destructive'
      });
    } finally {
      setRefreshingMatchups(prev => {
        const next = new Set(prev);
        next.delete(matchupId);
        return next;
      });
    }
  };

  // Refresh all matchups
  const refreshAllMatchups = async () => {
    if (matchupsData.length === 0) return;
    
    setLoading(true);
    try {
      await loadLiveDataForMatchups(matchupsData);
      toast({
        title: 'All Matchups Refreshed',
        description: 'Updated live data for all matchups',
      });
    } catch (error) {
      console.error('Error refreshing all matchups:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh all matchups',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data when dependencies change
  useEffect(() => {
    loadMatchupsData();
  }, [loadMatchupsData]);

  // Get the selected conference name
  const selectedConferenceName = selectedConference
    ? currentSeasonConfig.conferences.find(c => c.id === selectedConference)?.name
    : 'All Conferences';

  const getWeekStatus = (weekNum: number) => {
    const weekData = weeks.find(w => w.week === weekNum);
    return weekData?.status || 'upcoming';
  };

  const liveMatchupsCount = liveMatchupsData.filter(m => m.status === 'live').length;
  const completedMatchupsCount = liveMatchupsData.filter(m => m.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Week {selectedWeek} • {selectedConferenceName}
        </p>
      </div>

      {/* Controls and Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Week Selector */}
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week) => (
                <SelectItem key={week.week} value={week.week.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>Week {week.week}</span>
                    {week.status === 'current' && (
                      <Badge variant="outline" className="text-xs">Current</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Current Week Indicator */}
          {getWeekStatus(selectedWeek) === 'current' && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Current Week</span>
            </div>
          )}

          {/* Refresh All Button */}
          {liveMatchupsData.length > 0 && getWeekStatus(selectedWeek) !== 'upcoming' && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAllMatchups}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh All</span>
            </Button>
          )}
        </div>

        {/* Summary Stats */}
        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{liveMatchupsData.length} matchups</span>
          </div>
          {liveMatchupsCount > 0 && (
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4 text-green-500" />
              <span>{liveMatchupsCount} live</span>
            </div>
          )}
          {completedMatchupsCount > 0 && (
            <div className="flex items-center space-x-1">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span>{completedMatchupsCount} completed</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && liveMatchupsData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading matchups...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium mb-2">Error Loading Matchups</p>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadMatchupsData} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Matchups Grid */}
      {!loading && !error && (
        <div className="space-y-4">
          {liveMatchupsData.map((matchup) => (
            <MatchupCard
              key={matchup.id}
              matchup={matchup}
              onRefresh={refreshMatchup}
              isRefreshing={refreshingMatchups.has(matchup.id)}
            />
          ))}

          {liveMatchupsData.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">No Matchups Found</p>
                <p className="text-sm text-muted-foreground">
                  No matchups found for Week {selectedWeek} in {selectedConferenceName}.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try selecting a different week or conference.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchupsPage;