import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { FileText, Settings, Trophy, Users, DollarSign, Calendar, Info } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('scoring');

  const renderScoringTable = (category: string, rules: any) =>
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
              {Object.entries(rules).map(([key, rule]: [string, any]) =>
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
            )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>;


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
          <div className="grid gap-6">
            {renderScoringTable('passing', mockLeagueRules.scoring.passing)}
            {renderScoringTable('rushing', mockLeagueRules.scoring.rushing)}
            {renderScoringTable('receiving', mockLeagueRules.scoring.receiving)}
            {renderScoringTable('kicking', mockLeagueRules.scoring.kicking)}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Scoring Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roster Tab */}
        <TabsContent value="roster" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {Object.entries(mockLeagueRules.roster.positions).map(([position, count]) =>
                  <div key={position} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{position}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {position === 'FLEX' ? 'RB/WR/TE' :
                        position === 'BENCH' ? 'Bench Players' :
                        position === 'DEF' ? 'Team Defense' : position}
                        </span>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Roster Management</CardTitle>
                <CardDescription>Waivers, trades, and roster rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Roster Size</p>
                    <p className="text-2xl font-bold">{mockLeagueRules.roster.totalRosterSize}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">IR Slots</p>
                    <p className="text-2xl font-bold">{mockLeagueRules.roster.irSlots}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Waiver System</p>
                    <p className="font-semibold">{mockLeagueRules.roster.waiverSystem}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">FAAB Budget</p>
                    <p className="font-semibold">${mockLeagueRules.roster.waiverBudget}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Waiver Clear Time</p>
                  <p className="font-medium">{mockLeagueRules.roster.waiverClearTime}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Roster Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <ul className="space-y-2">
                  <li>All roster moves are processed through the waiver system except for free agents</li>
                  <li>Players can be dropped and picked up immediately if they clear waivers</li>
                  <li>IR slots can only be used for players with IR, Out, or PUP designations</li>
                  <li>Lineup changes must be made before the player's game starts</li>
                  <li>No trading of FAAB budget between teams</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
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
                    <p className="text-2xl font-bold">{mockLeagueRules.schedule.regularSeasonWeeks} weeks</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Playoffs</p>
                    <p className="text-2xl font-bold">{mockLeagueRules.schedule.playoffWeeks} weeks</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Playoff Teams</p>
                    <p className="text-2xl font-bold">{mockLeagueRules.schedule.playoffTeams}/12</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trade Deadline</p>
                    <p className="font-semibold">{mockLeagueRules.schedule.tradeDeadline}</p>
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
                  <span className="font-medium">Season Start</span>
                  <span className="text-sm">{new Date(mockLeagueRules.schedule.seasonStart).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Trade Deadline</span>
                  <span className="text-sm">End of {mockLeagueRules.schedule.tradeDeadline}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">Playoffs Begin</span>
                  <span className="text-sm">{new Date(mockLeagueRules.schedule.playoffStart).toLocaleDateString()}</span>
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
                  The playoffs consist of the top 6 teams from each conference, with the following bracket:
                </p>
                <ul className="space-y-2">
                  <li><strong>Week 15:</strong> Wild Card Round - #3 vs #6, #4 vs #5 (Top 2 teams get bye)</li>
                  <li><strong>Week 16:</strong> Semifinals - #1 vs lowest remaining seed, #2 vs highest remaining seed</li>
                  <li><strong>Week 17:</strong> Championship Game - Winners of semifinals</li>
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  Seeding is determined by regular season record, with total points as the tiebreaker.
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
                Entry fee: ${mockLeagueRules.payouts.entryFee} per team • Total pot: ${mockLeagueRules.payouts.totalPot}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Championship Payouts</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <div className="flex items-center space-x-2">
                        <Trophy className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium">1st Place</span>
                      </div>
                      <span className="font-bold text-lg">${mockLeagueRules.payouts.firstPlace}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">2nd Place</span>
                      <span className="font-bold">${mockLeagueRules.payouts.secondPlace}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">3rd Place</span>
                      <span className="font-bold">${mockLeagueRules.payouts.thirdPlace}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Regular Season Awards</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Regular Season Champion</span>
                      <span className="font-bold">${mockLeagueRules.payouts.regularSeasonChamp}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Regular season champion is the team with the best record after 14 weeks.</p>
                      <p className="mt-2">Tiebreakers: Total points scored, then head-to-head record.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <ul className="space-y-2">
                  <li>Entry fees must be paid before the start of Week 1</li>
                  <li>No team can participate in playoffs without paying entry fee</li>
                  <li>Payouts will be distributed within 1 week of season completion</li>
                  <li>All payments handled through league management</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charter Tab */}
        <TabsContent value="charter" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>League Charter</CardTitle>
              <CardDescription>
                Official constitution and bylaws of the Gladiator League
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <Info className="h-4 w-4" />
                <AlertTitle>Charter Document</AlertTitle>
                <AlertDescription>
                  The complete league charter will be uploaded and displayed here by the league administrator.
                  This section will contain all official rules, policies, and procedures.
                </AlertDescription>
              </Alert>

              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Charter Document</h3>
                <p className="text-muted-foreground mb-4">
                  The league charter document will be displayed here when uploaded by an administrator.
                </p>
                <Button variant="outline">
                  Contact Admin to Upload Charter
                </Button>
              </div>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default LeagueRulesPage;