import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useApp } from '@/contexts/AppContext';
import { useMatchups } from '@/hooks/useMatchups';
import { Swords, ChevronDown, Clock, Trophy, Users, RefreshCw, AlertCircle } from 'lucide-react';
import MatchupRosterDisplay from '@/components/matchups/MatchupRosterDisplay';



const MatchupsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { matchups, weeks, currentWeek, loading, error, refreshMatchups } = useMatchups(selectedSeason, selectedConference);
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [expandedMatchups, setExpandedMatchups] = useState<Set<string>>(new Set());

  // Update selectedWeek when currentWeek changes
  React.useEffect(() => {
    if (currentWeek > 0) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek]);

  // Filter matchups based on selected week (conference filtering is handled in the hook)
  const filteredMatchups = matchups.filter((matchup) => {
    return matchup.week === selectedWeek;
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
    const weekData = weeks.find((w) => w.week === weekNum);
    return weekData?.status || 'upcoming';
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading matchups...</span>
        </div>
      </div>);

  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Matchups</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Matchups</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={refreshMatchups} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>);

  }

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
          }
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
              {weeks.map((week) =>
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
            disabled={loading}>

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
        </div>
      </div>

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
                        {matchup.conference}
                      </CardTitle>
                      {getStatusBadge(matchup.status)}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                  expandedMatchups.has(matchup.id) ? 'rotate-180' : ''}`
                  } />
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
                      {matchup.status === 'upcoming' ? '--' : matchup.homeTeam.score.toFixed(1)}
                    </div>
                    {matchup.status !== 'upcoming' &&
                  <div className="text-xs text-muted-foreground">
                        Proj: {matchup.homeTeam.projected.toFixed(1)}
                      </div>
                  }
                  </div>

                  {/* VS Divider */}
                  <div className="text-center">
                    <div className="text-lg font-semibold text-muted-foreground">VS</div>
                    {matchup.status === 'completed' &&
                  <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" />
                  }
                  </div>

                  {/* Away Team */}
                  <div className="text-left space-y-1">
                    <div className="font-semibold">{matchup.awayTeam.name}</div>
                    <div className="text-sm text-muted-foreground">{matchup.awayTeam.owner}</div>
                    <div className="text-2xl font-bold">
                      {matchup.status === 'upcoming' ? '--' : matchup.awayTeam.score.toFixed(1)}
                    </div>
                    {matchup.status !== 'upcoming' &&
                  <div className="text-xs text-muted-foreground">
                        Proj: {matchup.awayTeam.projected.toFixed(1)}
                      </div>
                  }
                  </div>
                </div>

                {/* Expanded Content */}
                <CollapsibleContent className="mt-6">
                  <div className="border-t pt-4 space-y-4">
                    {/* Enhanced Roster Display */}
                  <MatchupRosterDisplay
                    leagueId={(() => {
                      // Find the league ID for this matchup's conference
                      const conferenceMapping: {[key: string]: string;} = {
                        'Legions of Mars': 'mars',
                        'Guardians of Jupiter': 'jupiter',
                        "Vulcan's Oathsworn": 'vulcan'
                      };
                      const conferenceKey = conferenceMapping[matchup.conference];
                      return currentSeasonConfig.conferences.find((c) => c.id === conferenceKey)?.leagueId || '';
                    })()}
                    week={selectedWeek}
                    matchupId={parseInt(matchup.id)}
                    conferenceId={(() => {
                      const conferenceMapping: {[key: string]: string;} = {
                        'Legions of Mars': 'mars',
                        'Guardians of Jupiter': 'jupiter',
                        "Vulcan's Oathsworn": 'vulcan'
                      };
                      return conferenceMapping[matchup.conference];
                    })()} />


                    {/* Matchup Stats */}
                    {matchup.status !== 'upcoming' &&
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-sm text-muted-foreground">Total Points</div>
                          <div className="font-semibold">
                            {(matchup.homeTeam.score + matchup.awayTeam.score).toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Point Spread</div>
                          <div className="font-semibold">
                            {Math.abs(matchup.homeTeam.score - matchup.awayTeam.score).toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Last Updated</div>
                          <div className="text-xs">
                            {matchup.lastUpdate ? new Date(matchup.lastUpdate).toLocaleTimeString() : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Status</div>
                          <div className="text-xs">{matchup.status}</div>
                        </div>
                      </div>
                  }
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Collapsible>
          </Card>
        )}

        {filteredMatchups.length === 0 &&
        <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No matchups found for the selected filters.</p>
            </CardContent>
          </Card>
        }
      </div>
    </div>);

};

export default MatchupsPage;