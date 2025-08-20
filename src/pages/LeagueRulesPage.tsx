import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { useScoringSettings } from '@/hooks/useScoringSettings';
import { useRosterSettings } from '@/hooks/useRosterSettings';
import { usePlayoffFormat } from '@/hooks/usePlayoffFormat';
import { useCharter } from '@/hooks/useCharter';
import { CharterService } from '@/services/charterService';
import DocumentViewer from '@/components/charter/DocumentViewer';
import { FileText, Settings, Trophy, Users, DollarSign, Calendar, Info, Loader2, Download, ExternalLink } from 'lucide-react';

// Mock data for league rules - this will be replaced with real data and admin input
const mockLeagueRules = {
  scoring: {
    passing: {
      passingYards: { points: 1, per: 25, description: '1 point per 25 passing yards' },
      passingTDs: { points: 4, per: 1, description: '4 points per passing touchdown' },
      interceptions: { points: -2, per: 1, description: '-2 points per interception' },
      passing2pt: { points: 2, per: 1, description: '2 points per 2-point conversion' }
    },
    rushing: {
      rushingYards: { points: 1, per: 10, description: '1 point per 10 rushing yards' },
      rushingTDs: { points: 6, per: 1, description: '6 points per rushing touchdown' },
      rushing2pt: { points: 2, per: 1, description: '2 points per 2-point conversion' }
    },
    receiving: {
      receivingYards: { points: 1, per: 10, description: '1 point per 10 receiving yards' },
      receptions: { points: 0.5, per: 1, description: '0.5 points per reception (PPR)' },
      receivingTDs: { points: 6, per: 1, description: '6 points per receiving touchdown' },
      receiving2pt: { points: 2, per: 1, description: '2 points per 2-point conversion' }
    },
    kicking: {
      fieldGoals0_39: { points: 3, per: 1, description: '3 points per field goal (0-39 yards)' },
      fieldGoals40_49: { points: 4, per: 1, description: '4 points per field goal (40-49 yards)' },
      fieldGoals50Plus: { points: 5, per: 1, description: '5 points per field goal (50+ yards)' },
      extraPoints: { points: 1, per: 1, description: '1 point per extra point' },
      missedFieldGoals: { points: -1, per: 1, description: '-1 point per missed field goal' }
    }
  },
  roster: {
    positions: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1, // RB/WR/TE
      K: 1,
      DEF: 1,
      BENCH: 6
    },
    totalRosterSize: 15,
    irSlots: 2,
    waiverSystem: 'FAAB',
    waiverBudget: 100,
    waiverClearTime: 'Wednesday 3:00 AM ET'
  },
  schedule: {
    regularSeasonWeeks: 14,
    playoffWeeks: 3,
    playoffTeams: 6,
    tradeDeadline: 'Week 11',
    seasonStart: '2024-09-05',
    playoffStart: '2024-12-17'
  },
  payouts: {
    entryFee: 50,
    totalPot: 600, // 12 teams * $50
    firstPlace: 300,
    secondPlace: 180,
    thirdPlace: 90,
    regularSeasonChamp: 30
  }
};

const LeagueRulesPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const { scoringSettings, loading: scoringLoading, error: scoringError } = useScoringSettings();
  const { rosterSettings, loading: rosterLoading, error: rosterError } = useRosterSettings();
  const { playoffFormat, loading: playoffLoading, error: playoffError } = usePlayoffFormat();
  const { charterInfo, loading: charterLoading, error: charterError, hasCharter } = useCharter();
  const [activeTab, setActiveTab] = useState('scoring');

  const renderScoringTable = (category: string, rules: any) => {
    if (!rules || Object.keys(rules).length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No {category} scoring rules configured
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{category}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statistic</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(rules).map(([key, rule]: [string, any]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge variant={rule.points > 0 ? 'default' : 'destructive'}>
                        {rule.points > 0 ? '+' : ''}{rule.points}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {rule.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">League Rules</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • Official rules and regulations for the Gladiator League
        </p>
      </div>

      {/* Important Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>League Information</AlertTitle>
        <AlertDescription>
          These rules apply to all three conferences within the Gladiator League.
          Conference-specific variations are noted where applicable.
        </AlertDescription>
      </Alert>

      {/* League Rules Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="charter">Charter</TabsTrigger>
        </TabsList>

        {/* Scoring Tab */}
        <TabsContent value="scoring" className="space-y-6">
          {scoringLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading scoring settings...</span>
                </div>
              </CardContent>
            </Card>
          ) : scoringError ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Error Loading Scoring Settings</AlertTitle>
              <AlertDescription>
                {scoringError}. Using default scoring rules as fallback.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6">
            {scoringSettings ? (
              <>
                {renderScoringTable('passing', scoringSettings.passing)}
                {renderScoringTable('rushing', scoringSettings.rushing)}
                {renderScoringTable('receiving', scoringSettings.receiving)}
              </>
            ) : (
              <>
                {renderScoringTable('passing', mockLeagueRules.scoring.passing)}
                {renderScoringTable('rushing', mockLeagueRules.scoring.rushing)}
                {renderScoringTable('receiving', mockLeagueRules.scoring.receiving)}
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Scoring Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoringSettings ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">
                      {scoringSettings.receiving.receptions ?
                        `${scoringSettings.receiving.receptions.points} PPR` :
                        'Standard'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {scoringSettings.receiving.receptions ?
                        `${scoringSettings.receiving.receptions.points} Points per Reception` :
                        'No PPR Scoring'
                      }
                    </p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">
                      {scoringSettings.passing.passingTDs?.points || 0}/
                      {scoringSettings.rushing.rushingTDs?.points || scoringSettings.receiving.receivingTDs?.points || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Pass TD / Rush-Rec TD</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">
                      {scoringSettings.passing.passingYards?.per || 25}/
                      {scoringSettings.rushing.rushingYards?.per || scoringSettings.receiving.receivingYards?.per || 10}
                    </p>
                    <p className="text-sm text-muted-foreground">Pass Yards / Rush-Rec Yards</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">PPR</p>
                    <p className="text-sm text-muted-foreground">0.5 Points per Reception</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">4/6</p>
                    <p className="text-sm text-muted-foreground">Pass TD / Rush-Rec TD</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">25/10</p>
                    <p className="text-sm text-muted-foreground">Pass Yards / Rush-Rec Yards</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roster Tab */}
        <TabsContent value="roster" className="space-y-6">
          {rosterLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading roster settings...</span>
                </div>
              </CardContent>
            </Card>
          ) : rosterError ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Error Loading Roster Settings</AlertTitle>
              <AlertDescription>
                {rosterError}. Using default roster configuration as fallback.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Starting Lineup Card - Full height */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Starting Lineup</span>
                </CardTitle>
                <CardDescription>Required positions for weekly lineup</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(rosterSettings?.positions || mockLeagueRules.roster.positions)
                    .filter(([position]) => position !== 'BENCH') // Show bench separately
                    .map(([position, count]) => (
                      <div key={position} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{position}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {position === 'FLEX' ? 'RB/WR/TE' :
                              position === 'SUPER_FLEX' ? 'QB/RB/WR/TE' :
                                position === 'DEF' ? 'Team Defense' :
                                  position}
                          </span>
                        </div>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Right column with two stacked cards */}
            <div className="space-y-6">
              {/* Roster Management Card - Half height */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Roster Management</CardTitle>
                  <CardDescription className="text-sm">Roster size and configuration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Roster Size</p>
                      <p className="text-xl font-bold">21</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Starting Lineup</p>
                      <p className="text-xl font-bold">9</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bench</p>
                      <p className="text-xl font-bold">12</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">IR</p>
                      <p className="text-xl font-bold">2</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Waiver & Trade Rules Card - Half height */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Waiver & Trade Rules</CardTitle>
                  <CardDescription className="text-sm">League transaction settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Waiver System</p>
                      <p className="font-semibold">{mockLeagueRules.roster.waiverSystem}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">FAAB Budget</p>
                      <p className="font-semibold">${mockLeagueRules.roster.waiverBudget}</p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Waiver Clear Time</p>
                    <p className="text-sm font-medium">{mockLeagueRules.roster.waiverClearTime}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          {playoffLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading schedule information...</span>
                </div>
              </CardContent>
            </Card>
          ) : playoffError ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Error Loading Schedule Information</AlertTitle>
              <AlertDescription>
                {playoffError}. Using default schedule information as fallback.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Season Structure</span>
                </CardTitle>
                <CardDescription>Regular season and playoff format</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Regular Season</p>
                    <p className="text-2xl font-bold">12 weeks</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Playoffs</p>
                    <p className="text-2xl font-bold">5 weeks</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Playoff Teams</p>
                    <p className="text-2xl font-bold">
                      {playoffFormat?.playoff_teams || 10}/36
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">First Round Byes</p>
                    <p className="text-2xl font-bold">
                      {playoffFormat?.week_14_byes || 6}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Important Dates</CardTitle>
                <CardDescription>{selectedSeason} season timeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Regular Season</span>
                  <span className="text-sm">Weeks 1-12</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Conference Championships</span>
                  <span className="text-sm">Week 13</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Playoffs Begin</span>
                  <span className="text-sm">Week {playoffFormat?.playoff_start_week || 14}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Colosseum Championship</span>
                  <span className="text-sm">Week {playoffFormat?.championship_week || 17}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Playoff Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="mb-4">
                  The playoffs consist of {playoffFormat?.playoff_teams || 10} teams total across all conferences, with the following structure:
                </p>
                <ul className="space-y-3">
                  <li>
                    <strong>Week 13: Conference Championships</strong> - Top 2 teams from each conference compete to become Conference Champion
                  </li>
                  <li>
                    <strong>Playoff Seeding:</strong>
                    <ul className="ml-4 mt-2 space-y-1">
                      <li>• Top 3 seeds go to Conference Champions</li>
                      <li>• Seeds 4-{playoffFormat?.playoff_teams || 10} go to next highest ranked teams, across all Conferences</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Week {playoffFormat?.playoff_start_week || 14}: Wildcard Round</strong> - Top {playoffFormat?.week_14_byes || 6} teams get byes. Remaining teams are matched up based on seeding.
                  </li>
                  <li>
                    <strong>Week 15: Quarterfinals Round</strong> - Teams are reseeded, includes winners of Wildcard round matchups and teams on bye
                  </li>
                  <li>
                    <strong>Week 16: Semifinals Round</strong> - Teams are reseeded, includes winners of Quarterfinals
                  </li>
                  <li>
                    <strong>Week {playoffFormat?.championship_week || 17}: Colosseum Championship</strong> - Winners of Semifinals compete to become the Colosseum Champion
                  </li>
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  {playoffFormat?.reseed ? 'Teams are reseeded after each round based on original seeding.' : 'Teams maintain their bracket position throughout the playoffs.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Prize Structure</span>
              </CardTitle>
              <CardDescription>
                Annual dues: $100 per team • Total prize pool: $3,600
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Colosseum Championship Payouts</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <div className="flex items-center space-x-2">
                        <Trophy className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium">Colosseum Champion</span>
                      </div>
                      <span className="font-bold text-lg">$1,200</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Runner-up</span>
                      <span className="font-bold">$800</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Regular Season Awards</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Conference Champions</span>
                      <span className="font-bold">$500 each</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Single Week High Score</span>
                      <span className="font-bold">$100</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Conference champions are determined by regular season record within each conference.</p>
                      <p className="mt-2">Single week high score award goes to the team with the most points in a single week during the regular season.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


        </TabsContent>

        {/* Charter Tab */}
        <TabsContent value="charter" className="space-y-6">
          {charterLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading charter information...</span>
                </div>
              </CardContent>
            </Card>
          ) : charterError ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Error Loading Charter</AlertTitle>
              <AlertDescription>
                {charterError}. Please contact an administrator if this issue persists.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>League Charter</CardTitle>
              <CardDescription>
                Official constitution and bylaws of the Gladiator League - {selectedSeason} Season
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasCharter && charterInfo ? (
                <div className="space-y-6">
                  {/* Charter Information */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Official League Document</AlertTitle>
                    <AlertDescription>
                      This charter contains the complete rules, policies, and procedures for the Gladiator League.
                      All league members are expected to be familiar with its contents.
                    </AlertDescription>
                  </Alert>

                  {/* Embedded Document Viewer */}
                  <DocumentViewer
                    fileUrl={charterInfo.fileUrl}
                    fileName={charterInfo.fileName}
                    uploadedAt={charterInfo.uploadedAt}
                  />
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Charter Available</h3>
                  <p className="text-muted-foreground mb-4">
                    The league charter document for the {selectedSeason} season has not been uploaded yet.
                  </p>
                  <Alert className="max-w-md mx-auto">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      League administrators can upload the charter document through the admin panel.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>League History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p>
                  The Gladiator League was founded in 2024 as a premier fantasy football competition
                  consisting of three competitive conferences: Legions of Mars, Guardians of Jupiter,
                  and Vulcan's Oathsworn.
                </p>
                <p className="mt-4">
                  Each conference operates as an independent league while following unified rules
                  and participating in inter-conference competition during special events.
                </p>
                <p className="mt-4">
                  The league charter serves as the official constitution, outlining all rules,
                  procedures, and policies that govern league operations and member conduct.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default LeagueRulesPage;