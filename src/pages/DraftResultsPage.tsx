import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { Shield, Trophy, Target, Users } from 'lucide-react';

// Mock data for draft results - this will be replaced with real Sleeper API data
const mockDraftData = {
  conferences: {
    'mars': {
      name: 'Legions of Mars',
      draftType: 'snake',
      rounds: 16,
      teams: [
      { id: 'team1', name: 'Galactic Gladiators', owner: 'John Doe', draftPosition: 1 },
      { id: 'team2', name: 'Mars Rovers', owner: 'Jane Smith', draftPosition: 2 },
      { id: 'team3', name: 'Red Planet Raiders', owner: 'Bob Johnson', draftPosition: 3 },
      { id: 'team4', name: 'Martian Miners', owner: 'Alice Brown', draftPosition: 4 }],

      picks: [
      { round: 1, pick: 1, overall: 1, team: 'Galactic Gladiators', player: 'Christian McCaffrey', position: 'RB', nflTeam: 'SF' },
      { round: 1, pick: 2, overall: 2, team: 'Mars Rovers', player: 'Austin Ekeler', position: 'RB', nflTeam: 'LAC' },
      { round: 1, pick: 3, overall: 3, team: 'Red Planet Raiders', player: 'Cooper Kupp', position: 'WR', nflTeam: 'LAR' },
      { round: 1, pick: 4, overall: 4, team: 'Martian Miners', player: 'Stefon Diggs', position: 'WR', nflTeam: 'BUF' },
      { round: 2, pick: 1, overall: 5, team: 'Martian Miners', player: 'Josh Allen', position: 'QB', nflTeam: 'BUF' },
      { round: 2, pick: 2, overall: 6, team: 'Red Planet Raiders', player: 'Saquon Barkley', position: 'RB', nflTeam: 'NYG' },
      { round: 2, pick: 3, overall: 7, team: 'Mars Rovers', player: 'Tyreek Hill', position: 'WR', nflTeam: 'MIA' },
      { round: 2, pick: 4, overall: 8, team: 'Galactic Gladiators', player: 'Davante Adams', position: 'WR', nflTeam: 'LV' }]

    },
    'jupiter': {
      name: 'Guardians of Jupiter',
      draftType: 'snake',
      rounds: 16,
      teams: [
      { id: 'team5', name: 'Storm Chasers', owner: 'Charlie Wilson', draftPosition: 1 },
      { id: 'team6', name: 'Gas Giants', owner: 'Diana Prince', draftPosition: 2 },
      { id: 'team7', name: 'Europa Explorers', owner: 'Frank Miller', draftPosition: 3 },
      { id: 'team8', name: 'Jovian Jets', owner: 'Grace Lee', draftPosition: 4 }],

      picks: [
      { round: 1, pick: 1, overall: 1, team: 'Storm Chasers', player: 'Josh Jacobs', position: 'RB', nflTeam: 'LV' },
      { round: 1, pick: 2, overall: 2, team: 'Gas Giants', player: 'Nick Chubb', position: 'RB', nflTeam: 'CLE' },
      { round: 1, pick: 3, overall: 3, team: 'Europa Explorers', player: 'Derrick Henry', position: 'RB', nflTeam: 'TEN' },
      { round: 1, pick: 4, overall: 4, team: 'Jovian Jets', player: 'Ja\'Marr Chase', position: 'WR', nflTeam: 'CIN' }]

    },
    'vulcan': {
      name: "Vulcan's Oathsworn",
      draftType: 'snake',
      rounds: 16,
      teams: [
      { id: 'team9', name: 'Forge Masters', owner: 'Henry Clark', draftPosition: 1 },
      { id: 'team10', name: 'Lava Lords', owner: 'Ivy Davis', draftPosition: 2 },
      { id: 'team11', name: 'Volcanic Victors', owner: 'Jack Turner', draftPosition: 3 },
      { id: 'team12', name: 'Molten Marauders', owner: 'Kelly White', draftPosition: 4 }],

      picks: [
      { round: 1, pick: 1, overall: 1, team: 'Forge Masters', player: 'Jonathan Taylor', position: 'RB', nflTeam: 'IND' },
      { round: 1, pick: 2, overall: 2, team: 'Lava Lords', player: 'Dalvin Cook', position: 'RB', nflTeam: 'MIN' },
      { round: 1, pick: 3, overall: 3, team: 'Volcanic Victors', player: 'Alvin Kamara', position: 'RB', nflTeam: 'NO' },
      { round: 1, pick: 4, overall: 4, team: 'Molten Marauders', player: 'DeAndre Hopkins', position: 'WR', nflTeam: 'ARI' }]

    }
  }
};

