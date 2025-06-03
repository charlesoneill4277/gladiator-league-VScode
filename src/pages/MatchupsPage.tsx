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
        return <Badge className="bg-green-500 hover:bg-green-600" data-id="ooab5dejh">Live</Badge>;
      case 'completed':
        return <Badge variant="secondary" data-id="cdv13bvo8">Final</Badge>;
      case 'upcoming':
        return <Badge variant="outline" data-id="gakcaw0f4">Upcoming</Badge>;
      default:
        return <Badge variant="secondary" data-id="i0vttrbpn">{status}</Badge>;
    }
  };

  const getWeekStatus = (weekNum: number) => {
    const weekData = weeks.find((w) => w.week === weekNum);
    return weekData?.status || 'upcoming';
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6" data-id="qb0u5bgjb">
        <div className="flex items-center space-x-2" data-id="zhg2u37eu">
          <Swords className="h-6 w-6 text-primary" data-id="lgezmyn0s" />
          <h1 className="text-3xl font-bold" data-id="56lz8299k">Matchups</h1>
        </div>
        <div className="flex items-center justify-center py-12" data-id="yvdsosa2v">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" data-id="0mv8ztyuo" />
          <span className="ml-2 text-lg" data-id="ifczjhacz">Loading matchups...</span>
        </div>
      </div>);

  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6" data-id="wdsrk33fw">
        <div className="flex items-center space-x-2" data-id="9jpl8pqas">
          <Swords className="h-6 w-6 text-primary" data-id="0bdjrd1ld" />
          <h1 className="text-3xl font-bold" data-id="uu2cqgest">Matchups</h1>
        </div>
        <Card data-id="oe48nruqe">
          <CardContent className="py-8 text-center" data-id="kisspey7i">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" data-id="6sghxwd4u" />
            <h3 className="text-lg font-semibold mb-2" data-id="ugz7s1aqp">Error Loading Matchups</h3>
            <p className="text-muted-foreground mb-4" data-id="3clfodks1">{error}</p>
            <Button onClick={refreshMatchups} variant="outline" data-id="78af9pdvg">
              <RefreshCw className="h-4 w-4 mr-2" data-id="felwjl5t2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="space-y-6" data-id="wmdmytw8s">
      {/* Page Header */}
      <div className="flex flex-col space-y-2" data-id="o7gvharjz">
        <div className="flex items-center space-x-2" data-id="7kfzqkeej">
          <Swords className="h-6 w-6 text-primary" data-id="ytmfxyb39" />
          <h1 className="text-3xl font-bold" data-id="05pmaupob">Matchups</h1>
        </div>
        <p className="text-muted-foreground" data-id="jshkrcoru">
          {selectedSeason} Season • Week {selectedWeek} • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          }
        </p>
      </div>

      {/* Week Selector and Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-id="1t7n827fk">
        <div className="flex items-center space-x-4" data-id="d710j9pmq">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))} data-id="gthchadpq">
            <SelectTrigger className="w-32" data-id="v5yv08lom">
              <SelectValue data-id="raliz0kiv" />
            </SelectTrigger>
            <SelectContent data-id="0c2yhfjh9">
              {weeks.map((week) =>
              <SelectItem key={week.week} value={week.week.toString()} data-id="aj9tpa62d">
                  <div className="flex items-center space-x-2" data-id="wq467l0lg">
                    <span data-id="d4sywt9m9">Week {week.week}</span>
                    {week.status === 'current' && <Badge variant="outline" className="text-xs" data-id="044mz5qyd">Current</Badge>}
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshMatchups}
            disabled={loading} data-id="x2u4802qn">

            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} data-id="odu4tbjai" />
            Refresh
          </Button>

          {getWeekStatus(selectedWeek) === 'current' &&
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-id="moxnbewyr">
              <Clock className="h-4 w-4" data-id="ulin34hv6" />
              <span data-id="cv89ccrqx">Games in progress</span>
            </div>
          }
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground" data-id="7o7uwas2r">
          <div className="flex items-center space-x-1" data-id="jhggx5vub">
            <Users className="h-4 w-4" data-id="4zfg01czn" />
            <span data-id="32biszag2">{filteredMatchups.length} matchups</span>
          </div>
        </div>
      </div>

      {/* Matchups Grid */}
      <div className="grid gap-4" data-id="utlydausf">
        {filteredMatchups.map((matchup) =>
        <Card key={matchup.id} className="hover:shadow-md transition-shadow" data-id="r8pbeto7m">
            <Collapsible data-id="icna7eg8v">
              <CollapsibleTrigger
              className="w-full"
              onClick={() => toggleMatchupExpansion(matchup.id)} data-id="94zyicaky">

                <CardHeader className="pb-4" data-id="ydazg37rk">
                  <div className="flex items-center justify-between" data-id="2ase55pje">
                    <div className="flex items-center space-x-2" data-id="7m9g9ev1i">
                      <CardTitle className="text-lg" data-id="ciarba8ta">
                        {matchup.conference}
                      </CardTitle>
                      {getStatusBadge(matchup.status)}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                  expandedMatchups.has(matchup.id) ? 'rotate-180' : ''}`
                  } data-id="1guyqull6" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CardContent className="pt-0" data-id="ifkqxjzsy">
                {/* Matchup Summary */}
                <div className="grid grid-cols-3 gap-4 items-center" data-id="jeaq4ekdo">
                  {/* Home Team */}
                  <div className="text-right space-y-1" data-id="a0nvga7n0">
                    <div className="font-semibold" data-id="46gahhqru">{matchup.homeTeam.name}</div>
                    <div className="text-sm text-muted-foreground" data-id="gstjbhnbv">{matchup.homeTeam.owner}</div>
                    <div className="text-2xl font-bold" data-id="17snali14">
                      {matchup.status === 'upcoming' ? '--' : matchup.homeTeam.score.toFixed(1)}
                    </div>
                    {matchup.status !== 'upcoming' &&
                  <div className="text-xs text-muted-foreground" data-id="8e5xc3jez">
                        Proj: {matchup.homeTeam.projected.toFixed(1)}
                      </div>
                  }
                  </div>

                  {/* VS Divider */}
                  <div className="text-center" data-id="ja7u3pn4k">
                    <div className="text-lg font-semibold text-muted-foreground" data-id="gzpkpniht">VS</div>
                    {matchup.status === 'completed' &&
                  <Trophy className="h-6 w-6 mx-auto mt-2 text-yellow-500" data-id="7bb31exel" />
                  }
                  </div>

                  {/* Away Team */}
                  <div className="text-left space-y-1" data-id="r3w87bbr6">
                    <div className="font-semibold" data-id="f5q00sfsc">{matchup.awayTeam.name}</div>
                    <div className="text-sm text-muted-foreground" data-id="cle14eb2w">{matchup.awayTeam.owner}</div>
                    <div className="text-2xl font-bold" data-id="wy85b53yw">
                      {matchup.status === 'upcoming' ? '--' : matchup.awayTeam.score.toFixed(1)}
                    </div>
                    {matchup.status !== 'upcoming' &&
                  <div className="text-xs text-muted-foreground" data-id="z8utkwb9m">
                        Proj: {matchup.awayTeam.projected.toFixed(1)}
                      </div>
                  }
                  </div>
                </div>

                {/* Expanded Content */}
                <CollapsibleContent className="mt-6" data-id="zdxvc7tp3">
                  <div className="border-t pt-4 space-y-4" data-id="83v9h5odh">
                    {/* Enhanced Roster Display */}
                  <MatchupRosterDisplay
                    leagueId={(() => {
                      // Find the league ID for this matchup's conference
                      const conferenceMapping: {[key: string]: string} = {
                        'Legions of Mars': 'mars',
                        'Guardians of Jupiter': 'jupiter',
                        "Vulcan's Oathsworn": 'vulcan'
                      };
                      const conferenceKey = conferenceMapping[matchup.conference];
                      return currentSeasonConfig.conferences.find(c => c.id === conferenceKey)?.leagueId || '';
                    })()} 
                    week={selectedWeek}
                    matchupId={parseInt(matchup.id)}
                    conferenceId={(() => {
                      const conferenceMapping: {[key: string]: string} = {
                        'Legions of Mars': 'mars',
                        'Guardians of Jupiter': 'jupiter',
                        "Vulcan's Oathsworn": 'vulcan'
                      };
                      return conferenceMapping[matchup.conference];
                    })()} 
                  />

                    {/* Matchup Stats */}
                    {matchup.status !== 'upcoming' &&
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center" data-id="bxq5vxe3m">
                        <div data-id="bonc92o6y">
                          <div className="text-sm text-muted-foreground" data-id="ug7oqoecj">Total Points</div>
                          <div className="font-semibold" data-id="ez0f9ju66">
                            {(matchup.homeTeam.score + matchup.awayTeam.score).toFixed(1)}
                          </div>
                        </div>
                        <div data-id="kwr95miid">
                          <div className="text-sm text-muted-foreground" data-id="a2zdq6fw4">Point Spread</div>
                          <div className="font-semibold" data-id="bd778q0xr">
                            {Math.abs(matchup.homeTeam.score - matchup.awayTeam.score).toFixed(1)}
                          </div>
                        </div>
                        <div data-id="lw01r52qj">
                          <div className="text-sm text-muted-foreground" data-id="nzndhwdtx">Last Updated</div>
                          <div className="text-xs" data-id="9uqrtybuk">
                            {matchup.lastUpdate ? new Date(matchup.lastUpdate).toLocaleTimeString() : 'N/A'}
                          </div>
                        </div>
                        <div data-id="v7q0m6ccy">
                          <div className="text-sm text-muted-foreground" data-id="w9vu9apgk">Status</div>
                          <div className="text-xs" data-id="05nci1wpl">{matchup.status}</div>
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
        <Card data-id="7zfpixqvt">
            <CardContent className="py-8 text-center" data-id="m1lsrj2kg">
              <p className="text-muted-foreground" data-id="urc1irm8o">No matchups found for the selected filters.</p>
            </CardContent>
          </Card>
        }
      </div>
    </div>);

};

export default MatchupsPage;