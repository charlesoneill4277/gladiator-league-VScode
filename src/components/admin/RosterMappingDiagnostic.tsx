import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, RefreshCw, Database, Zap, ArrowRight } from 'lucide-react';
import SleeperApiService from '@/services/sleeperApi';

interface DiagnosticResult {
  conferenceId: number;
  conferenceName: string;
  leagueId: string;
  databaseRosters: Array<{
    teamId: number;
    teamName: string;
    rosterId: string;
    isActive: boolean;
  }>;
  sleeperRosters: Array<{
    rosterId: number;
    ownerId: string;
    ownerName: string;
  }>;
  issues: Array<{
    type: 'missing_in_sleeper' | 'missing_in_database' | 'duplicate_assignment';
    description: string;
    severity: 'high' | 'medium' | 'low';
    suggestion: string;
  }>;
  corrections: Array<{
    action: 'update' | 'create' | 'deactivate';
    description: string;
    data: any;
  }>;
}

const RosterMappingDiagnostic: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(2024);
  const [isFixing, setIsFixing] = useState(false);

  const runDiagnostic = async () => {
    setIsLoading(true);
    
    try {
      console.log('🔍 Starting comprehensive roster mapping diagnostic...');
      
      // Step 1: Get all seasons and conferences
      const seasonsResponse = await window.ezsite.apis.tablePage('12818', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'season_year',
        IsAsc: false,
        Filters: [
          { name: 'season_year', op: 'Equal', value: selectedSeason }
        ]
      });

      if (seasonsResponse.error) {
        throw new Error(seasonsResponse.error);
      }

      const currentSeason = seasonsResponse.data.List[0];
      if (!currentSeason) {
        throw new Error(`Season ${selectedSeason} not found`);
      }

      // Step 2: Get conferences for this season
      const conferencesResponse = await window.ezsite.apis.tablePage('12820', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'conference_name',
        IsAsc: true,
        Filters: [
          { name: 'season_id', op: 'Equal', value: currentSeason.id }
        ]
      });

      if (conferencesResponse.error) {
        throw new Error(conferencesResponse.error);
      }

      const conferences = conferencesResponse.data.List;
      console.log(`Found ${conferences.length} conferences for season ${selectedSeason}`);

      // Step 3: Get all teams
      const teamsResponse = await window.ezsite.apis.tablePage('12852', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'team_name',
        IsAsc: true,
        Filters: []
      });

      if (teamsResponse.error) {
        throw new Error(teamsResponse.error);
      }

      const teams = teamsResponse.data.List;

      // Step 4: Analyze each conference
      const results: DiagnosticResult[] = [];

      for (const conference of conferences) {
        console.log(`🔍 Analyzing conference: ${conference.conference_name}`);
        
        try {
          // Get database roster mappings for this conference
          const dbMappingsResponse = await window.ezsite.apis.tablePage('12853', {
            PageNo: 1,
            PageSize: 50,
            OrderByField: 'id',
            IsAsc: true,
            Filters: [
              { name: 'conference_id', op: 'Equal', value: conference.id },
              { name: 'is_active', op: 'Equal', value: true }
            ]
          });

          if (dbMappingsResponse.error) {
            throw new Error(dbMappingsResponse.error);
          }

          const dbMappings = dbMappingsResponse.data.List;
          
          // Get Sleeper data for this conference
          const [sleeperRosters, sleeperUsers] = await Promise.all([
            SleeperApiService.fetchLeagueRosters(conference.league_id),
            SleeperApiService.fetchLeagueUsers(conference.league_id)
          ]);

          // Build diagnostic result
          const result: DiagnosticResult = {
            conferenceId: conference.id,
            conferenceName: conference.conference_name,
            leagueId: conference.league_id,
            databaseRosters: dbMappings.map((mapping: any) => {
              const team = teams.find((t: any) => t.id === mapping.team_id);
              return {
                teamId: mapping.team_id,
                teamName: team?.team_name || 'Unknown Team',
                rosterId: mapping.roster_id,
                isActive: mapping.is_active
              };
            }),
            sleeperRosters: sleeperRosters.map((roster: any) => {
              const user = sleeperUsers.find((u: any) => u.user_id === roster.owner_id);
              return {
                rosterId: roster.roster_id,
                ownerId: roster.owner_id,
                ownerName: user?.display_name || user?.username || 'Unknown'
              };
            }),
            issues: [],
            corrections: []
          };

          // Analyze issues
          const dbRosterIds = new Set(result.databaseRosters.map(r => r.rosterId));
          const sleeperRosterIds = new Set(result.sleeperRosters.map(r => r.rosterId.toString()));

          // Find database rosters that don't exist in Sleeper
          result.databaseRosters.forEach(dbRoster => {
            if (!sleeperRosterIds.has(dbRoster.rosterId)) {
              result.issues.push({
                type: 'missing_in_sleeper',
                description: `Team "${dbRoster.teamName}" is mapped to roster ${dbRoster.rosterId} which doesn't exist in Sleeper`,
                severity: 'high',
                suggestion: `Update team ${dbRoster.teamId} to use a valid roster ID or deactivate the mapping`
              });

              result.corrections.push({
                action: 'deactivate',
                description: `Deactivate invalid mapping for team ${dbRoster.teamId}`,
                data: {
                  teamId: dbRoster.teamId,
                  currentRosterId: dbRoster.rosterId,
                  conferenceId: conference.id
                }
              });
            }
          });

          // Find Sleeper rosters that don't have database mappings
          result.sleeperRosters.forEach(sleeperRoster => {
            if (!dbRosterIds.has(sleeperRoster.rosterId.toString())) {
              result.issues.push({
                type: 'missing_in_database',
                description: `Sleeper roster ${sleeperRoster.rosterId} (owned by ${sleeperRoster.ownerName}) has no database team mapping`,
                severity: 'medium',
                suggestion: `Create a team assignment for roster ${sleeperRoster.rosterId}`
              });

              result.corrections.push({
                action: 'create',
                description: `Create team mapping for roster ${sleeperRoster.rosterId}`,
                data: {
                  rosterId: sleeperRoster.rosterId,
                  ownerId: sleeperRoster.ownerId,
                  ownerName: sleeperRoster.ownerName,
                  conferenceId: conference.id
                }
              });
            }
          });

          // Check for duplicate roster assignments
          const rosterCounts: Record<string, number> = {};
          result.databaseRosters.forEach(dbRoster => {
            rosterCounts[dbRoster.rosterId] = (rosterCounts[dbRoster.rosterId] || 0) + 1;
          });

          Object.entries(rosterCounts).forEach(([rosterId, count]) => {
            if (count > 1) {
              result.issues.push({
                type: 'duplicate_assignment',
                description: `Roster ${rosterId} is assigned to ${count} different teams`,
                severity: 'high',
                suggestion: `Review and remove duplicate assignments for roster ${rosterId}`
              });
            }
          });

          results.push(result);

        } catch (error) {
          console.error(`❌ Error analyzing conference ${conference.conference_name}:`, error);
          
          // Create error result
          results.push({
            conferenceId: conference.id,
            conferenceName: conference.conference_name,
            leagueId: conference.league_id,
            databaseRosters: [],
            sleeperRosters: [],
            issues: [{
              type: 'missing_in_sleeper',
              description: `Failed to analyze conference: ${error}`,
              severity: 'high',
              suggestion: 'Check Sleeper API connectivity and league configuration'
            }],
            corrections: []
          });
        }
      }

      setDiagnosticResults(results);

      const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
      toast({
        title: 'Diagnostic Complete',
        description: `Found ${totalIssues} issues across ${results.length} conferences`,
        variant: totalIssues > 0 ? 'destructive' : 'default'
      });

    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      toast({
        title: 'Diagnostic Failed',
        description: `Error: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyCorrections = async () => {
    setIsFixing(true);
    
    try {
      let corrected = 0;
      let failed = 0;

      for (const result of diagnosticResults) {
        for (const correction of result.corrections) {
          try {
            if (correction.action === 'deactivate') {
              // Find and deactivate the mapping
              const mappingResponse = await window.ezsite.apis.tablePage('12853', {
                PageNo: 1,
                PageSize: 10,
                OrderByField: 'id',
                IsAsc: true,
                Filters: [
                  { name: 'team_id', op: 'Equal', value: correction.data.teamId },
                  { name: 'conference_id', op: 'Equal', value: correction.data.conferenceId }
                ]
              });

              if (!mappingResponse.error && mappingResponse.data.List.length > 0) {
                const mapping = mappingResponse.data.List[0];
                const updateResponse = await window.ezsite.apis.tableUpdate('12853', {
                  ...mapping,
                  is_active: false
                });

                if (!updateResponse.error) {
                  corrected++;
                  console.log(`✅ Deactivated mapping for team ${correction.data.teamId}`);
                } else {
                  failed++;
                  console.error(`❌ Failed to deactivate mapping:`, updateResponse.error);
                }
              }
            }
            // Add other correction types (create, update) as needed
          } catch (error) {
            failed++;
            console.error(`❌ Correction failed:`, error);
          }
        }
      }

      toast({
        title: 'Corrections Applied',
        description: `Applied ${corrected} corrections, ${failed} failed`,
        variant: failed > 0 ? 'destructive' : 'default'
      });

      // Re-run diagnostic to see updated results
      if (corrected > 0) {
        await runDiagnostic();
      }

    } catch (error) {
      console.error('❌ Failed to apply corrections:', error);
      toast({
        title: 'Correction Failed',
        description: `Error: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setIsFixing(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getIssueBadge = (type: string) => {
    switch (type) {
      case 'missing_in_sleeper':
        return <Badge className="bg-red-100 text-red-800">Invalid Roster</Badge>;
      case 'missing_in_database':
        return <Badge className="bg-yellow-100 text-yellow-800">Missing Mapping</Badge>;
      case 'duplicate_assignment':
        return <Badge className="bg-purple-100 text-purple-800">Duplicate</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Roster Mapping Diagnostic</span>
          </CardTitle>
          <CardDescription>
            Identify and fix mismatched team-roster assignments between database and Sleeper API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button
              onClick={runDiagnostic}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Run Diagnostic</span>
            </Button>

            {diagnosticResults.length > 0 && (
              <Button
                onClick={applyCorrections}
                disabled={isFixing}
                variant="secondary"
                className="flex items-center space-x-2"
              >
                <Zap className={`h-4 w-4 ${isFixing ? 'animate-pulse' : ''}`} />
                <span>Apply Auto-Corrections</span>
              </Button>
            )}
          </div>

          {diagnosticResults.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {diagnosticResults.reduce((sum, r) => sum + r.issues.length, 0)} issues 
                across {diagnosticResults.length} conferences. 
                Review the details below and apply corrections as needed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {diagnosticResults.map((result) => (
        <Card key={result.conferenceId}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{result.conferenceName}</span>
              <div className="flex items-center space-x-2">
                {result.issues.length === 0 ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {result.issues.length} Issues
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              League ID: {result.leagueId} • 
              {result.databaseRosters.length} Database Teams • 
              {result.sleeperRosters.length} Sleeper Rosters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.issues.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Issues Found:</h4>
                <div className="space-y-2">
                  {result.issues.map((issue, index) => (
                    <Alert key={index}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {getIssueBadge(issue.type)}
                            {getSeverityBadge(issue.severity)}
                          </div>
                          <p className="text-sm">{issue.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            💡 {issue.suggestion}
                          </p>
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Database Roster Mappings</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Roster ID</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.databaseRosters.map((roster, index) => {
                      const existsInSleeper = result.sleeperRosters.some(
                        s => s.rosterId.toString() === roster.rosterId
                      );
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{roster.teamName}</TableCell>
                          <TableCell>{roster.rosterId}</TableCell>
                          <TableCell>
                            {existsInSleeper ? (
                              <Badge className="bg-green-100 text-green-800">Valid</Badge>
                            ) : (
                              <Badge variant="destructive">Invalid</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Sleeper Rosters</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roster ID</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Mapped</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.sleeperRosters.map((roster, index) => {
                      const hasDatabaseMapping = result.databaseRosters.some(
                        db => db.rosterId === roster.rosterId.toString()
                      );
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{roster.rosterId}</TableCell>
                          <TableCell>{roster.ownerName}</TableCell>
                          <TableCell>
                            {hasDatabaseMapping ? (
                              <Badge className="bg-green-100 text-green-800">Yes</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RosterMappingDiagnostic;