const DraftResultsPage: React.FC = () => {
  const { selectedSeason, selectedConference, currentSeasonConfig } = useApp();
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'board' | 'team'>('board');

  // Get conferences to display based on filter
  const conferencesToShow = selectedConference ?
  [selectedConference] :
  currentSeasonConfig.conferences.map((c) => c.id);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB':return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RB':return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR':return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE':return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'K':return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'DEF':return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const renderDraftBoard = (conferenceId: string) => {
    const conference = (mockDraftData.conferences as any)[conferenceId];
    if (!conference) return null;

    const roundPicks = conference.picks.filter((pick: any) => pick.round === selectedRound);

    return (
      <Card key={conferenceId}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>{conference.name}</span>
          </CardTitle>
          <CardDescription>
            Round {selectedRound} • {conference.draftType} format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pick</TableHead>
                  <TableHead className="w-16">Overall</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="hidden sm:table-cell">NFL Team</TableHead>
                  <TableHead>Drafted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roundPicks.map((pick: any) =>
                <TableRow key={`${conferenceId}-${pick.overall}`}>
                    <TableCell className="font-medium">{pick.pick}</TableCell>
                    <TableCell className="font-medium">{pick.overall}</TableCell>
                    <TableCell className="font-semibold">{pick.player}</TableCell>
                    <TableCell>
                      <Badge className={getPositionColor(pick.position)}>
                        {pick.position}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{pick.nflTeam}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{pick.team}</div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>);

  };

  const renderTeamView = () => {
    return (
      <div className="space-y-6">
        {conferencesToShow.map((conferenceId) => {
          const conference = (mockDraftData.conferences as any)[conferenceId];
          if (!conference) return null;

          return (
            <Card key={conferenceId}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>{conference.name} - Team Draft Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {conference.teams.map((team: any) => {
                    const teamPicks = conference.picks.filter((pick: any) => pick.team === team.name);

                    return (
                      <Card key={team.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{team.name}</CardTitle>
                          <CardDescription>
                            {team.owner} • Draft Position {team.draftPosition}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {teamPicks.slice(0, 5).map((pick: any) =>
                            <div key={pick.overall} className="flex items-center justify-between p-2 rounded-md bg-accent/50">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    R{pick.round}
                                  </Badge>
                                  <span className="font-medium text-sm">{pick.player}</span>
                                  <Badge className={`${getPositionColor(pick.position)} text-xs`}>
                                    {pick.position}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">#{pick.overall}</span>
                              </div>
                            )}
                            {teamPicks.length > 5 &&
                            <p className="text-xs text-muted-foreground text-center pt-2">
                                +{teamPicks.length - 5} more picks
                              </p>
                            }
                          </div>
                        </CardContent>
                      </Card>);

                  })}
                </div>
              </CardContent>
            </Card>);

        })}
      </div>);

  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Draft Results</h1>
        </div>
        <p className="text-muted-foreground">
          {selectedSeason} Season • {selectedConference ?
          currentSeasonConfig.conferences.find((c) => c.id === selectedConference)?.name :
          'All Conferences'
          }
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Conferences</CardDescription>
            <CardTitle className="text-2xl">{conferencesToShow.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Teams</CardDescription>
            <CardTitle className="text-2xl">
              {conferencesToShow.reduce((sum, confId) => {
                const conf = (mockDraftData.conferences as any)[confId];
                return sum + (conf?.teams.length || 0);
              }, 0)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rounds per Conference</CardDescription>
            <CardTitle className="text-2xl">16</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft Format</CardDescription>
            <CardTitle className="text-lg">Snake</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select value={selectedRound.toString()} onValueChange={(value) => setSelectedRound(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 16 }, (_, i) =>
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Round {i + 1}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Draft Results Tabs */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'board' | 'team')} className="w-full">
        <TabsList>
          <TabsTrigger value="board">Draft Board</TabsTrigger>
          <TabsTrigger value="team">Team View</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-6">
          {conferencesToShow.map((conferenceId) => renderDraftBoard(conferenceId))}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          {renderTeamView()}
        </TabsContent>
      </Tabs>

      {/* Draft Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Draft Analysis</span>
          </CardTitle>
          <CardDescription>
            Draft insights and position trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold text-green-600">RB</p>
              <p className="text-sm text-muted-foreground">Most Drafted Position</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold">2.3</p>
              <p className="text-sm text-muted-foreground">Avg QB Draft Round</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold">12.8%</p>
              <p className="text-sm text-muted-foreground">RB Drafted in Round 1</p>
            </div>
          </div>
          
          <div className="mt-6 text-center text-muted-foreground">
            <p>Complete draft analysis will be available when connected to Sleeper API</p>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default DraftResultsPage;